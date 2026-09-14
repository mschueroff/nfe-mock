import { z } from 'zod';

z.config(z.locales.pt());

export const UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;
export const UF_CODES: Record<string, string> = {
  RO: '11',
  AC: '12',
  AM: '13',
  RR: '14',
  PA: '15',
  AP: '16',
  TO: '17',
  MA: '21',
  PI: '22',
  CE: '23',
  RN: '24',
  PB: '25',
  PE: '26',
  AL: '27',
  SE: '28',
  BA: '29',
  MG: '31',
  ES: '32',
  RJ: '33',
  SP: '35',
  PR: '41',
  SC: '42',
  RS: '43',
  MS: '50',
  MT: '51',
  GO: '52',
  DF: '53',
};
export const TEST_NOTICE = 'DOCUMENTO DE TESTE - SEM VALOR FISCAL';
export const HOMOLOG_NAME = 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
export const digits = (s: string) => s.replace(/\D/g, '');
export function formatDocument(value: string, kind?: 'CPF' | 'CNPJ'): string {
  const document = digits(value).slice(0, kind === 'CPF' ? 11 : 14);
  if (kind === 'CPF' || (!kind && document.length <= 11))
    return document
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  return document
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\/\d{4})(\d{1,2})$/, '$1-$2');
}
export function validDocument(value: string, kind: 'CPF' | 'CNPJ'): boolean {
  const s = digits(value),
    n = kind === 'CPF' ? 11 : 14;
  if (s.length !== n || /^(\d)\1+$/.test(s)) return false;
  const calc = (part: string) => {
    const weights =
      kind === 'CPF'
        ? [...part].map((_, i) => part.length + 1 - i)
        : [...part].map((_, i) => ((part.length - 1 - i) % 8) + 2);
    const rem = [...part].reduce((sum, c, i) => sum + Number(c) * weights[i], 0) % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  return calc(s.slice(0, -2)) === Number(s.at(-2)) && calc(s.slice(0, -1)) === Number(s.at(-1));
}
const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => text(max).min(1, 'Campo obrigatório');
const documentText = z.string().regex(/^[\d.\-/\s]+$/, 'Informe documento numérico, sem letras');
const doc = (kind: 'CPF' | 'CNPJ') =>
  documentText
    .transform(digits)
    .refine((s) => validDocument(s, kind), `${kind} inválido (tamanho ou dígitos verificadores)`);
export const decimal = (places = 10) =>
  z
    .union([z.string(), z.number()])
    .transform(String)
    .refine(
      (s) => new RegExp(`^\\d{1,13}(\\.\\d{1,${places}})?$`).test(s),
      'Informe decimal não negativo, com ponto e sem separador de milhar',
    );
const optionalDecimal = z.union([z.literal(''), decimal()]).default('');
const integer = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
export const addressSchema = z
  .object({
    street: required(60),
    number: required(60),
    complement: text(60).default(''),
    district: required(60),
    cityCode: z.string().regex(/^\d{7}$/, 'Código IBGE deve ter 7 dígitos'),
    city: required(60),
    uf: z.enum(UFS),
    zip: z.string().transform(digits).pipe(z.string().length(8, 'CEP deve ter 8 dígitos')),
    countryCode: z.literal('1058').default('1058'),
    country: z.literal('BRASIL').default('BRASIL'),
    phone: z
      .string()
      .transform(digits)
      .refine((v) => !v || /^\d{6,14}$/.test(v), 'Telefone inválido')
      .default(''),
  })
  .refine((a) => a.cityCode.startsWith(UF_CODES[a.uf]), {
    path: ['cityCode'],
    message: 'Código IBGE incompatível com a UF',
  });
const ie = text(14).regex(/^\d{2,14}$/, 'IE deve ter de 2 a 14 dígitos; informe sem pontuação');
export const emitterSchema = z
  .object({
    corporateName: required(60).min(2),
    tradeName: text(60).default(''),
    cnpj: z.union([z.literal(''), doc('CNPJ')]).default(''),
    cpf: z.union([z.literal(''), doc('CPF')]).default(''),
    stateRegistration: ie,
    crt: z.enum(['1', '2', '3']),
    address: addressSchema,
    defaultSerie: integer(0, 999).default(1),
    initialNumber: integer(1, 999999999).default(1),
    environment: z.enum(['1', '2']).default('2'),
    numericCodeMode: z.enum(['SEQUENTIAL', 'RANDOM']).default('SEQUENTIAL'),
    defaultPurpose: z.enum(['1', '2', '3', '4']).default('1'),
    defaultEmission: z.literal('1').default('1'),
  })
  .superRefine((value, context) => {
    if (Boolean(value.cnpj) === Boolean(value.cpf))
      context.addIssue({
        code: 'custom',
        path: ['cnpj'],
        message: 'Informe exatamente um documento do emitente: CPF ou CNPJ',
      });
  });
export const recipientSchema = z
  .object({
    type: z.enum(['PJ', 'PF']),
    name: required(60).min(2),
    document: documentText.transform(digits),
    stateRegistration: z.union([z.literal(''), ie]).default(''),
    ieIndicator: z.enum(['1', '2', '9']).default('9'),
    address: addressSchema,
    email: z.union([z.literal(''), z.email().max(60)]).default(''),
  })
  .superRefine((v, c) => {
    if (!validDocument(v.document, v.type === 'PJ' ? 'CNPJ' : 'CPF'))
      c.addIssue({
        code: 'custom',
        path: ['document'],
        message: `${v.type === 'PF' ? 'CPF' : 'CNPJ'} inválido: confira o número e os dígitos verificadores`,
      });
    if (v.ieIndicator === '1' && !v.stateRegistration)
      c.addIssue({ code: 'custom', path: ['stateRegistration'], message: 'Contribuinte exige IE' });
    if (v.ieIndicator === '2' && v.stateRegistration)
      c.addIssue({
        code: 'custom',
        path: ['stateRegistration'],
        message: 'Destinatário isento não deve informar IE',
      });
  });
// One registry; emitter/recipient are roles of an entity in an invoice.
export const entitySchema = recipientSchema
  .safeExtend({
    tradeName: emitterSchema.shape.tradeName,
    crt: emitterSchema.shape.crt.default('1'),
    defaultSerie: integer(0, 999).optional(),
    initialNumber: emitterSchema.shape.initialNumber,
    environment: emitterSchema.shape.environment,
    numericCodeMode: emitterSchema.shape.numericCodeMode,
    defaultPurpose: emitterSchema.shape.defaultPurpose,
    defaultEmission: emitterSchema.shape.defaultEmission,
  })
  .transform((value) => ({
    ...value,
    defaultSerie: value.defaultSerie ?? (value.type === 'PF' ? 920 : 1),
  }));
export type Entity = z.infer<typeof entitySchema>;
export function entityFromEmitter(value: z.infer<typeof emitterSchema>): Entity {
  return entitySchema.parse({
    ...value,
    type: value.cpf ? 'PF' : 'PJ',
    name: value.corporateName,
    document: value.cpf || value.cnpj,
    ieIndicator: '1',
    email: '',
  });
}
export function entityAsEmitter(value: Entity) {
  return emitterSchema.parse({
    ...value,
    corporateName: value.name,
    cnpj: value.type === 'PJ' ? value.document : '',
    cpf: value.type === 'PF' ? value.document : '',
  });
}
export const ICMS_CODES = ['00', '10', '20', '40', '41', '50', '60'] as const;
export const SN_CODES = ['101', '102', '103', '201', '202', '203', '300', '400', '500'] as const;
export const CONTRIBUTION_CODES = [
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '49',
  '50',
  '51',
  '52',
  '53',
  '54',
  '55',
  '56',
  '60',
  '61',
  '62',
  '63',
  '64',
  '65',
  '66',
  '67',
  '70',
  '71',
  '72',
  '73',
  '74',
  '75',
  '98',
  '99',
] as const;
const rate = decimal(4).refine((v) => Number(v) <= 100, 'Alíquota deve ser até 100%');
export const contributionSchema = z.object({
  cst: z.enum(CONTRIBUTION_CODES).default('07'),
  rate: rate.default('0'),
  base: optionalDecimal,
  quantityBase: optionalDecimal,
  quantityRate: decimal(4).default('0'),
});
export const taxSchema = z.object({
  icms: z
    .object({
      cst: z.enum(ICMS_CODES).default('00'),
      csosn: z.enum(SN_CODES).default('102'),
      origin: integer(0, 8).default(0),
      rate: rate.default('0'),
      base: optionalDecimal,
      reduction: rate.default('0'),
      stBase: optionalDecimal,
      stRate: rate.default('0'),
      stMva: decimal(4).default('0'),
      creditRate: rate.default('0'),
      retainedBase: decimal(2).default('0'),
      retainedValue: decimal(2).default('0'),
      retainedRate: rate.default('0'),
      substituteValue: decimal(2).default('0'),
    })
    .default({
      cst: '00',
      csosn: '102',
      origin: 0,
      rate: '0',
      base: '',
      reduction: '0',
      stBase: '',
      stRate: '0',
      stMva: '0',
      creditRate: '0',
      retainedBase: '0',
      retainedValue: '0',
      retainedRate: '0',
      substituteValue: '0',
    }),
  pis: contributionSchema.default({
    cst: '07',
    rate: '0',
    base: '',
    quantityBase: '',
    quantityRate: '0',
  }),
  cofins: contributionSchema.default({
    cst: '07',
    rate: '0',
    base: '',
    quantityBase: '',
    quantityRate: '0',
  }),
  ipi: z
    .object({
      enabled: z.boolean().default(false),
      cst: z
        .enum(['00', '01', '02', '03', '04', '05', '49', '50', '51', '52', '53', '54', '55', '99'])
        .default('50'),
      enquiry: z
        .string()
        .regex(/^\d{3}$/)
        .default('999'),
      rate: rate.default('0'),
      base: optionalDecimal,
    })
    .default({ enabled: false, cst: '50', enquiry: '999', rate: '0', base: '' }),
});
export const cfopCodeSchema = z
  .string()
  .regex(/^[1256]\d{3}$/, 'CFOP nacional deve começar por 1, 2, 5 ou 6');
export const cfopSchema = z.object({ code: cfopCodeSchema, description: required(255) });
export const productSchema = z.object({
  code: required(60),
  description: required(120),
  gtin: text(14)
    .refine((v) => !v || /^\d{8}$|^\d{12,14}$/.test(v), 'GTIN deve ter 8, 12, 13 ou 14 dígitos')
    .default(''),
  ncm: z.string().regex(/^\d{8}$/, 'NCM deve ter 8 dígitos'),
  cest: z.union([z.literal(''), z.string().regex(/^\d{7}$/)]).default(''),
  unit: required(6),
  taxUnit: required(6),
  unitPrice: decimal(10),
  taxFactor: decimal(4)
    .refine((v) => Number(v) > 0)
    .default('1'),
  anp: z.literal('').default(''),
  additionalInfo: text(500).default(''),
  taxes: taxSchema,
});
export const itemSchema = productSchema.extend({
  cfop: cfopCodeSchema,
  productId: z.string().min(1),
  quantity: decimal(4).refine((v) => Number(v) > 0, 'Quantidade deve ser maior que zero'),
  discount: decimal(2).default('0'),
  freight: decimal(2).default('0'),
  insurance: decimal(2).default('0'),
  other: decimal(2).default('0'),
  taxQuantity: optionalDecimal,
  taxUnitPrice: optionalDecimal,
});
export const transportSchema = z
  .object({
    mode: z.enum(['0', '1', '2', '3', '4', '9']).default('9'),
    document: z
      .union([z.literal(''), documentText])
      .transform(digits)
      .default(''),
    name: text(60).default(''),
    stateRegistration: z.union([z.literal(''), ie]).default(''),
    address: text(60).default(''),
    city: text(60).default(''),
    uf: z.union([z.literal(''), z.enum(UFS)]).default(''),
    plate: z
      .string()
      .toUpperCase()
      .regex(/^$|^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/, 'Placa inválida')
      .default(''),
    plateUf: z.union([z.literal(''), z.enum(UFS)]).default(''),
    rntc: text(20).default(''),
    volumes: z
      .array(
        z
          .object({
            quantity: integer(0, 999999999).default(0),
            kind: text(60).default(''),
            brand: text(60).default(''),
            number: text(60).default(''),
            netWeight: decimal(3).default('0'),
            grossWeight: decimal(3).default('0'),
          })
          .refine((v) => Number(v.grossWeight) >= Number(v.netWeight), {
            path: ['grossWeight'],
            message: 'Peso bruto deve ser maior ou igual ao líquido',
          }),
      )
      .max(100)
      .default([]),
  })
  .superRefine((v, c) => {
    if (v.document && !validDocument(v.document, v.document.length === 11 ? 'CPF' : 'CNPJ'))
      c.addIssue({
        code: 'custom',
        path: ['document'],
        message: 'Documento da transportadora inválido',
      });
    if (v.plate && !v.plateUf)
      c.addIssue({ code: 'custom', path: ['plateUf'], message: 'Informe a UF da placa' });
  });
const timestamp = z.iso
  .datetime({
    offset: true,
    precision: 0,
    error: 'Data/hora inválida: use AAAA-MM-DDTHH:mm:ss-03:00',
  })
  .refine((v) => /[+-]\d{2}:\d{2}$/.test(v), 'Informe o deslocamento do fuso, por exemplo -03:00');
export const draftSchema = z
  .object({
    emitterId: z.string().min(1),
    recipientId: z.string().min(1),
    serie: integer(0, 999),
    manualNumber: z.union([z.literal(''), integer(1, 999999999)]).default(''),
    nature: required(60).default('Venda de mercadoria'),
    issueDate: timestamp,
    exitDate: z.union([z.literal(''), timestamp]).default(''),
    operation: z.enum(['0', '1']).default('1'),
    destination: z.enum(['1', '2']).default('1'),
    cityCode: z.string().regex(/^\d{7}$/),
    purpose: z.enum(['1', '2', '3', '4']).default('1'),
    finalConsumer: z.enum(['0', '1']).default('0'),
    presence: z.enum(['0', '1', '2', '3', '4', '5', '9']).default('9'),
    environment: z.enum(['1', '2']).default('2'),
    emission: z.literal('1').default('1'),
    printType: z.literal('1').default('1'),
    referenceKeys: z
      .array(z.string().regex(/^\d{44}$/))
      .max(500)
      .default([]),
    items: z.array(itemSchema).min(1, 'Adicione um produto').max(990),
    transport: transportSchema,
    payment: z
      .object({
        method: z.enum(['01', '15', '16', '17', '18', '90', '99']).default('01'),
        description: text(60).default(''),
      })
      .default({ method: '01', description: '' }),
    additionalInfo: text(1800).default(''),
    fiscalInfo: text(2000).default(''),
    sourceInvoiceId: z.string().optional(),
  })
  .superRefine((v, c) => {
    if (['2', '4'].includes(v.purpose) && !v.referenceKeys.length)
      c.addIssue({
        code: 'custom',
        path: ['referenceKeys'],
        message: 'Complementação/devolução exige chave referenciada',
      });
    if (v.payment.method === '99' && v.payment.description.length < 2)
      c.addIssue({
        code: 'custom',
        path: ['payment.description'],
        message: 'Descreva a forma de pagamento',
      });
    if (v.destination === '2' && v.finalConsumer === '1')
      c.addIssue({
        code: 'custom',
        path: ['finalConsumer'],
        message: 'Operação interestadual a consumidor final (DIFAL) fora do perfil inicial',
      });
  });
export const settingsSchema = z.object({
  storageDirectory: z.string().min(1).default(''),
  environment: z.enum(['1', '2']).default('2'),
  numericCodeMode: z.enum(['SEQUENTIAL', 'RANDOM']).default('SEQUENTIAL'),
  openDanfe: z.boolean().default(false),
  prettyXml: z.boolean().default(true),
  validateXsd: z.boolean().default(true),
});
export type Emitter = z.infer<typeof emitterSchema>;
export type Recipient = z.infer<typeof recipientSchema>;
export type Product = z.infer<typeof productSchema>;
export type Item = z.infer<typeof itemSchema>;
export type Draft = z.infer<typeof draftSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type CatalogRow<T> = T & {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
export function localTimestamp(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}${offset < 0 ? '-' : '+'}${p(Math.floor(Math.abs(offset) / 60))}:${p(Math.abs(offset) % 60)}`;
}
