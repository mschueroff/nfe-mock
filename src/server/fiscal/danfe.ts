import type { FiscalDocument } from './document';
import { DanfeGenerator } from './vendor/DanfeGenerator';
import { parseNFeXml } from './vendor/xml-parser';
import Decimal from 'decimal.js';
export interface DanfeGeneratorAdapter {
  generate(xml: string, document: FiscalDocument): Promise<Buffer>;
}
export class DanfeGeneratorService implements DanfeGeneratorAdapter {
  async generate(xml: string, document: FiscalDocument) {
    const data = parseNFeXml(xml);
    const volumes = document.draft.transport.volumes;
    const extras =
      volumes.length > 1
        ? '\nVOLUMES: ' +
          volumes
            .map(
              (v, i) =>
                `${i + 1}: ${v.quantity} ${v.kind}, marca ${v.brand || '-'}, num. ${v.number || '-'}, liquido ${v.netWeight} kg, bruto ${v.grossWeight} kg`,
            )
            .join('; ')
        : '';
    const aggregate =
      volumes.length > 1
        ? {
            quantidade: String(volumes.reduce((sum, v) => sum + v.quantity, 0)),
            pesoLiquido: volumes
              .reduce((sum, v) => sum.plus(v.netWeight), new Decimal(0))
              .toFixed(3),
            pesoBruto: volumes
              .reduce((sum, v) => sum.plus(v.grossWeight), new Decimal(0))
              .toFixed(3),
            especie: 'DIVERSOS (VER ANEXO)',
            marca: '',
            numeracao: '',
          }
        : {};
    return new DanfeGenerator().generate({
      ...data,
      transporte: { ...data.transporte, ...aggregate },
      informacoesComplementares: (data.informacoesComplementares || '') + extras,
    });
  }
}
