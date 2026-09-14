import { randomUUID } from 'node:crypto';
import {
  mkdirSync,
  writeFileSync,
  renameSync,
  rmSync,
  existsSync,
  readFileSync,
  openSync,
  closeSync,
  fsyncSync,
} from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { draftSchema, localTimestamp, UF_CODES, type Draft } from '../../shared/contracts';
import { Store, sha } from '../repositories/store';
import * as tables from '../../../db/schema';
import { AppError } from '../errors';
import { NFeSequenceService } from './sequence';
import { AccessKeyService } from '../fiscal/access-key';
import { calculate } from '../fiscal/totals';
import type { FiscalDocument } from '../fiscal/document';
import { NoOpNFeSigner, type NFeSigner } from '../fiscal/document';
import { XmlGeneratorService, type XmlGenerator } from '../fiscal/xml';
import { DanfeGeneratorService, type DanfeGeneratorAdapter } from '../fiscal/danfe';
import { requireValidXsd, SCHEMA_PROFILE } from '../fiscal/xsd';

function durableWrite(file: string, value: string | Buffer) {
  const fd = openSync(file, 'wx');
  try {
    writeFileSync(fd, value);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
function syncDirectory(directory: string) {
  const fd = openSync(directory, 'r');
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
export class NFeService {
  constructor(
    private store: Store,
    private xml: XmlGenerator = new XmlGeneratorService(),
    private pdf: DanfeGeneratorAdapter = new DanfeGeneratorService(),
    private signer: NFeSigner = new NoOpNFeSigner(),
  ) {}
  private resolve(input: unknown): {
    draft: Draft;
    emitter: FiscalDocument['emitter'];
    recipient: FiscalDocument['recipient'];
  } {
    const draft = draftSchema.parse(input),
      emitter = this.store.get('emitters', draft.emitterId),
      recipient = this.store.get('recipients', draft.recipientId);
    if (emitter.cpf && (draft.serie < 920 || draft.serie > 969))
      throw new AppError(
        'INVALID_PF_SERIE',
        'Para emitente PF, use série entre 920 e 969 neste perfil',
      );
    draft.emitterId = emitter.id;
    draft.recipientId = recipient.id;
    for (const item of draft.items) this.store.get('products', item.productId);
    if (draft.sourceInvoiceId) this.store.invoice(draft.sourceInvoiceId);
    if (!draft.cityCode.startsWith(UF_CODES[emitter.address.uf]))
      throw new AppError(
        'INVALID_CITY',
        'Município de ocorrência incompatível com a UF do emitente',
        422,
        { cityCode: 'Confira o código IBGE' },
      );
    const interstate = emitter.address.uf !== recipient.address.uf;
    if (draft.destination !== (interstate ? '2' : '1'))
      throw new AppError(
        'INVALID_DESTINATION',
        'Destino deve corresponder às UFs de emitente e destinatário',
        422,
        { destination: 'Selecione interno ou interestadual conforme os endereços' },
      );
    const cfops = new Set(this.store.list('cfops').map((cfop) => cfop.code));
    for (const [index, item] of draft.items.entries()) {
      if (!cfops.has(item.cfop))
        throw new AppError('CFOP_NOT_FOUND', 'Selecione um CFOP cadastrado e ativo', 422, {
          [`items.${index}.cfop`]: 'Cadastre ou selecione o CFOP da operação',
        });
      const prefix = draft.operation === '1' ? (interstate ? '6' : '5') : interstate ? '2' : '1';
      if (!item.cfop.startsWith(prefix))
        throw new AppError('INVALID_CFOP', 'CFOP incompatível com tipo/destino da operação', 422, {
          [`items.${index}.cfop`]: `CFOP deve começar por ${prefix}`,
        });
    }
    if (draft.exitDate && Date.parse(draft.exitDate) < Date.parse(draft.issueDate))
      throw new AppError('INVALID_DATE', 'Saída/entrada anterior à emissão', 422, {
        exitDate: 'Revise as datas',
      });
    if (draft.referenceKeys.some((k) => !AccessKeyService.valid(k)))
      throw new AppError('INVALID_REFERENCE', 'Chave referenciada com DV inválido');
    if (draft.purpose === '4') draft.payment.method = '90';
    return { draft, emitter, recipient };
  }
  preview(input: unknown) {
    const resolved = this.resolve(input),
      { draft, emitter } = resolved;
    const seq = this.store.sequence(draft.emitterId, draft.serie),
      number = draft.manualNumber === '' ? (seq?.next_number ?? 1) : draft.manualNumber;
    if (number > 999999999)
      throw new AppError('SEQUENCE_EXHAUSTED', 'Numeração esgotada nesta série');
    const numericCode =
      emitter.numericCodeMode === 'RANDOM'
        ? '00000000'
        : AccessKeyService.numeric('SEQUENTIAL', seq?.next_code ?? 1);
    const accessKey = AccessKeyService.build({
      uf: emitter.address.uf,
      document: emitter.cpf || emitter.cnpj,
      issueDate: draft.issueDate,
      serie: draft.serie,
      number,
      numericCode,
    });
    return {
      ...resolved,
      ...calculate(draft.items, emitter.crt),
      number,
      numericCode,
      accessKey,
      estimated: true,
      numericCodeEstimated: emitter.numericCodeMode === 'RANDOM',
    };
  }
  async generate(input: unknown, requestId: string) {
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(requestId))
      throw new AppError('INVALID_REQUEST_ID', 'Informe uma chave de idempotência válida');
    const requestHash = sha(JSON.stringify(draftSchema.parse(input)));
    return this.store.write(async () => {
      let stage = 'RESERVE',
        temporary = '',
        directory = '',
        ownsDirectory = false;
      const s = this.store;
      s.raw.exec('BEGIN IMMEDIATE');
      try {
        const prior = s.db
          .select()
          .from(tables.invoices)
          .where(eq(tables.invoices.requestId, requestId))
          .get();
        if (prior) {
          if (prior.requestHash !== requestHash)
            throw new AppError(
              'IDEMPOTENCY_CONFLICT',
              'Chave de idempotência reutilizada com dados diferentes',
              409,
            );
          s.raw.exec('COMMIT');
          return { id: prior.id, number: prior.number, accessKey: prior.accessKey, replayed: true };
        }
        const resolved = this.resolve(input),
          { draft, emitter } = resolved,
          now = new Date().toISOString();
        const { number, numericCode } = new NFeSequenceService(s).reserve(draft, emitter);
        const accessKey = AccessKeyService.build({
          uf: emitter.address.uf,
          document: emitter.cpf || emitter.cnpj,
          issueDate: draft.issueDate,
          serie: draft.serie,
          number,
          numericCode,
        });
        const document: FiscalDocument = {
          ...resolved,
          ...calculate(draft.items, emitter.crt),
          number,
          numericCode,
          accessKey,
        };
        const settings = s.settings();
        stage = 'XML';
        const xml = await this.signer.sign(this.xml.generate(document, settings.prettyXml));
        stage = 'XSD';
        if (settings.validateXsd) await requireValidXsd(xml);
        stage = 'DANFE';
        const pdf = await this.pdf.generate(xml, document);
        const id = randomUUID();
        stage = 'FILES';
        directory = path.join(
          settings.storageDirectory,
          emitter.cpf || emitter.cnpj,
          draft.issueDate.slice(0, 4),
          draft.issueDate.slice(5, 7),
          accessKey,
        );
        temporary = directory + '.tmp-' + id;
        if (existsSync(/*turbopackIgnore: true*/ directory))
          throw new AppError(
            'FILE_CONFLICT',
            'Diretório da chave já existe. Reinicie para reconciliar os arquivos',
            409,
          );
        mkdirSync(temporary, { recursive: true });
        durableWrite(
          path.join(temporary, '.nfe-mock.json'),
          JSON.stringify({ id, database: path.join(s.root, 'nfe-mock.sqlite') }),
        );
        durableWrite(path.join(temporary, 'nfe.xml'), xml);
        durableWrite(path.join(temporary, 'danfe.pdf'), pdf);
        syncDirectory(temporary);
        renameSync(temporary, directory);
        ownsDirectory = true;
        temporary = '';
        syncDirectory(path.dirname(directory));
        stage = 'PERSIST';
        s.db
          .insert(tables.invoices)
          .values({
            id,
            emitterId: draft.emitterId,
            recipientId: draft.recipientId,
            serie: draft.serie,
            number,
            accessKey,
            numericCode,
            checkDigit: accessKey.at(-1)!,
            issueDate: draft.issueDate,
            total: document.totals.total,
            status: 'GENERATED',
            sourceInvoiceId: draft.sourceInvoiceId || null,
            snapshot: JSON.stringify(document),
            directory,
            xmlHash: sha(xml),
            pdfHash: sha(pdf),
            schemaProfile: SCHEMA_PROFILE,
            validation: settings.validateXsd ? 'VALID_UNSIGNED_TEST' : 'NOT_EXECUTED',
            requestId,
            requestHash,
            createdAt: now,
            updatedAt: now,
          })
          .run();
        for (const [index, item] of document.items.entries())
          s.db
            .insert(tables.invoiceItems)
            .values({
              id: randomUUID(),
              invoiceId: id,
              productId: item.productId,
              itemNumber: index + 1,
              snapshot: JSON.stringify(item),
            })
            .run();
        s.raw.exec('COMMIT');
        return { id, number, accessKey, replayed: false };
      } catch (error) {
        if (s.raw.inTransaction) s.raw.exec('ROLLBACK');
        // A committed request must never have its files removed after an ambiguous error.
        const committed = s.db
          .select()
          .from(tables.invoices)
          .where(eq(tables.invoices.requestId, requestId))
          .get();
        if (!committed) {
          for (const candidate of [temporary, ownsDirectory ? directory : undefined]) {
            if (!candidate || !existsSync(/* turbopackIgnore: true */ candidate)) continue;
            try {
              rmSync(candidate, { recursive: true, force: true });
            } catch {
              // Recovery can remove managed leftovers; do not log local paths or fiscal data.
              console.error('[nfe-mock] Failed to clean up an aborted generation');
            }
          }
        }
        s.db
          .insert(tables.attempts)
          .values({
            id: randomUUID(),
            requestId,
            stage,
            message: error instanceof Error ? error.message : String(error),
            draft: JSON.stringify(input),
            createdAt: new Date().toISOString(),
          })
          .run();
        throw error;
      }
    });
  }
  duplicate(id: string, substitute = false) {
    const invoice = this.store.invoice(id);
    const original = invoice.snapshot as FiscalDocument;
    const draft: Draft = structuredClone(original.draft);
    draft.emitterId = invoice.emitterId;
    draft.recipientId = invoice.recipientId;
    draft.manualNumber = '';
    draft.issueDate = localTimestamp();
    draft.exitDate = '';
    delete draft.sourceInvoiceId;
    if (substitute) draft.sourceInvoiceId = id;
    return draft;
  }
  file(id: string, format: 'xml' | 'pdf') {
    const invoice = this.store.invoice(id);
    if (invoice.status === 'ERROR')
      throw new AppError(
        'CORRUPT_FILES',
        'Arquivos ausentes ou inconsistentes. Consulte o histórico',
        409,
      );
    const file = path.join(invoice.directory, format === 'xml' ? 'nfe.xml' : 'danfe.pdf');
    if (!existsSync(file)) throw new AppError('MISSING_FILE', 'Arquivo não encontrado', 404);
    const content = readFileSync(file);
    if (sha(content) !== (format === 'xml' ? invoice.xmlHash : invoice.pdfHash))
      throw new AppError('CORRUPT_FILES', 'Arquivo alterado no disco', 409);
    return { content, key: invoice.accessKey };
  }
}
