'use client';
import { useState } from 'react';
import {
  ICMS_CODES,
  SN_CODES,
  CONTRIBUTION_CODES,
  UFS,
  digits,
  formatDocument,
  validDocument,
} from '../shared/contracts';
export type Field = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'textarea' | 'checkbox' | 'select' | 'document' | 'datetime-local';
  options?: readonly (string | { value: string; label: string })[];
  hint?: string;
  required?: boolean;
  wide?: boolean;
};
function localDateTimeValue(value: string) {
  return value ? value.slice(0, 19) : '';
}
function timestampWithLocalOffset(value: string) {
  if (!value) return '';
  const date = new Date(value),
    offset = -date.getTimezoneOffset(),
    pad = (part: number) => String(part).padStart(2, '0');
  return (
    `${value}:00`.slice(0, 19) +
    `${offset < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`
  );
}
export const get = (object: any, key: string): any =>
  key.split('.').reduce((o, k) => o?.[k], object);
export function change(object: any, key: string, value: any) {
  const next = structuredClone(object);
  const keys = key.split('.');
  let target = next;
  for (const k of keys.slice(0, -1)) {
    target[k] ??= {};
    target = target[k];
  }
  target[keys.at(-1)!] = value;
  return next;
}
export function Fields({
  fields,
  value,
  onChange,
  errors = {},
  prefix = '',
}: {
  fields: Field[];
  value: any;
  onChange: (next: any) => void;
  errors?: Record<string, string>;
  prefix?: string;
}) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  return (
    <div className="fields">
      {fields.map((f) => {
        const val = get(value, f.key) ?? '',
          name = prefix + f.key,
          document = f.type === 'document' ? digits(String(val)) : '',
          documentKind =
            f.key === 'cnpj'
              ? 'CNPJ'
              : get(value, 'type') === 'PF'
                ? 'CPF'
                : get(value, 'type') === 'PJ'
                  ? 'CNPJ'
                  : document.length <= 11
                    ? 'CPF'
                    : 'CNPJ',
          documentError =
            f.type === 'document' &&
            touched[name] &&
            !!document &&
            !validDocument(document, documentKind)
              ? `${documentKind} inválido: confira o número e os dígitos verificadores`
              : '',
          error = errors[name] || documentError;
        const attrs = {
          id: name,
          name,
          disabled: false,
          'aria-invalid': !!error,
          'aria-describedby': error ? name + '-error' : undefined,
          required: f.required,
        };
        return (
          <div className={'field ' + (f.wide ? 'wide' : '')} key={f.key}>
            <label htmlFor={name}>
              {f.label}
              {f.required && <span className="required"> *</span>}
            </label>
            {f.type === 'checkbox' ? (
              <label className="check">
                <input
                  {...attrs}
                  type="checkbox"
                  checked={!!val}
                  onChange={(e) => onChange(change(value, f.key, e.target.checked))}
                />
                <span>{f.hint || 'Ativado'}</span>
              </label>
            ) : f.type === 'select' ? (
              <select
                {...attrs}
                value={val}
                onChange={(e) => onChange(change(value, f.key, e.target.value))}
              >
                {f.options?.map((o) => {
                  const v = typeof o === 'string' ? o : o.value;
                  return (
                    <option value={v} key={v}>
                      {typeof o === 'string' ? o : o.label}
                    </option>
                  );
                })}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea
                {...attrs}
                value={val}
                rows={3}
                onChange={(e) => onChange(change(value, f.key, e.target.value))}
              />
            ) : f.type === 'document' ? (
              <input
                {...attrs}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={18}
                value={formatDocument(String(val), documentKind)}
                onBlur={() => setTouched((current) => ({ ...current, [name]: true }))}
                onChange={(e) => {
                  setTouched((current) => ({ ...current, [name]: false }));
                  onChange(change(value, f.key, formatDocument(e.target.value, documentKind)));
                }}
              />
            ) : f.type === 'datetime-local' ? (
              <input
                {...attrs}
                type="datetime-local"
                step="1"
                value={localDateTimeValue(String(val))}
                onChange={(e) =>
                  onChange(change(value, f.key, timestampWithLocalOffset(e.target.value)))
                }
              />
            ) : (
              <input
                {...attrs}
                type={f.type === 'number' ? 'number' : 'text'}
                step="any"
                value={val}
                onChange={(e) => onChange(change(value, f.key, e.target.value))}
              />
            )}
            {f.hint && f.type !== 'checkbox' && <small>{f.hint}</small>}
            {error && (
              <small className="error-text" id={name + '-error'}>
                {error}
              </small>
            )}
          </div>
        );
      })}
    </div>
  );
}
export const addressFields: Field[] = [
  { key: 'address.street', label: 'Logradouro', required: true },
  { key: 'address.number', label: 'Número', required: true },
  { key: 'address.complement', label: 'Complemento' },
  { key: 'address.district', label: 'Bairro', required: true },
  { key: 'address.cityCode', label: 'Código IBGE do município', required: true },
  { key: 'address.city', label: 'Município', required: true },
  { key: 'address.uf', label: 'UF', type: 'select', options: UFS },
  { key: 'address.zip', label: 'CEP', required: true },
  { key: 'address.countryCode', label: 'Código do país', type: 'select', options: ['1058'] },
  { key: 'address.country', label: 'País', type: 'select', options: ['BRASIL'] },
  { key: 'address.phone', label: 'Telefone' },
];
export const emitterFields: Field[] = [
  { key: 'corporateName', label: 'Razão social', required: true },
  { key: 'tradeName', label: 'Nome fantasia' },
  { key: 'cnpj', label: 'CNPJ', type: 'document', required: true },
  { key: 'stateRegistration', label: 'Inscrição estadual', required: true },
  {
    key: 'crt',
    label: 'Regime tributário',
    type: 'select',
    options: [
      { value: '1', label: '1 - Simples Nacional' },
      { value: '2', label: '2 - Simples, excesso de sublimite' },
      { value: '3', label: '3 - Regime normal' },
    ],
  },
];
export const emitterDefaults: Field[] = [
  { key: 'defaultSerie', label: 'Série padrão', type: 'number' },
  {
    key: 'initialNumber',
    label: 'Número inicial (para série nova)',
    type: 'number',
    hint: 'Para uma série existente, use Alterar próximo número.',
  },
  {
    key: 'environment',
    label: 'Ambiente padrão',
    type: 'select',
    options: [
      { value: '2', label: 'Homologação (2)' },
      { value: '1', label: 'Produção offline (1)' },
    ],
  },
  {
    key: 'numericCodeMode',
    label: 'Código numérico (cNF)',
    type: 'select',
    options: [
      { value: 'SEQUENTIAL', label: 'Sequencial' },
      { value: 'RANDOM', label: 'Aleatório' },
    ],
  },
  {
    key: 'defaultPurpose',
    label: 'Finalidade padrão',
    type: 'select',
    options: [
      { value: '1', label: 'Normal' },
      { value: '2', label: 'Complementar' },
      { value: '3', label: 'Ajuste' },
      { value: '4', label: 'Devolução' },
    ],
  },
  {
    key: 'defaultEmission',
    label: 'Tipo de emissão',
    type: 'select',
    options: [{ value: '1', label: 'Normal (1)' }],
  },
];
export const recipientFields: Field[] = [
  {
    key: 'type',
    label: 'Tipo',
    type: 'select',
    options: [
      { value: 'PJ', label: 'Pessoa jurídica' },
      { value: 'PF', label: 'Pessoa física' },
    ],
  },
  { key: 'name', label: 'Nome / razão social', required: true },
  { key: 'document', label: 'CNPJ / CPF', type: 'document', required: true },
  {
    key: 'ieIndicator',
    label: 'Indicador da IE',
    type: 'select',
    options: [
      { value: '1', label: '1 - Contribuinte' },
      { value: '2', label: '2 - Isento' },
      { value: '9', label: '9 - Não contribuinte' },
    ],
  },
  { key: 'stateRegistration', label: 'Inscrição estadual' },
  { key: 'email', label: 'E-mail' },
];
export const entityFields: Field[] = [
  ...recipientFields,
  { key: 'tradeName', label: 'Nome fantasia' },
  ...emitterFields.filter((field) => field.key === 'crt'),
];
export const productFields: Field[] = [
  { key: 'code', label: 'Código interno', required: true },
  { key: 'description', label: 'Descrição', required: true },
  { key: 'ncm', label: 'NCM', required: true },
  { key: 'unit', label: 'Unidade comercial', required: true },
  { key: 'unitPrice', label: 'Valor unitário (R$)', type: 'number', required: true },
  { key: 'gtin', label: 'GTIN / EAN', hint: 'Vazio será SEM GTIN.' },
  { key: 'cest', label: 'CEST' },
  { key: 'taxUnit', label: 'Unidade tributável', required: true },
  {
    key: 'taxFactor',
    label: 'Fator da unidade tributável',
    type: 'number',
    hint: 'Quantidade tributável = quantidade × fator.',
  },
  { key: 'additionalInfo', label: 'Informações do produto', type: 'textarea', wide: true },
];
export function TaxFields({
  value,
  onChange,
  errors = {},
  crt,
  prefix = '',
}: {
  value: any;
  onChange: (v: any) => void;
  errors?: Record<string, string>;
  crt?: string;
  prefix?: string;
}) {
  const c = value.taxes?.icms || {},
    code = crt === '1' ? c.csosn : c.cst;
  const all = crt === undefined;
  const fields: Field[] = [
    {
      key: 'taxes.icms.origin',
      label: 'Origem da mercadoria',
      type: 'select',
      options: ['0', '1', '2', '3', '4', '5', '6', '7', '8'],
    },
  ];
  if (all || crt !== '1')
    fields.push({ key: 'taxes.icms.cst', label: 'CST ICMS', type: 'select', options: ICMS_CODES });
  if (all || crt === '1')
    fields.push({ key: 'taxes.icms.csosn', label: 'CSOSN', type: 'select', options: SN_CODES });
  if (all || ['00', '10', '20'].includes(code))
    fields.push(
      { key: 'taxes.icms.rate', label: 'Alíquota ICMS (%)', type: 'number' },
      {
        key: 'taxes.icms.base',
        label: 'Base ICMS (R$)',
        type: 'number',
        hint: 'Vazio: calcular a partir do item.',
      },
    );
  if (all || code === '20')
    fields.push({ key: 'taxes.icms.reduction', label: 'Redução da base (%)', type: 'number' });
  if (all || ['10', '201', '202', '203'].includes(code))
    fields.push(
      {
        key: 'taxes.icms.stBase',
        label: 'Base ICMS ST (R$)',
        type: 'number',
        hint: 'Vazio: base do item acrescida da MVA.',
      },
      { key: 'taxes.icms.stRate', label: 'Alíquota ST (%)', type: 'number' },
      { key: 'taxes.icms.stMva', label: 'MVA (%)', type: 'number' },
    );
  if (all || ['101', '201'].includes(code))
    fields.push({ key: 'taxes.icms.creditRate', label: 'Crédito Simples (%)', type: 'number' });
  if (all || ['60', '500'].includes(code))
    fields.push(
      { key: 'taxes.icms.retainedBase', label: 'Base retida ST (R$)', type: 'number' },
      { key: 'taxes.icms.retainedValue', label: 'ICMS retido ST (R$)', type: 'number' },
      { key: 'taxes.icms.retainedRate', label: 'Alíquota retida ST (%)', type: 'number' },
      { key: 'taxes.icms.substituteValue', label: 'ICMS do substituto (R$)', type: 'number' },
    );
  for (const name of ['pis', 'cofins']) {
    const t = value.taxes?.[name] || {};
    fields.push({
      key: `taxes.${name}.cst`,
      label: `CST ${name.toUpperCase()}`,
      type: 'select',
      options: CONTRIBUTION_CODES,
    });
    if (t.cst === '03')
      fields.push(
        {
          key: `taxes.${name}.quantityBase`,
          label: `Quantidade base ${name.toUpperCase()}`,
          type: 'number',
        },
        {
          key: `taxes.${name}.quantityRate`,
          label: `Valor por unidade ${name.toUpperCase()}`,
          type: 'number',
        },
      );
    else if (!['04', '05', '06', '07', '08', '09'].includes(t.cst))
      fields.push(
        { key: `taxes.${name}.rate`, label: `Alíquota ${name.toUpperCase()} (%)`, type: 'number' },
        { key: `taxes.${name}.base`, label: `Base ${name.toUpperCase()} (R$)`, type: 'number' },
      );
  }
  fields.push({
    key: 'taxes.ipi.enabled',
    label: 'IPI',
    type: 'checkbox',
    hint: 'Incluir grupo de IPI',
  });
  if (value.taxes?.ipi?.enabled)
    fields.push(
      {
        key: 'taxes.ipi.cst',
        label: 'CST IPI',
        type: 'select',
        options: [
          '00',
          '01',
          '02',
          '03',
          '04',
          '05',
          '49',
          '50',
          '51',
          '52',
          '53',
          '54',
          '55',
          '99',
        ],
      },
      { key: 'taxes.ipi.enquiry', label: 'Enquadramento IPI' },
      { key: 'taxes.ipi.rate', label: 'Alíquota IPI (%)', type: 'number' },
      { key: 'taxes.ipi.base', label: 'Base IPI (R$)', type: 'number' },
    );
  return (
    <Fields fields={fields} value={value} onChange={onChange} errors={errors} prefix={prefix} />
  );
}

export const cfopFields: Field[] = [
  {
    key: 'code',
    label: 'Código CFOP',
    required: true,
    hint: 'Quatro dígitos. Operações nacionais: 1, 2, 5 ou 6 no início.',
  },
  { key: 'description', label: 'Descrição da operação', required: true },
];
