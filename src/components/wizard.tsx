'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Decimal from 'decimal.js';
import {
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Check,
  Building2,
  Users,
  Package,
  FileCheck2,
  Truck,
  FlaskConical,
  LoaderCircle,
} from 'lucide-react';
import { Button } from './ui/button';
import { Fields, TaxFields, productFields, type Field } from './forms';
import { ApiError, api, ErrorBox, Empty, currency, Totals } from './workspace';
import { formatDocument, localTimestamp, transportSchema, UFS } from '../shared/contracts';
const steps = ['Emitente', 'Destinatário', 'Dados da nota', 'Produtos', 'Transporte', 'Revisão'];
const icons = [Building2, Users, FileCheck2, Package, Truck, Check];
const initial = () => ({
  emitterId: '',
  recipientId: '',
  serie: 1,
  manualNumber: '',
  nature: 'Venda de mercadoria',
  issueDate: localTimestamp(),
  exitDate: '',
  operation: '1',
  destination: '1',
  cityCode: '',
  purpose: '1',
  finalConsumer: '0',
  presence: '9',
  environment: '2',
  emission: '1',
  printType: '1',
  referenceKeys: [],
  items: [],
  transport: transportSchema.parse({}),
  payment: { method: '01', description: '' },
  additionalInfo: '',
  fiscalInfo: '',
});
export function InvoiceWizard() {
  const router = useRouter(),
    requestId = useRef('');
  const [catalog, setCatalog] = useState<any>(null),
    [draft, setDraft] = useState<any>(initial),
    [operationCfop, setOperationCfop] = useState(''),
    [step, setStep] = useState(0),
    [error, setError] = useState<ApiError | null>(null),
    [preview, setPreview] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [calculating, setCalculating] = useState(false),
    [sequence, setSequence] = useState<any>(null);
  const emitter = catalog?.emitters.find((x: any) => x.id === draft.emitterId),
    recipient = catalog?.recipients.find((x: any) => x.id === draft.recipientId);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [entities, products, cfops, settings] = await Promise.all(
          ['entities', 'products', 'cfops', 'settings'].map((x) => api(x)),
        );
        if (cancelled) return;
        const emitters = entities
          .filter((entity: any) => entity.stateRegistration)
          .map((entity: any) => ({
            ...entity,
            corporateName: entity.name,
            cnpj: entity.document,
            defaultSerie:
              entity.type === 'PF' && entity.defaultSerie < 920 ? 920 : entity.defaultSerie,
          }));
        const recipients = entities;
        setCatalog({ entities, emitters, recipients, products, cfops, settings });
        const query = new URLSearchParams(window.location.search),
          source = query.get('substitute') || query.get('duplicate');
        if (source) {
          const copy = await api(
            `invoices/${source}/duplicate?substitute=${query.has('substitute')}`,
          );
          if (!cancelled) {
            setDraft(copy);
            setOperationCfop(copy.items[0]?.cfop || '');
          }
        } else {
          const pending = sessionStorage.getItem('nfe-mock-pending');
          if (pending) {
            const saved = JSON.parse(pending);
            setDraft(saved.draft);
            setOperationCfop(saved.draft.items[0]?.cfop || '');
            requestId.current = saved.requestId;
          } else if (emitters.length) {
            const e = emitters[0],
              r = recipients.find((entity: any) => entity.id !== e.id) || recipients[0];
            setDraft({
              ...initial(),
              emitterId: e.id,
              recipientId: r?.id || '',
              serie: e.defaultSerie,
              cityCode: e.address.cityCode,
              environment: e.environment,
              purpose: e.defaultPurpose,
              destination: r && r.address.uf !== e.address.uf ? '2' : '1',
            });
          }
        }
      } catch (e) {
        if (!cancelled) setError(e as ApiError);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    setSequence(null);
    if (draft.emitterId)
      api(`sequences/${draft.emitterId}?serie=${draft.serie}`)
        .then(setSequence)
        .catch(() => {});
  }, [draft.emitterId, draft.serie]);
  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    if (!draft.emitterId || !draft.recipientId || !draft.items.length) return;
    const timer = setTimeout(() => {
      setCalculating(true);
      api('invoices/preview', 'POST', draft)
        .then((v) => {
          if (!cancelled) setPreview(v);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setCalculating(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft]);
  function update(next: any) {
    setDraft(next);
    requestId.current = '';
    sessionStorage.removeItem('nfe-mock-pending');
    setError(null);
  }
  function chooseEmitter(id: string) {
    const e = catalog.emitters.find((x: any) => x.id === id);
    if (e)
      update({
        ...draft,
        emitterId: id,
        serie: e.defaultSerie,
        cityCode: e.address.cityCode,
        environment: e.environment,
        purpose: e.defaultPurpose,
        destination: recipient && recipient.address.uf !== e.address.uf ? '2' : '1',
      });
  }
  function chooseRecipient(id: string) {
    const r = catalog.recipients.find((x: any) => x.id === id);
    update({
      ...draft,
      recipientId: id,
      destination: emitter && r && r.address.uf !== emitter.address.uf ? '2' : '1',
    });
  }
  function itemUpdate(index: number, value: any) {
    update({ ...draft, items: draft.items.map((x: any, i: number) => (i === index ? value : x)) });
  }
  function addProduct(id: string) {
    const p = catalog.products.find((x: any) => x.id === id);
    if (p)
      update({
        ...draft,
        items: [
          ...draft.items,
          {
            ...p,
            productId: p.id,
            cfop: operationCfop,
            quantity: '1',
            discount: '0',
            freight: '0',
            insurance: '0',
            other: '0',
            taxQuantity: '',
            taxUnitPrice: '',
          },
        ],
      });
  }
  async function next() {
    setError(null);
    if (step === 0 && !emitter) {
      setError(new ApiError('Selecione um emitente'));
      return;
    }
    if (step === 1 && !recipient) {
      setError(new ApiError('Selecione um destinatário'));
      return;
    }
    if (step === 3 && !draft.items.length) {
      setError(new ApiError('Adicione ao menos um produto'));
      return;
    }
    if (step === 4) {
      setBusy(true);
      try {
        setPreview(await api('invoices/preview', 'POST', draft));
        setStep(5);
      } catch (e) {
        setError(e as ApiError);
      } finally {
        setBusy(false);
      }
    } else setStep((s) => s + 1);
  }
  async function generate() {
    setBusy(true);
    setError(null);
    requestId.current ||= crypto.randomUUID();
    sessionStorage.setItem(
      'nfe-mock-pending',
      JSON.stringify({ requestId: requestId.current, draft }),
    );
    try {
      const result = await api('invoices', 'POST', draft, { 'Idempotency-Key': requestId.current });
      sessionStorage.removeItem('nfe-mock-pending');
      router.push('/invoices/' + result.id + (catalog.settings.openDanfe ? '?tab=DANFE' : ''));
    } catch (e) {
      setError(e as ApiError);
      setBusy(false);
    }
  }
  const fields: Field[] = [
    { key: 'serie', label: 'Série', type: 'number' },
    {
      key: 'manualNumber',
      label: 'Número da NF-e',
      type: 'number',
      hint: 'Vazio = automático. O número é reservado somente ao gerar.',
    },
    { key: 'nature', label: 'Natureza da operação', required: true },
    {
      key: 'issueDate',
      label: 'Data/hora de emissão',
      type: 'datetime-local',
      required: true,
      hint: 'Use o seletor do navegador. O fuso local é incluído automaticamente.',
    },
    {
      key: 'exitDate',
      label: 'Data/hora de saída ou entrada',
      type: 'datetime-local',
      hint: 'Opcional. Use o seletor de data e hora.',
    },
    {
      key: 'operation',
      label: 'Tipo de operação',
      type: 'select',
      options: [
        { value: '1', label: 'Saída' },
        { value: '0', label: 'Entrada' },
      ],
    },
    {
      key: 'destination',
      label: 'Destino da operação',
      type: 'select',
      options: [
        { value: '1', label: 'Interna' },
        { value: '2', label: 'Interestadual' },
      ],
    },
    { key: 'cityCode', label: 'Município de ocorrência (IBGE)', required: true },
    {
      key: 'purpose',
      label: 'Finalidade',
      type: 'select',
      options: [
        { value: '1', label: 'Normal' },
        { value: '2', label: 'Complementar' },
        { value: '3', label: 'Ajuste' },
        { value: '4', label: 'Devolução' },
      ],
    },
    {
      key: 'finalConsumer',
      label: 'Consumidor final',
      type: 'select',
      options: [
        { value: '0', label: 'Não' },
        { value: '1', label: 'Sim' },
      ],
    },
    {
      key: 'presence',
      label: 'Presença do comprador',
      type: 'select',
      options: [
        { value: '0', label: 'Não se aplica' },
        { value: '1', label: 'Presencial' },
        { value: '2', label: 'Internet' },
        { value: '3', label: 'Teleatendimento' },
        { value: '4', label: 'Entrega em domicílio' },
        { value: '5', label: 'Presencial fora do estabelecimento' },
        { value: '9', label: 'Outros' },
      ],
    },
    {
      key: 'environment',
      label: 'Ambiente do XML',
      type: 'select',
      options: [
        { value: '2', label: 'Homologação (2)' },
        { value: '1', label: 'Produção offline (1)' },
      ],
    },
    {
      key: 'emission',
      label: 'Tipo de emissão',
      type: 'select',
      options: [{ value: '1', label: 'Normal (1)' }],
    },
    {
      key: 'printType',
      label: 'Tipo de impressão',
      type: 'select',
      options: [{ value: '1', label: 'DANFE A4 retrato (1)' }],
    },
  ];
  const transportFields: Field[] = [
    {
      key: 'mode',
      label: 'Modalidade do frete',
      type: 'select',
      options: [
        { value: '9', label: '9 - Sem frete' },
        { value: '0', label: '0 - Por conta do remetente' },
        { value: '1', label: '1 - Por conta do destinatário' },
        { value: '2', label: '2 - Terceiros' },
        { value: '3', label: '3 - Próprio do remetente' },
        { value: '4', label: '4 - Próprio do destinatário' },
      ],
    },
    { key: 'name', label: 'Razão social da transportadora' },
    { key: 'document', label: 'CNPJ / CPF', type: 'document' },
    { key: 'stateRegistration', label: 'Inscrição estadual' },
    { key: 'address', label: 'Endereço' },
    { key: 'city', label: 'Município' },
    { key: 'uf', label: 'UF', type: 'select', options: ['', ...UFS] },
    { key: 'plate', label: 'Placa', hint: 'Sem hífen: ABC1D23 ou ABC1234.' },
    { key: 'plateUf', label: 'UF da placa', type: 'select', options: ['', ...UFS] },
    { key: 'rntc', label: 'RNTC / ANTT' },
  ];
  if (!catalog)
    return (
      <>
        <ErrorBox error={error} />
        {!error && <div className="loading">Preparando os cadastros…</div>}
      </>
    );
  if (
    !catalog.emitters.length ||
    !catalog.recipients.length ||
    !catalog.products.length ||
    !catalog.cfops.length
  )
    return (
      <>
        <div className="page-heading">
          <div>
            <h1>Nova NF-e de teste</h1>
            <p>Prepare os cadastros para começar.</p>
          </div>
        </div>
        <section className="panel">
          <Empty title="Falta pouco para sua primeira NF-e" icon={FileCheck2}>
            <p>
              Cadastre as entidades, os produtos e os CFOPs das operações. Para emitir, uma entidade
              deve ser pessoa física ou jurídica com inscrição estadual.
            </p>
            <div className="row wrap">
              {[
                ['emitters', 'Cadastrar ou completar entidade'],
                ['products', 'Cadastrar produto'],
                ['cfops', 'Cadastrar CFOP'],
              ]
                .filter(([key]) => !catalog[key].length)
                .map(([key, label]) => (
                  <Button key={key} asChild>
                    <Link href={key === 'emitters' ? '/entities' : '/' + key}>{label}</Link>
                  </Button>
                ))}
            </div>
          </Empty>
        </section>
      </>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">GERAÇÃO OFFLINE</div>
          <h1>{draft.sourceInvoiceId ? 'Gerar NF-e substituta' : 'Nova NF-e de teste'}</h1>
          <p>Use seus cadastros e ajuste os dados do cenário.</p>
        </div>
        <span className="step-count">
          Etapa {step + 1} de {steps.length}
        </span>
      </div>
      <div className="stepper">
        {steps.map((label, i) => {
          const Icon = icons[i];
          return (
            <button
              key={label}
              disabled={i > step || busy}
              className={i === step ? 'current' : i < step ? 'complete' : ''}
              onClick={() => {
                setStep(i);
                setError(null);
              }}
            >
              <span>{i < step ? <Check size={16} /> : <Icon size={17} />}</span>
              {label}
            </button>
          );
        })}
      </div>
      <ErrorBox error={error} />
      <div className="wizard-layout">
        <section className="panel wizard-panel">
          <fieldset disabled={busy}>
            <div className="wizard-heading">
              <span className="step-number">0{step + 1}</span>
              <div>
                <h2>{steps[step]}</h2>
                <p>
                  {
                    [
                      'Escolha quem emite o documento.',
                      'Escolha quem recebe a mercadoria.',
                      'Defina a operação e os dados de identificação.',
                      'Adicione itens e ajuste quantidades, valores e tributos.',
                      'Informe transportadora, veículo e volumes, se necessário.',
                      'Confira os dados antes de reservar a numeração.',
                    ][step]
                  }
                </p>
              </div>
            </div>
            {step === 0 && (
              <>
                <div className="field">
                  <label htmlFor="invoice-emitter">Emitente</label>
                  <select
                    id="invoice-emitter"
                    value={draft.emitterId}
                    onChange={(e) => chooseEmitter(e.target.value)}
                  >
                    <option value="">Selecione…</option>
                    {catalog.emitters.map((e: any) => (
                      <option key={e.id} value={e.id}>
                        {e.corporateName} ·{' '}
                        {formatDocument(e.document, e.type === 'PF' ? 'CPF' : 'CNPJ')}
                      </option>
                    ))}
                  </select>
                </div>
                {emitter && (
                  <div className="selection-card">
                    <div className="selection-icon">
                      <Building2 />
                    </div>
                    <h3>{emitter.corporateName}</h3>
                    <p>
                      {emitter.type === 'PF' ? 'CPF' : 'CNPJ'}{' '}
                      {formatDocument(emitter.document, emitter.type === 'PF' ? 'CPF' : 'CNPJ')}
                    </p>
                    <div className="selection-data">
                      <div>
                        <small>UF</small>
                        <strong>{emitter.address.uf}</strong>
                      </div>
                      <div>
                        <small>Série</small>
                        <strong>{draft.serie}</strong>
                      </div>
                      <div>
                        <small>Próximo número previsto</small>
                        <strong>{sequence?.next_number ?? '…'}</strong>
                      </div>
                    </div>
                    <p className="muted-text">Consultar não consome a sequência.</p>
                  </div>
                )}
              </>
            )}
            {step === 1 && (
              <>
                <div className="field">
                  <label htmlFor="invoice-recipient">Destinatário</label>
                  <select
                    id="invoice-recipient"
                    value={draft.recipientId}
                    onChange={(e) => chooseRecipient(e.target.value)}
                  >
                    <option value="">Selecione…</option>
                    {catalog.recipients.map((r: any) => (
                      <option value={r.id} key={r.id}>
                        {r.name} · {formatDocument(r.document, r.type === 'PF' ? 'CPF' : 'CNPJ')}
                      </option>
                    ))}
                  </select>
                </div>
                {recipient && (
                  <div className="selection-card">
                    <div className="selection-icon">
                      <Users />
                    </div>
                    <h3>{recipient.name}</h3>
                    <p>
                      {recipient.type === 'PJ' ? 'CNPJ' : 'CPF'}{' '}
                      {formatDocument(recipient.document, recipient.type === 'PF' ? 'CPF' : 'CNPJ')}
                    </p>
                    <p>
                      {recipient.address.street}, {recipient.address.number}
                    </p>
                    <p>
                      {recipient.address.city} / {recipient.address.uf} · CEP{' '}
                      {recipient.address.zip}
                    </p>
                    {draft.environment === '2' && (
                      <p className="muted-text">
                        No XML de homologação, o nome será substituído pela identificação
                        padronizada de ambiente de teste.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
            {step === 2 && (
              <>
                <Fields
                  fields={fields.slice(0, 4)}
                  value={draft}
                  onChange={update}
                  errors={error?.fields}
                />
                <div className="field">
                  <label htmlFor="operation-cfop">CFOP da operação</label>
                  <select
                    id="operation-cfop"
                    value={operationCfop}
                    onChange={(e) => {
                      const cfop = e.target.value;
                      setOperationCfop(cfop);
                      update({
                        ...draft,
                        items: draft.items.map((item: any) => ({ ...item, cfop })),
                      });
                    }}
                  >
                    <option value="">Selecione o CFOP…</option>
                    {catalog.cfops.map((cfop: any) => (
                      <option key={cfop.id} value={cfop.code}>
                        {cfop.code} — {cfop.description}
                      </option>
                    ))}
                  </select>
                  <small>
                    A seleção aplica o CFOP a todos os itens atuais e novos. Você pode ajustar cada
                    item na próxima etapa.
                  </small>
                  <div className="row wrap">
                    <Link href="/cfops" target="_blank" className="text-link">
                      Gerenciar CFOPs
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          const cfops = await api('cfops');
                          setCatalog({ ...catalog, cfops });
                        } catch (error) {
                          setError(error as ApiError);
                        }
                      }}
                    >
                      Atualizar lista de CFOPs
                    </Button>
                  </div>
                </div>
                <details className="advanced" open={draft.purpose !== '1'}>
                  <summary>Configurações fiscais avançadas</summary>
                  <Fields
                    fields={fields.slice(4)}
                    value={draft}
                    onChange={update}
                    errors={error?.fields}
                  />
                  <div className="field">
                    <label htmlFor="reference-keys">Chaves referenciadas</label>
                    <textarea
                      id="reference-keys"
                      rows={3}
                      value={draft.referenceKeys.join('\n')}
                      onChange={(e) =>
                        update({
                          ...draft,
                          referenceKeys: e.target.value
                            .split('\n')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                    <small>
                      Uma chave de 44 dígitos por linha. Obrigatório em complementação/devolução.
                    </small>
                  </div>
                </details>
              </>
            )}
            {step === 3 && (
              <>
                <div className="field add-product">
                  <label htmlFor="add-product">Adicionar produto cadastrado</label>
                  <select id="add-product" value="" onChange={(e) => addProduct(e.target.value)}>
                    <option value="">Selecione para adicionar…</option>
                    {catalog.products.map((p: any) => (
                      <option value={p.id} key={p.id}>
                        {p.code} · {p.description} · {currency(p.unitPrice)}/{p.unit}
                      </option>
                    ))}
                  </select>
                </div>
                {!draft.items.length && (
                  <Empty title="Adicione os produtos desta nota" icon={Package} />
                )}
                <div className="invoice-items">
                  {draft.items.map((item: any, i: number) => (
                    <div className="invoice-item" key={i}>
                      <div className="item-heading">
                        <span className="item-index">{String(i + 1).padStart(2, '0')}</span>
                        <div>
                          <h3>{item.description}</h3>
                          <small>
                            {item.code} · NCM {item.ncm}
                          </small>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={'Remover item ' + (i + 1)}
                          onClick={() =>
                            update({
                              ...draft,
                              items: draft.items.filter((_: any, j: number) => i !== j),
                            })
                          }
                        >
                          <Trash2 size={17} />
                        </Button>
                      </div>
                      <Fields
                        fields={[
                          {
                            key: 'quantity',
                            label: `Quantidade (${item.unit})`,
                            type: 'number',
                            required: true,
                          },
                          {
                            key: 'unitPrice',
                            label: 'Valor unitário (R$)',
                            type: 'number',
                            required: true,
                          },
                        ]}
                        value={item}
                        onChange={(v) => itemUpdate(i, v)}
                        errors={error?.fields}
                        prefix={`items.${i}.`}
                      />
                      <Fields
                        fields={[
                          {
                            key: 'cfop',
                            label: 'CFOP deste item',
                            type: 'select',
                            required: true,
                            options: [
                              { value: '', label: 'Selecione…' },
                              ...catalog.cfops.map((cfop: any) => ({
                                value: cfop.code,
                                label: `${cfop.code} — ${cfop.description}`,
                              })),
                              ...(item.cfop &&
                              !catalog.cfops.some((cfop: any) => cfop.code === item.cfop)
                                ? [
                                    {
                                      value: item.cfop,
                                      label: `${item.cfop} — indisponível; selecione outro`,
                                    },
                                  ]
                                : []),
                            ],
                          },
                        ]}
                        value={item}
                        onChange={(value) => itemUpdate(i, value)}
                        errors={error?.fields}
                        prefix={`items.${i}.`}
                      />
                      <div className="item-total">
                        Valor dos produtos{' '}
                        <strong>
                          {(() => {
                            try {
                              return currency(
                                new Decimal(item.quantity || 0).mul(item.unitPrice || 0).toFixed(2),
                              );
                            } catch {
                              return '—';
                            }
                          })()}
                        </strong>
                      </div>
                      <details className="advanced">
                        <summary>Dados do item, despesas e tributos</summary>
                        <Fields
                          fields={[
                            ...productFields.filter((f) => f.key !== 'unitPrice'),
                            { key: 'discount', label: 'Desconto (R$)', type: 'number' },
                            { key: 'freight', label: 'Frete (R$)', type: 'number' },
                            { key: 'insurance', label: 'Seguro (R$)', type: 'number' },
                            { key: 'other', label: 'Outras despesas (R$)', type: 'number' },
                            {
                              key: 'taxQuantity',
                              label: 'Quantidade tributável',
                              type: 'number',
                              hint: 'Vazio: quantidade × fator.',
                            },
                            {
                              key: 'taxUnitPrice',
                              label: 'Valor unitário tributável',
                              type: 'number',
                              hint: 'Vazio: preço ÷ fator.',
                            },
                          ]}
                          value={item}
                          onChange={(v) => itemUpdate(i, v)}
                          errors={error?.fields}
                          prefix={`items.${i}.`}
                        />
                        <h4>Tributos do item</h4>
                        <TaxFields
                          value={item}
                          onChange={(v) => itemUpdate(i, v)}
                          crt={emitter?.crt}
                          errors={error?.fields}
                          prefix={`items.${i}.`}
                        />
                      </details>
                    </div>
                  ))}
                </div>
              </>
            )}
            {step === 4 && (
              <>
                <Fields
                  fields={transportFields}
                  value={draft.transport}
                  onChange={(v) => update({ ...draft, transport: v })}
                  errors={error?.fields}
                  prefix="transport."
                />
                <div className="section-title">
                  <h3>Volumes</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      update({
                        ...draft,
                        transport: {
                          ...draft.transport,
                          volumes: [
                            ...draft.transport.volumes,
                            {
                              quantity: 1,
                              kind: 'GRANEL',
                              brand: '',
                              number: '',
                              netWeight: '0',
                              grossWeight: '0',
                            },
                          ],
                        },
                      })
                    }
                  >
                    <Plus size={15} />
                    Adicionar volume
                  </Button>
                </div>
                {draft.transport.volumes.map((v: any, i: number) => (
                  <div className="volume" key={i}>
                    <div className="section-title">
                      <strong>Volume {i + 1}</strong>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={'Remover volume ' + (i + 1)}
                        onClick={() =>
                          update({
                            ...draft,
                            transport: {
                              ...draft.transport,
                              volumes: draft.transport.volumes.filter(
                                (_: any, j: number) => i !== j,
                              ),
                            },
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                    <Fields
                      fields={[
                        { key: 'quantity', label: 'Quantidade', type: 'number' },
                        { key: 'kind', label: 'Espécie' },
                        { key: 'brand', label: 'Marca' },
                        { key: 'number', label: 'Numeração' },
                        { key: 'netWeight', label: 'Peso líquido (kg)', type: 'number' },
                        { key: 'grossWeight', label: 'Peso bruto (kg)', type: 'number' },
                      ]}
                      value={v}
                      onChange={(value) =>
                        update({
                          ...draft,
                          transport: {
                            ...draft.transport,
                            volumes: draft.transport.volumes.map((x: any, j: number) =>
                              i === j ? value : x,
                            ),
                          },
                        })
                      }
                      errors={error?.fields}
                      prefix={`transport.volumes.${i}.`}
                    />
                  </div>
                ))}
                <details className="advanced">
                  <summary>Pagamento e informações adicionais</summary>
                  <Fields
                    fields={[
                      {
                        key: 'payment.method',
                        label: 'Forma de pagamento',
                        type: 'select',
                        options: [
                          { value: '01', label: 'Dinheiro' },
                          { value: '15', label: 'Boleto' },
                          { value: '16', label: 'Depósito' },
                          { value: '17', label: 'PIX' },
                          { value: '18', label: 'Transferência' },
                          { value: '90', label: 'Sem pagamento' },
                          { value: '99', label: 'Outros' },
                        ],
                      },
                      { key: 'payment.description', label: 'Descrição (obrigatória para Outros)' },
                      {
                        key: 'additionalInfo',
                        label: 'Informações complementares',
                        type: 'textarea',
                        wide: true,
                      },
                      {
                        key: 'fiscalInfo',
                        label: 'Informações de interesse do Fisco',
                        type: 'textarea',
                        wide: true,
                      },
                    ]}
                    value={draft}
                    onChange={update}
                    errors={error?.fields}
                  />
                </details>
              </>
            )}
            {step === 5 && preview && (
              <>
                <div className="review-parties">
                  <div>
                    <small>EMITENTE</small>
                    <h3>{emitter?.corporateName}</h3>
                    <p>
                      {formatDocument(
                        emitter?.document || '',
                        emitter?.type === 'PF' ? 'CPF' : 'CNPJ',
                      )}
                    </p>
                  </div>
                  <div>
                    <small>DESTINATÁRIO</small>
                    <h3>{recipient?.name}</h3>
                    <p>
                      {formatDocument(
                        recipient?.document || '',
                        recipient?.type === 'PF' ? 'CPF' : 'CNPJ',
                      )}
                    </p>
                  </div>
                </div>
                <div className="selection-data review-numbers">
                  <div>
                    <small>Série</small>
                    <strong>{draft.serie}</strong>
                  </div>
                  <div>
                    <small>Número previsto</small>
                    <strong>{preview.number}</strong>
                  </div>
                  <div>
                    <small>Ambiente</small>
                    <strong>
                      {draft.environment === '2' ? 'Homologação' : 'Produção offline'}
                    </strong>
                  </div>
                </div>
                <div className="review-key">
                  <small>CHAVE PREVISTA</small>
                  <code>{preview.accessKey}</code>
                  <p>
                    {preview.numericCodeEstimated
                      ? 'O cNF aleatório e a chave serão definidos ao gerar.'
                      : 'A numeração pode mudar se outra nota for gerada antes da confirmação.'}
                  </p>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Produto</th>
                        <th>Quantidade</th>
                        <th>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.items.map((i: any, index: number) => (
                        <tr key={index}>
                          <td>{i.description}</td>
                          <td>
                            {i.quantity} {i.unit}
                          </td>
                          <td>{currency(i.amounts.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Totals totals={preview.totals} />
                <div className="notice compact">
                  <FlaskConical size={18} />
                  <div>
                    Documento de teste, sem assinatura e sem valor fiscal. Nenhuma transmissão à
                    SEFAZ será realizada.
                  </div>
                </div>
              </>
            )}
            <div className="wizard-actions">
              <Button
                variant="outline"
                disabled={busy || step === 0}
                onClick={() => {
                  setStep((s) => s - 1);
                  setError(null);
                }}
              >
                <ArrowLeft size={16} />
                Voltar
              </Button>
              {step < 5 ? (
                <Button disabled={busy} onClick={next}>
                  {busy ? 'Validando…' : step === 4 ? 'Revisar NF-e' : 'Continuar'}
                  <ArrowRight size={16} />
                </Button>
              ) : (
                <Button disabled={busy || !preview} onClick={generate}>
                  {busy ? <LoaderCircle className="spin" size={17} /> : <FileCheck2 size={17} />}{' '}
                  {busy ? 'Gerando XML e DANFE…' : 'Gerar NF-e de teste'}
                </Button>
              )}
            </div>
          </fieldset>
        </section>
        <aside className="wizard-summary">
          <h3>Resumo da nota</h3>
          <div>
            <small>EMITENTE</small>
            <strong>{emitter?.corporateName || 'Não selecionado'}</strong>
          </div>
          <div>
            <small>DESTINATÁRIO</small>
            <strong>{recipient?.name || 'Não selecionado'}</strong>
          </div>
          <div className="summary-meta">
            <span>
              Série <strong>{draft.serie}</strong>
            </span>
            <span>
              Número <strong>{draft.manualNumber || 'Automático'}</strong>
            </span>
          </div>
          <div className="summary-line">
            <span>Itens</span>
            <strong>{draft.items.length}</strong>
          </div>
          <div className="summary-total">
            <span>Total previsto</span>
            <strong>
              {calculating ? 'Calculando…' : preview ? currency(preview.totals.total) : '—'}
            </strong>
          </div>
          <p>A sequência só é consumida quando a geração termina com sucesso.</p>
          <div className="summary-tag">
            <FlaskConical size={15} />
            SEM VALOR FISCAL
          </div>
        </aside>
      </div>
    </>
  );
}
