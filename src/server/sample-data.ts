import { taxSchema } from '../shared/contracts';
// Identificadores matematicamente válidos, gerados de bases artificiais e
// usados exclusivamente como fixtures. Nenhum valor foi copiado de terceiros.
function cnpj(base: string) {
  let result = base;
  for (let round = 0; round < 2; round++) {
    const sum = [...result].reduce(
      (s, n, i) => s + Number(n) * (((result.length - 1 - i) % 8) + 2),
      0,
    );
    const rem = sum % 11;
    result += rem < 2 ? '0' : String(11 - rem);
  }
  return result;
}
function cpf(base: string) {
  let result = base;
  for (let round = 0; round < 2; round++) {
    const sum = [...result].reduce(
      (total, digit, index) => total + Number(digit) * (result.length + 1 - index),
      0,
    );
    const remainder = (sum * 10) % 11;
    result += String(remainder === 10 ? 0 : remainder);
  }
  return result;
}
export const SYNTHETIC_TEST_CPF = cpf('910000001');
export const SYNTHETIC_TEST_CNPJ = cnpj('930000000001');
const address = {
  street: 'Rua de Teste',
  number: '100',
  complement: '',
  district: 'Centro',
  cityCode: '5103403',
  city: 'Cuiabá',
  uf: 'MT',
  zip: '78005000',
  countryCode: '1058',
  country: 'BRASIL',
  phone: '',
};
export const sampleEmitter = {
  corporateName: 'EMPRESA TESTE LTDA',
  tradeName: 'FAZENDA DE TESTE',
  cnpj: cnpj('910000000001'),
  stateRegistration: '131234567',
  crt: '1',
  address,
  defaultSerie: 1,
  initialNumber: 1000,
  environment: '2',
  numericCodeMode: 'SEQUENTIAL',
  defaultPurpose: '1',
  defaultEmission: '1',
};
export const sampleRecipient = {
  type: 'PJ',
  name: 'COOPERATIVA TESTE LTDA',
  document: cnpj('920000000001'),
  stateRegistration: '',
  ieIndicator: '9',
  address: { ...address, street: 'Avenida de Teste', number: '200' },
  email: '',
};
export const sampleProduct = {
  code: 'SOJA',
  description: 'SOJA EM GRÃOS',
  gtin: '',
  ncm: '12019000',
  cest: '',
  unit: 'KG',
  taxUnit: 'KG',
  unitPrice: '2.10',
  taxFactor: '1',
  anp: '',
  additionalInfo: 'PRODUTO FICTICIO PARA TESTES',
  taxes: taxSchema.parse({}),
};

export const sampleCfop = { code: '5102', description: 'CFOP 5102 — cenário de teste' };
