import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import JSZip from 'jszip';
import { store, catalogNames, type CatalogName } from '../../../server/repositories/store';
import { NFeService } from '../../../server/services/nfe';
import { AppError } from '../../../server/errors';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (value: unknown, status = 200) =>
  NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
async function handle(request: NextRequest, context: { params: Promise<{ route: string[] }> }) {
  try {
    const method = request.method;
    const host = request.headers.get('host') || request.nextUrl.host;
    const originForHost = `${request.nextUrl.protocol}//${host}`;
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(originForHost).hostname))
      throw new AppError('INVALID_HOST', 'A API deve ser acessada por localhost ou 127.0.0.1', 403);
    if (!['GET', 'HEAD'].includes(method)) {
      const origin = request.headers.get('origin');
      if (origin && origin !== originForHost)
        throw new AppError('INVALID_ORIGIN', 'Origem da requisição não permitida', 403);
      if (!request.headers.get('content-type')?.startsWith('application/json'))
        throw new AppError('INVALID_CONTENT_TYPE', 'Use application/json', 415);
    }
    const { route } = await context.params,
      [resource, id, action] = route;
    const db = store(),
      service = new NFeService(db);
    if (resource === 'health' && method === 'GET') return json({ status: 'ok', mode: 'offline' });
    const body = async () => {
      const raw = await request.text();
      if (Buffer.byteLength(raw) > 2_000_000)
        throw new AppError('BODY_TOO_LARGE', 'Dados excedem 2 MB', 413);
      try {
        return JSON.parse(raw);
      } catch {
        throw new AppError('INVALID_JSON', 'JSON inválido', 400);
      }
    };
    if (resource === 'dashboard' && method === 'GET') {
      const invoices = db.history();
      return json({
        counts: {
          entities: db.list('entities').length,
          products: db.list('products').length,
          invoices: invoices.filter((x) => x.status === 'GENERATED').length,
        },
        recent: invoices.slice(0, 6),
        settings: db.settings(),
      });
    }
    if (catalogNames.includes(resource as CatalogName)) {
      const kind = resource as CatalogName;
      if (method === 'GET') return json(id ? db.get(kind, id) : db.list(kind));
      if (method === 'POST' && !id) return json(await db.save(kind, await body()), 201);
      if (method === 'PUT' && id) return json(await db.save(kind, await body(), id));
      if (method === 'DELETE' && id) return json(await db.remove(kind, id));
    }
    if (resource === 'settings') {
      if (method === 'GET') return json(db.settings());
      if (method === 'PUT') return json(await db.updateSettings(await body()));
    }
    if (resource === 'sequences' && id) {
      const serie = z.coerce
        .number()
        .int()
        .min(0)
        .max(999)
        .parse(request.nextUrl.searchParams.get('serie') ?? '1');
      db.get('emitters', id);
      if (method === 'GET') return json(db.sequence(id, serie) || { next_number: 1, next_code: 1 });
      if (method === 'PUT') {
        const b = z
          .object({
            nextNumber: z.number().int().min(1).max(999999999),
            expected: z.number().int().min(1),
            confirmed: z.literal(true),
          })
          .parse(await body());
        return json(await db.reset(id, serie, b.nextNumber, b.expected));
      }
    }
    if (resource === 'invoices') {
      if (method === 'POST' && id === 'preview') return json(service.preview(await body()));
      if (method === 'POST' && !id)
        return json(
          await service.generate(await body(), request.headers.get('idempotency-key') || ''),
          201,
        );
      if (method === 'GET' && !id) return json({ invoices: db.history(), errors: db.errors() });
      if (id && method === 'GET' && action === 'duplicate')
        return json(
          service.duplicate(id, request.nextUrl.searchParams.get('substitute') === 'true'),
        );
      if (id && method === 'GET' && action === 'files') {
        const format = z
          .enum(['xml', 'pdf', 'zip'])
          .parse(request.nextUrl.searchParams.get('format'));
        let content: Buffer, key: string;
        if (format === 'zip') {
          const xml = service.file(id, 'xml'),
            pdf = service.file(id, 'pdf');
          const zip = new JSZip();
          zip.file('nfe.xml', xml.content);
          zip.file('danfe.pdf', pdf.content);
          content = await zip.generateAsync({ type: 'nodebuffer' });
          key = xml.key;
        } else ({ content, key } = service.file(id, format));
        return new Response(new Uint8Array(content), {
          headers: {
            'Content-Type':
              format === 'xml'
                ? 'application/xml; charset=utf-8'
                : format === 'pdf'
                  ? 'application/pdf'
                  : 'application/zip',
            'Content-Disposition': `${format === 'pdf' && request.nextUrl.searchParams.get('inline') === '1' ? 'inline' : 'attachment'}; filename="${key}.${format}"`,
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }
      if (id && method === 'GET') return json(db.invoice(id));
      if (id && method === 'DELETE') return json(await db.changeInvoice(id, 'delete'));
      if (id && method === 'POST' && action === 'cancel')
        return json(await db.changeInvoice(id, 'cancel'));
    }
    throw new AppError('NOT_FOUND', 'Rota não encontrada', 404);
  } catch (error) {
    if (error instanceof ZodError)
      return json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Revise os campos informados',
          fields: Object.fromEntries(error.issues.map((i) => [i.path.join('.'), i.message])),
        },
        422,
      );
    if (error instanceof AppError)
      return json({ code: error.code, message: error.message, fields: error.fields }, error.status);
    console.error('[nfe-mock] Unexpected request failure');
    if (String(error).includes('SQLITE_BUSY'))
      return json(
        {
          code: 'DATABASE_BUSY',
          message: 'Banco ocupado. Aguarde e tente novamente com a mesma requisição',
        },
        503,
      );
    return json(
      {
        code: 'INTERNAL_ERROR',
        message: 'Não foi possível concluir a operação. Consulte o terminal da aplicação',
      },
      500,
    );
  }
}
export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
