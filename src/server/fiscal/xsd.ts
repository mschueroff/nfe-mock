import { readFileSync } from 'node:fs';
import path from 'node:path';
import { validateXML } from 'xmllint-wasm';
import { AppError } from '../errors';
export const SCHEMA_PROFILE = 'PL_009_V4-fd0c1228-unsigned-test-v1';
export async function validateXsd(xml: string, official = false) {
  const root = path.resolve('schemas/original');
  const preload = [
    'leiauteNFe_v4.00.xsd',
    'tiposBasico_v4.00.xsd',
    'xmldsig-core-schema_v1.01.xsd',
  ].map((fileName) => {
    let contents = readFileSync(path.join(root, fileName), 'utf8');
    if (!official && fileName === 'leiauteNFe_v4.00.xsd') {
      const needle = '<xs:element ref="ds:Signature"/>';
      if (contents.split(needle).length !== 2)
        throw new AppError(
          'SCHEMA_CHANGED',
          'Schema alterado: não foi possível criar o perfil sem assinatura',
          500,
        );
      contents = contents.replace(needle, '<xs:element ref="ds:Signature" minOccurs="0"/>');
    }
    return { fileName, contents };
  });
  const result = await validateXML({
    xml: [{ fileName: 'nfe.xml', contents: xml }],
    schema: [readFileSync(path.join(root, 'nfe_v4.00.xsd'), 'utf8')],
    preload,
    maxMemoryPages: 1024,
  });
  return result;
}
export async function requireValidXsd(xml: string) {
  const result = await validateXsd(xml);
  if (!result.valid) {
    const fields: Record<string, string> = {};
    for (const error of result.errors) {
      const field = error.message.match(/Element '\{[^}]+\}([^']+)'/)?.[1] || 'XML';
      fields[field] = error.message;
    }
    throw new AppError(
      'INVALID_XSD',
      'XML incompatível com o perfil de teste sem assinatura',
      422,
      fields,
    );
  }
}
