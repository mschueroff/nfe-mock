import type { NFeProps } from '@brasil-fiscal/nfe';
import { XMLValidator, XMLParser, XMLBuilder } from 'fast-xml-parser';
import { DefaultXmlBuilder } from './vendor/DefaultXmlBuilder';
import type { FiscalDocument } from './document';
import { TEST_NOTICE } from '../../shared/contracts';
import { AppError } from '../errors';
export interface XmlGenerator {
  generate(document: FiscalDocument, pretty: boolean): string;
}
export class XmlGeneratorService implements XmlGenerator {
  generate(d: FiscalDocument, pretty = true): string {
    const address = (a: FiscalDocument['emitter']['address']) => ({
      logradouro: a.street,
      numero: a.number,
      complemento: a.complement,
      bairro: a.district,
      codigoMunicipio: a.cityCode,
      municipio: a.city,
      uf: a.uf,
      cep: a.zip,
      codigoPais: a.countryCode,
      pais: a.country,
      telefone: a.phone,
    });
    const { draft: v, emitter: e, recipient: r } = d;
    const data: NFeProps = {
      identificacao: {
        naturezaOperacao: v.nature,
        tipoOperacao: Number(v.operation) as 0 | 1,
        destinoOperacao: Number(v.destination) as 1 | 2,
        finalidade: Number(v.purpose) as 1 | 2 | 3 | 4,
        consumidorFinal: Number(v.finalConsumer) as 0 | 1,
        presencaComprador: Number(v.presence) as 9,
        uf: e.address.uf,
        municipio: v.cityCode,
        serie: v.serie,
        numero: d.number,
        ambiente: Number(v.environment) as 1 | 2,
        dataEmissao: new Date(v.issueDate),
      },
      emitente: {
        cnpj: e.cnpj,
        razaoSocial: e.corporateName,
        nomeFantasia: e.tradeName || undefined,
        inscricaoEstadual: e.stateRegistration,
        regimeTributario: Number(e.crt) as 1 | 2 | 3,
        endereco: address(e.address),
      },
      destinatario: {
        ...(r.type === 'PJ' ? { cnpj: r.document } : { cpf: r.document }),
        nome: r.name,
        indicadorIE: Number(r.ieIndicator) as 1 | 2 | 9,
        inscricaoEstadual: r.stateRegistration || undefined,
        endereco: address(r.address),
        email: r.email || undefined,
      },
      produtos: [],
      transporte: {
        modalidadeFrete: Number(v.transport.mode) as 9,
        cnpjTransportadora: v.transport.document || undefined,
        nomeTransportadora: v.transport.name || undefined,
        inscricaoEstadual: v.transport.stateRegistration || undefined,
        endereco: v.transport.address || undefined,
        municipio: v.transport.city || undefined,
        uf: v.transport.uf || undefined,
        veiculo: v.transport.plate
          ? {
              placa: v.transport.plate,
              uf: v.transport.plateUf,
              rntc: v.transport.rntc || undefined,
            }
          : undefined,
        volumes: v.transport.volumes.map((x) => ({
          quantidade: x.quantity,
          especie: x.kind || undefined,
          marca: x.brand || undefined,
          numeracao: x.number || undefined,
          pesoLiquido: Number(x.netWeight),
          pesoBruto: Number(x.grossWeight),
        })),
      },
      pagamento: {
        pagamentos: [
          {
            formaPagamento: v.payment.method,
            valor: v.payment.method === '90' ? 0 : Number(d.totals.total),
          },
        ],
      },
      informacoesComplementares:
        `${TEST_NOTICE}. XML NAO ASSINADO E NAO AUTORIZADO. ${v.additionalInfo}`.trim(),
      informacoesFisco: v.fiscalInfo || undefined,
    };
    let xml = new DefaultXmlBuilder().build(data, d);
    if (v.payment.method === '99')
      xml = xml.replace(
        '<tPag>99</tPag>',
        `<tPag>99</tPag><xPag>${v.payment.description.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</xPag>`,
      );
    // Mandatory payment value comes from decimal totals, not a Number conversion.
    xml = xml.replace(
      /<vPag>[^<]*<\/vPag>/,
      `<vPag>${v.payment.method === '90' ? '0.00' : d.totals.total}</vPag>`,
    );
    const valid = XMLValidator.validate(xml);
    if (valid !== true) throw new AppError('INVALID_XML', valid.err.msg);
    if (pretty) {
      const options = {
        preserveOrder: true,
        ignoreAttributes: false,
        parseTagValue: false,
        parseAttributeValue: false,
        trimValues: false,
      };
      xml = new XMLBuilder({
        ...options,
        format: true,
        indentBy: '  ',
        suppressEmptyNode: false,
      }).build(new XMLParser(options).parse(xml));
    }
    return xml;
  }
}
