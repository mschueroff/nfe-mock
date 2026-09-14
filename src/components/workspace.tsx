'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FilePlus2,
  Files,
  Building2,
  Package,
  Settings2,
  ArrowUpRight,
  Plus,
  Search,
  ChevronRight,
  Download,
  Copy,
  FileCode2,
  Trash2,
  Pencil,
  Check,
  AlertCircle,
  FlaskConical,
  Menu,
  X,
  RefreshCw,
} from 'lucide-react';
import { Button } from './ui/button';
import {
  Fields,
  TaxFields,
  entityFields,
  emitterDefaults,
  productFields,
  cfopFields,
  addressFields,
  type Field,
} from './forms';
import { formatDocument, taxSchema } from '../shared/contracts';
import { InvoiceWizard } from './wizard';
export class ApiError extends Error {
  constructor(
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}
export async function api(
  url: string,
  method = 'GET',
  value?: unknown,
  headers: Record<string, string> = {},
) {
  const response = await fetch('/api/' + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(value !== undefined ? { body: JSON.stringify(value) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new ApiError(data.message || 'Falha na requisição', data.fields || {});
  return data;
}
export const currency = (v: string | number) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const date = (v: string) => new Date(v).toLocaleString('pt-BR');
const nav = [
  { key: 'dashboard', label: 'Visão geral', icon: LayoutDashboard },
  { key: 'new', label: 'Nova NF-e', icon: FilePlus2 },
  { key: 'invoices', label: 'NF-es geradas', icon: Files },
  { key: 'entities', label: 'Entidades', icon: Building2 },
  { key: 'products', label: 'Produtos', icon: Package },
  { key: 'cfops', label: 'CFOPs', icon: FileCode2 },
  { key: 'settings', label: 'Configurações', icon: Settings2 },
];
export function ErrorBox({ error }: { error: ApiError | null }) {
  return (
    error && (
      <div className="error-box" role="alert">
        <AlertCircle size={18} />
        <div>
          <strong>{error.message}</strong>
          {Object.keys(error.fields).length > 0 && (
            <ul>
              {Object.entries(error.fields).map(([k, v]) => (
                <li key={k}>
                  {k}: {v}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  );
}
export function Empty({
  title,
  children,
  icon: Icon = Files,
}: {
  title: string;
  children?: ReactNode;
  icon?: typeof Files;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={29} />
      </div>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function Status({ status }: { status: string }) {
  return (
    <span
      className={
        'status ' + (status === 'GENERATED' ? 'success' : status === 'ERROR' ? 'failed' : 'muted')
      }
    >
      <span />
      {status === 'GENERATED' ? 'Gerada' : status === 'ERROR' ? 'Erro' : 'Cancelada em teste'}
    </span>
  );
}
export function InvoiceTable({ invoices }: { invoices: any[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>NF-e / série</th>
            <th>Emitente e destinatário</th>
            <th>Emissão</th>
            <th>Valor total</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Abrir</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((i) => (
            <tr key={i.id}>
              <td>
                <Link className="strong-link" href={'/invoices/' + i.id}>
                  {String(i.number).padStart(9, '0')}
                </Link>
                <small>Série {i.serie}</small>
              </td>
              <td>
                <strong>{i.emitterName}</strong>
                <small>
                  {formatDocument(i.emitterCnpj)} → {i.recipientName}
                </small>
              </td>
              <td>{date(i.issueDate)}</td>
              <td className="amount">{currency(i.total)}</td>
              <td>
                <Status status={i.status} />
              </td>
              <td>
                <Link aria-label={'Abrir NF-e ' + i.number} href={'/invoices/' + i.id}>
                  <ChevronRight size={19} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Workspace({ page, id }: { page: string; id?: string }) {
  const [menu, setMenu] = useState(false);
  const current = nav.find((n) => n.key === page);
  return (
    <div className="workspace">
      <aside className={'sidebar ' + (menu ? 'is-open' : '')}>
        <Link href="/" className="brand">
          <span className="brand-symbol">
            <FileCode2 size={24} />
          </span>
          <span>
            NF-e<span className="brand-light"> Mock</span>
            <small>AMBIENTE DE TESTES</small>
          </span>
        </Link>
        <button className="mobile-close" aria-label="Fechar menu" onClick={() => setMenu(false)}>
          <X />
        </button>
        <div className="nav-label">ESPAÇO DE TRABALHO</div>
        <nav>
          {nav.map((n, i) => (
            <Link
              key={n.key}
              href={n.key === 'dashboard' ? '/' : '/' + n.key}
              onClick={() => setMenu(false)}
              className={(page === n.key ? 'active ' : '') + (i === 3 ? 'nav-divider' : '')}
            >
              <n.icon size={19} />
              {n.label}
              {page === n.key && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="local-dot" />
          <div>
            <strong>Execução local</strong>
            <small>Seus dados ficam neste computador</small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="row">
            <button className="mobile-toggle" aria-label="Abrir menu" onClick={() => setMenu(true)}>
              <Menu />
            </button>
            <span className="breadcrumb">
              Workspace <ChevronRight size={14} /> <strong>{current?.label || 'Página'}</strong>
            </span>
          </div>
          <span className="test-pill">
            <FlaskConical size={14} /> Uso exclusivo para testes
          </span>
        </header>
        <main>
          {page === 'dashboard' ? (
            <Dashboard />
          ) : page === 'new' ? (
            <InvoiceWizard />
          ) : page === 'invoices' ? (
            id ? (
              <InvoiceDetails id={id} />
            ) : (
              <History />
            )
          ) : ['entities', 'products', 'cfops'].includes(page) ? (
            <Catalog kind={page} />
          ) : page === 'settings' ? (
            <SettingsPage />
          ) : (
            <Empty title="Página não encontrada">
              <Link href="/">Voltar ao início</Link>
            </Empty>
          )}
        </main>
        <footer className="app-footer">
          NF-e Mock v{process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'}{' '}
          <span>DOCUMENTO DE TESTE · SEM VALOR FISCAL · Não autorizado pela SEFAZ</span>
        </footer>
      </div>
    </div>
  );
}
function Dashboard() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState<ApiError | null>(null);
  useEffect(() => {
    api('dashboard').then(setData).catch(setError);
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SEU AMBIENTE LOCAL</div>
          <h1>Visão geral</h1>
          <p>Prepare os dados. Gere documentos. Valide suas integrações.</p>
        </div>
        <Button asChild>
          <Link href="/new">
            <Plus size={18} />
            Nova NF-e de teste
          </Link>
        </Button>
      </div>
      <ErrorBox error={error} />
      <div className="notice">
        <FlaskConical size={20} />
        <div>
          <strong>Uso exclusivo para desenvolvimento, QA e testes de integração.</strong>
          <span>
            {' '}
            Os documentos gerados pelo NF-e Mock não são autorizados pela SEFAZ e não possuem
            validade fiscal.
          </span>
        </div>
      </div>
      <div className="stats">
        {[
          { key: 'entities', label: 'Entidades', icon: Building2 },
          { key: 'products', label: 'Produtos', icon: Package },
          { key: 'invoices', label: 'NF-es geradas', icon: Files },
        ].map((s) => (
          <Link href={'/' + s.key} className="stat" key={s.key}>
            <div className="stat-top">
              <span>{s.label}</span>
              <s.icon size={19} />
            </div>
            <strong>{data ? data.counts[s.key] : '—'}</strong>
            <span className="stat-bottom">
              {s.key === 'invoices' ? 'Consultar documentos' : 'Gerenciar cadastro'}
              <ArrowUpRight size={15} />
            </span>
          </Link>
        ))}
      </div>
      <section className="panel recent">
        <div className="panel-heading">
          <div>
            <h2>Últimas NF-es geradas</h2>
            <p>Documentos prontos para os seus cenários de teste.</p>
          </div>
          <Link className="text-link" href="/invoices">
            Ver todas <ChevronRight size={16} />
          </Link>
        </div>
        {!data ? (
          <div className="loading">Carregando documentos…</div>
        ) : data.recent.length ? (
          <InvoiceTable invoices={data.recent} />
        ) : (
          <Empty title="Seu primeiro teste começa aqui">
            <p>Cadastre as entidades e os produtos para gerar uma NF-e.</p>
            <Button asChild>
              <Link href="/entities">
                <Plus size={16} />
                Cadastrar entidade
              </Link>
            </Button>
          </Empty>
        )}
      </section>
      <div className="dashboard-bottom">
        <section className="quick-card">
          <div className="quick-icon">
            <RefreshCw size={24} />
          </div>
          <h3>Repita um cenário em poucos cliques</h3>
          <p>
            Duplique uma nota gerada ou crie uma substituta. Os dados são preservados e a numeração
            é renovada.
          </p>
          <Link href="/invoices" className="text-link">
            Abrir histórico <ArrowUpRight size={15} />
          </Link>
        </section>
        <section className="profile-card">
          <span className="eyebrow">PERFIL DE GERAÇÃO</span>
          <h3>NF-e tradicional</h3>
          <div>
            <span>Ambiente padrão</span>
            <strong>
              {data?.settings.environment === '1' ? 'Produção offline' : 'Homologação'}
            </strong>
          </div>
          <div>
            <span>Validação estrutural</span>
            <strong>{data?.settings.validateXsd ? 'XSD sem assinatura' : 'XSD desativado'}</strong>
          </div>
          <Link href="/settings" className="text-link">
            Configurar preferências <Settings2 size={15} />
          </Link>
        </section>
      </div>
    </>
  );
}
const blankAddress = {
  street: '',
  number: '',
  complement: '',
  district: '',
  cityCode: '',
  city: '',
  uf: 'MT',
  zip: '',
  countryCode: '1058',
  country: 'BRASIL',
  phone: '',
};
function blank(kind: string) {
  if (kind === 'cfops') return { code: '', description: '' };
  return kind === 'entities'
    ? {
        type: 'PJ',
        name: '',
        document: '',
        tradeName: '',
        stateRegistration: '',
        ieIndicator: '9',
        email: '',
        crt: '1',
        address: { ...blankAddress },
        defaultSerie: 1,
        initialNumber: 1,
        environment: '2',
        numericCodeMode: 'SEQUENTIAL',
        defaultPurpose: '1',
        defaultEmission: '1',
      }
    : {
        code: '',
        description: '',
        ncm: '',
        cest: '',
        gtin: '',
        unit: 'KG',
        taxUnit: 'KG',
        unitPrice: '0',
        taxFactor: '1',
        anp: '',
        additionalInfo: '',
        taxes: taxSchema.parse({}),
      };
}
function Catalog({ kind }: { kind: string }) {
  const label = nav.find((n) => n.key === kind)!.label,
    singular = kind === 'entities' ? 'entidade' : kind === 'cfops' ? 'CFOP' : 'produto';
  const [rows, setRows] = useState<any[]>([]),
    [loading, setLoading] = useState(true),
    [editor, setEditor] = useState<any>(null),
    [error, setError] = useState<ApiError | null>(null),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState('');
  const load = () =>
    api(kind)
      .then(setRows)
      .catch(setError)
      .finally(() => setLoading(false));
  useEffect(() => {
    setEditor(null);
    setLoading(true);
    setSearch('');
    setError(null);
    load();
  }, [kind]);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(kind + (editor.id ? '/' + editor.id : ''), editor.id ? 'PUT' : 'POST', editor);
      setEditor(null);
      await load();
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }
  async function remove(row: any) {
    if (
      !confirm(
        `Excluir ${row.corporateName || row.name || row.description}? As notas já geradas serão preservadas.`,
      )
    )
      return;
    try {
      await api(kind + '/' + row.id, 'DELETE', {});
      await load();
    } catch (e) {
      setError(e as ApiError);
    }
  }
  const filtered = rows.filter((r) =>
    JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CADASTROS</div>
          <h1>{label}</h1>
          <p>
            {kind === 'products'
              ? 'Templates de produtos e tributos para preencher suas notas.'
              : kind === 'cfops'
                ? 'Operações fiscais para selecionar na geração da NF-e.'
                : 'Dados reutilizáveis para gerar documentos de teste.'}
          </p>
        </div>
        {!editor && (
          <Button
            onClick={async () => {
              const next = blank(kind);
              if (kind === 'entities') {
                try {
                  const settings = await api('settings');
                  next.environment = settings.environment;
                  next.numericCodeMode = settings.numericCodeMode;
                } catch {}
              }
              setEditor(next);
              setError(null);
            }}
          >
            <Plus size={17} />
            {kind === 'entities'
              ? 'Nova entidade'
              : kind === 'cfops'
                ? 'Novo CFOP'
                : 'Novo produto'}
          </Button>
        )}
      </div>
      <ErrorBox error={error} />
      {editor ? (
        <section className="panel editor">
          <div className="panel-heading">
            <h2>
              {editor.id ? 'Editar' : 'Cadastrar'} {singular}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Fechar editor"
              onClick={() => {
                setEditor(null);
                setError(null);
              }}
            >
              <X size={20} />
            </Button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <fieldset disabled={busy}>
              <h3>Identificação</h3>
              <Fields
                fields={
                  kind === 'entities' ? entityFields : kind === 'cfops' ? cfopFields : productFields
                }
                value={editor}
                onChange={(value) => {
                  if (kind === 'entities' && value.type !== editor.type) {
                    value.defaultSerie = value.type === 'PF' ? 920 : 1;
                  }
                  setEditor(value);
                }}
                errors={error?.fields}
              />
              {kind === 'entities' && (
                <>
                  <h3>Endereço e contato</h3>
                  <Fields
                    fields={addressFields}
                    value={editor}
                    onChange={setEditor}
                    errors={error?.fields}
                  />
                </>
              )}
              {kind === 'entities' && (
                <>
                  <h3>Configuração para uso como emitente</h3>
                  <p>
                    Emitentes PF ou PJ precisam de CPF/CNPJ válido e inscrição estadual. Para PF,
                    utilize série de 920 a 969.
                  </p>
                  <Fields
                    fields={emitterDefaults}
                    value={editor}
                    onChange={setEditor}
                    errors={error?.fields}
                  />
                  {editor.id && editor.stateRegistration && (
                    <SequenceEditor emitterId={editor.id} defaultSerie={editor.defaultSerie} />
                  )}
                </>
              )}
              {kind === 'products' && (
                <details className="advanced">
                  <summary>Configuração tributária padrão</summary>
                  <p className="muted-text">
                    Selecione o CST e o CSOSN apropriados. A emissão usa o código correspondente ao
                    CRT do emitente.
                  </p>
                  <TaxFields value={editor} onChange={setEditor} errors={error?.fields} />
                </details>
              )}
              <div className="form-actions">
                <Button variant="outline" type="button" onClick={() => setEditor(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Salvando…' : 'Salvar cadastro'}
                </Button>
              </div>
            </fieldset>
          </form>
        </section>
      ) : (
        <section className="panel">
          <div className="panel-heading">
            <h2>
              {rows.length} {label.toLowerCase()}
            </h2>
            <div className="search">
              <Search size={17} />
              <input
                aria-label="Buscar cadastro"
                placeholder="Buscar por nome, código ou documento…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {loading ? (
            <div className="loading">Carregando cadastros…</div>
          ) : !filtered.length ? (
            <Empty
              title={
                search
                  ? 'Nenhum resultado'
                  : kind === 'entities'
                    ? 'Nenhuma entidade cadastrada'
                    : kind === 'cfops'
                      ? 'Nenhum CFOP cadastrado'
                      : 'Nenhum produto cadastrado'
              }
            >
              <p>
                {search
                  ? 'Tente outro termo de busca.'
                  : 'Adicione os dados para começar a gerar suas notas.'}
              </p>
            </Empty>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>
                      {kind === 'products'
                        ? 'Produto'
                        : kind === 'cfops'
                          ? 'Descrição'
                          : 'Nome / razão social'}
                    </th>
                    <th>{kind === 'products' ? 'NCM' : kind === 'cfops' ? 'CFOP' : 'Documento'}</th>
                    <th>
                      {kind === 'products'
                        ? 'Valor padrão'
                        : kind === 'cfops'
                          ? 'Operação'
                          : 'Localização'}
                    </th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.corporateName || r.name || r.description}</strong>
                        <small>{r.code || r.tradeName || r.type}</small>
                      </td>
                      <td>
                        {kind === 'cfops'
                          ? r.code
                          : kind === 'entities'
                            ? formatDocument(r.document, r.type === 'PF' ? 'CPF' : 'CNPJ')
                            : r.ncm}
                      </td>
                      <td>
                        {kind === 'cfops' ? (
                          <>
                            {['1', '2'].includes(r.code[0]) ? 'Entrada' : 'Saída'} ·{' '}
                            {['1', '5'].includes(r.code[0]) ? 'Interna' : 'Interestadual'}
                          </>
                        ) : kind === 'products' ? (
                          <>
                            {currency(r.unitPrice)} / {r.unit}
                          </>
                        ) : (
                          <>
                            {r.address.city} / {r.address.uf}
                          </>
                        )}
                      </td>
                      <td>
                        <div className="row">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={'Editar ' + singular}
                            onClick={() => {
                              setEditor(
                                r.type === 'PF' && r.defaultSerie < 920
                                  ? { ...r, defaultSerie: 920 }
                                  : r,
                              );
                              setError(null);
                            }}
                          >
                            <Pencil size={17} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={'Excluir ' + singular}
                            onClick={() => remove(r)}
                          >
                            <Trash2 size={17} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
function SequenceEditor({ emitterId, defaultSerie }: { emitterId: string; defaultSerie: number }) {
  const [serie, setSerie] = useState(defaultSerie),
    [sequence, setSequence] = useState<any>(null),
    [next, setNext] = useState(''),
    [error, setError] = useState<ApiError | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  useEffect(() => {
    setSequence(null);
    api(`sequences/${emitterId}?serie=${serie}`)
      .then((v) => {
        setSequence(v);
        setNext(String(v.next_number));
      })
      .catch(setError);
  }, [emitterId, serie]);
  async function reset() {
    if (
      !sequence ||
      !confirm(
        `Alterar sequência da série ${serie}?\nNúmero atual: ${sequence.next_number}\nNovo próximo número: ${next}\nNúmeros já utilizados continuarão bloqueados.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const v = await api(`sequences/${emitterId}?serie=${serie}`, 'PUT', {
        nextNumber: Number(next),
        expected: sequence.next_number,
        confirmed: true,
      });
      setSequence(v);
      setMessage('Sequência atualizada.');
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="advanced">
      <summary>Alterar próximo número</summary>
      <p>A sequência é independente por série. O cNF não é reiniciado.</p>
      <ErrorBox error={error} />
      <div className="fields">
        <div className="field">
          <label htmlFor="reset-series">Série</label>
          <input
            id="reset-series"
            type="number"
            min="0"
            max="999"
            value={serie}
            onChange={(e) => setSerie(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="reset-number">Próximo número</label>
          <input
            id="reset-number"
            type="number"
            min="1"
            max="999999999"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <small>Atual: {sequence?.next_number ?? '…'}</small>
        </div>
      </div>
      <Button type="button" variant="outline" disabled={busy || !sequence} onClick={reset}>
        Confirmar alteração
      </Button>
      {message && <p className="success-text">{message}</p>}
    </details>
  );
}
function History() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState<ApiError | null>(null),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState('ALL');
  useEffect(() => {
    api('invoices').then(setData).catch(setError);
  }, []);
  const rows = (data?.invoices || []).filter(
    (i: any) =>
      (status === 'ALL' || i.status === status) &&
      JSON.stringify(i).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">DOCUMENTOS</div>
          <h1>NF-es geradas</h1>
          <p>Encontre, baixe e reutilize seus cenários de teste.</p>
        </div>
        <Button asChild>
          <Link href="/new">
            <Plus size={18} />
            Nova NF-e
          </Link>
        </Button>
      </div>
      <ErrorBox error={error} />
      <section className="panel">
        <div className="panel-heading">
          <div className="search">
            <Search size={17} />
            <input
              aria-label="Buscar notas"
              placeholder="Número, chave, emitente ou destinatário…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Filtrar status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="ALL">Todos os status</option>
            <option value="GENERATED">Geradas</option>
            <option value="CANCELLED_TEST">Canceladas em teste</option>
            <option value="ERROR">Erro</option>
          </select>
        </div>
        {!data ? (
          <div className="loading">Carregando histórico…</div>
        ) : rows.length ? (
          <InvoiceTable invoices={rows} />
        ) : (
          <Empty title="Nenhuma NF-e encontrada">
            <p>As notas geradas aparecerão aqui.</p>
          </Empty>
        )}
      </section>
      {data?.errors.length > 0 && (
        <details className="panel attempt-list">
          <summary>Tentativas com erro ({data.errors.length})</summary>
          {data.errors.map((e: any) => (
            <div className="attempt" key={e.id}>
              <Status status="ERROR" />
              <div>
                <strong>{e.message}</strong>
                <small>
                  {date(e.createdAt)} · Etapa {e.stage}
                </small>
              </div>
            </div>
          ))}
        </details>
      )}
    </>
  );
}
function InvoiceDetails({ id }: { id: string }) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null),
    [xml, setXml] = useState(''),
    [tab, setTab] = useState('Resumo'),
    [error, setError] = useState<ApiError | null>(null),
    [message, setMessage] = useState('');
  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get('tab');
    if (selected === 'DANFE') setTab(selected);
    api('invoices/' + id)
      .then(setInvoice)
      .catch(setError);
    fetch(`/api/invoices/${id}/files?format=xml`)
      .then(async (r) => {
        if (!r.ok) throw new ApiError((await r.json()).message);
        return r.text();
      })
      .then(setXml)
      .catch(setError);
  }, [id]);
  const download = (format: string) => `/api/invoices/${id}/files?format=${format}`;
  async function copy(v: string) {
    try {
      await navigator.clipboard.writeText(v);
      setMessage('Copiado para a área de transferência.');
    } catch {
      setError(new ApiError('Não foi possível copiar. Selecione o texto manualmente.'));
    }
  }
  async function action(kind: 'cancel' | 'delete') {
    if (
      !confirm(
        kind === 'cancel'
          ? 'Marcar como cancelada em teste? Isso não envia evento fiscal.'
          : 'Excluir do histórico? A numeração continuará reservada.',
      )
    )
      return;
    try {
      await api(
        'invoices/' + id + (kind === 'cancel' ? '/cancel' : ''),
        kind === 'cancel' ? 'POST' : 'DELETE',
        {},
      );
      if (kind === 'delete') router.push('/invoices');
      else setInvoice(await api('invoices/' + id));
    } catch (e) {
      setError(e as ApiError);
    }
  }
  if (!invoice)
    return (
      <>
        <ErrorBox error={error} />
        {!error && <div className="loading">Carregando NF-e…</div>}
      </>
    );
  const s = invoice.snapshot,
    d = s.draft;
  return (
    <>
      <Link className="text-link back" href="/invoices">
        ← NF-es geradas
      </Link>
      <div className="page-heading">
        <div>
          <div className="eyebrow">DOCUMENTO DE TESTE</div>
          <h1>NF-e {String(invoice.number).padStart(9, '0')}</h1>
          <p>
            Série {invoice.serie} · {date(invoice.issueDate)} · <Status status={invoice.status} />
          </p>
        </div>
        <div className="row wrap">
          <Button variant="outline" asChild>
            <a href={download('xml')}>
              <FileCode2 size={16} />
              XML
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={download('pdf')}>
              <Download size={16} />
              DANFE
            </a>
          </Button>
          <Button asChild>
            <a href={download('zip')}>
              <Download size={16} />
              Baixar ZIP
            </a>
          </Button>
        </div>
      </div>
      <ErrorBox error={error} />
      {message && (
        <p className="success-text" role="status">
          {message}
        </p>
      )}
      <div className="notice">
        <FlaskConical size={20} />
        <div>
          <strong>Sem valor fiscal.</strong>{' '}
          {invoice.validation === 'VALID_UNSIGNED_TEST'
            ? 'Estrutura validada no perfil de teste sem assinatura.'
            : 'Validação XSD não executada.'}{' '}
          Este documento não foi autorizado pela SEFAZ.
        </div>
      </div>
      <div className="key-strip">
        <div>
          <small>CHAVE DE ACESSO</small>
          <code>{invoice.accessKey}</code>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Copiar chave"
          onClick={() => copy(invoice.accessKey)}
        >
          <Copy size={18} />
        </Button>
      </div>
      <div className="tabs" role="tablist" aria-label="Detalhes da NF-e">
        {['Resumo', 'XML', 'DANFE', 'Itens', 'Dados fiscais'].map((t) => (
          <button
            role="tab"
            aria-selected={t === tab}
            className={t === tab ? 'active' : ''}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <section className="panel detail-panel" role="tabpanel">
        {tab === 'Resumo' && (
          <>
            <div className="detail-grid">
              <section>
                <small>EMITENTE</small>
                <h3>{s.emitter.corporateName}</h3>
                <p>
                  {formatDocument(s.emitter.cpf || s.emitter.cnpj)} · IE{' '}
                  {s.emitter.stateRegistration}
                </p>
                <p>
                  {s.emitter.address.city} / {s.emitter.address.uf}
                </p>
              </section>
              <section>
                <small>DESTINATÁRIO</small>
                <h3>{s.recipient.name}</h3>
                <p>{formatDocument(s.recipient.document)}</p>
                <p>
                  {s.recipient.address.city} / {s.recipient.address.uf}
                </p>
              </section>
            </div>
            <div className="detail-grid">
              <section>
                <small>OPERAÇÃO</small>
                <h3>{d.nature}</h3>
                <p>
                  {d.environment === '2' ? 'Homologação' : 'Produção offline'} ·{' '}
                  {d.operation === '1' ? 'Saída' : 'Entrada'}
                </p>
                {invoice.sourceInvoiceId && (
                  <Link className="text-link" href={'/invoices/' + invoice.sourceInvoiceId}>
                    Ver NF-e de origem
                  </Link>
                )}
              </section>
              <section>
                <small>VALOR TOTAL</small>
                <div className="big-amount">{currency(invoice.total)}</div>
                <p>
                  {s.items.length} {s.items.length === 1 ? 'item' : 'itens'}
                </p>
              </section>
            </div>
            <Totals totals={s.totals} />
            <section className="transport-summary">
              <h3>Transporte e volumes</h3>
              <p>
                {d.transport.name || 'Transportadora não informada'} · Modalidade {d.transport.mode}
              </p>
              <p>
                {d.transport.plate && 'Placa ' + d.transport.plate + ' / ' + d.transport.plateUf}
              </p>
              {d.transport.volumes.map((v: any, i: number) => (
                <p key={i}>
                  {v.quantity} {v.kind} · Peso líquido {v.netWeight} kg · Peso bruto {v.grossWeight}{' '}
                  kg
                </p>
              ))}
            </section>
          </>
        )}
        {tab === 'XML' && (
          <>
            <div className="row end">
              <Button variant="outline" size="sm" onClick={() => copy(xml)}>
                <Copy size={15} />
                Copiar XML
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={download('xml')}>Baixar XML</a>
              </Button>
            </div>
            <pre className="xml-view">
              <code>
                {xml.split(/(<\/?[\w:]+|\/?>|[\w:]+="[^"]*")/g).map((part, i) => (
                  <span
                    key={i}
                    className={
                      part.startsWith('<') || part === '>' || part === '/>'
                        ? 'xml-tag'
                        : part.includes('="')
                          ? 'xml-attribute'
                          : ''
                    }
                  >
                    {part}
                  </span>
                ))}
              </code>
            </pre>
          </>
        )}
        {tab === 'DANFE' && (
          <iframe
            title="DANFE de teste em PDF"
            className="pdf-preview"
            src={download('pdf') + '&inline=1'}
          />
        )}
        {tab === 'Itens' && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Código / produto</th>
                  <th>NCM / CFOP</th>
                  <th>Quantidade</th>
                  <th>Valor unitário</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {s.items.map((i: any, index: number) => (
                  <tr key={index}>
                    <td>
                      <strong>{i.description}</strong>
                      <small>{i.code}</small>
                    </td>
                    <td>
                      {i.ncm}
                      <small>{i.cfop}</small>
                    </td>
                    <td>
                      {i.quantity} {i.unit}
                    </td>
                    <td>{currency(i.unitPrice)}</td>
                    <td>{currency(i.amounts.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'Dados fiscais' && (
          <>
            <p>
              <strong>Perfil:</strong> {invoice.schemaProfile}
            </p>
            <p>
              <strong>cNF:</strong> {invoice.numericCode} · <strong>DV:</strong>{' '}
              {invoice.checkDigit}
            </p>
            <p>
              <strong>Validação:</strong> {invoice.validation}
            </p>
            <details open>
              <summary>Snapshot fiscal preservado</summary>
              <pre className="json-view">{JSON.stringify(s, null, 2)}</pre>
            </details>
          </>
        )}
      </section>
      <div className="invoice-actions">
        <div className="row wrap">
          <Button variant="outline" asChild>
            <Link href={'/new?duplicate=' + id}>
              <Copy size={16} />
              Duplicar NF-e
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={'/new?substitute=' + id}>
              <RefreshCw size={16} />
              Gerar NF substituta
            </Link>
          </Button>
        </div>
        <div className="row wrap">
          {invoice.status === 'GENERATED' && (
            <Button variant="ghost" onClick={() => action('cancel')}>
              Cancelar em teste
            </Button>
          )}
          <Button variant="ghost" onClick={() => action('delete')}>
            <Trash2 size={16} />
            Excluir
          </Button>
        </div>
      </div>
    </>
  );
}
export function Totals({ totals: t }: { totals: any }) {
  return (
    <div className="totals-grid">
      {[
        ['Produtos', 'products'],
        ['Desconto', 'discount'],
        ['Frete', 'freight'],
        ['Seguro', 'insurance'],
        ['Outras despesas', 'other'],
        ['ICMS', 'icms'],
        ['ICMS ST', 'st'],
        ['IPI', 'ipi'],
        ['PIS', 'pis'],
        ['COFINS', 'cofins'],
      ].map(([label, key]) => (
        <div key={key}>
          <span>{label}</span>
          <strong>{currency(t[key])}</strong>
        </div>
      ))}
      <div className="grand-total">
        <span>Total da NF-e</span>
        <strong>{currency(t.total)}</strong>
      </div>
    </div>
  );
}
function SettingsPage() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState<ApiError | null>(null),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    api('settings').then(setData).catch(setError);
  }, []);
  const fields: Field[] = [
    {
      key: 'storageDirectory',
      label: 'Diretório dos arquivos',
      wide: true,
      hint: 'Novas notas usam este diretório. Os arquivos antigos permanecem acessíveis na localização original.',
    },
    {
      key: 'environment',
      label: 'Ambiente para novas entidades',
      type: 'select',
      options: [
        { value: '2', label: 'Homologação (2)' },
        { value: '1', label: 'Produção offline (1)' },
      ],
    },
    {
      key: 'numericCodeMode',
      label: 'cNF para novas entidades',
      type: 'select',
      options: [
        { value: 'SEQUENTIAL', label: 'Sequencial' },
        { value: 'RANDOM', label: 'Aleatório' },
      ],
    },
    {
      key: 'prettyXml',
      label: 'XML indentado',
      type: 'checkbox',
      hint: 'Facilitar a leitura do XML',
    },
    {
      key: 'validateXsd',
      label: 'Validar contra XSD',
      type: 'checkbox',
      hint: 'Perfil estrutural de teste sem assinatura',
    },
    {
      key: 'openDanfe',
      label: 'Abrir DANFE após gerar',
      type: 'checkbox',
      hint: 'Abrir automaticamente a aba DANFE',
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PREFERÊNCIAS</div>
          <h1>Configurações</h1>
          <p>Defina como os documentos de teste são gerados e armazenados.</p>
        </div>
      </div>
      <ErrorBox error={error} />
      {data && (
        <form
          className="panel editor"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            setSaved(false);
            try {
              setData(await api('settings', 'PUT', data));
              setSaved(true);
            } catch (e) {
              setError(e as ApiError);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy}>
            <h2>Geração e armazenamento</h2>
            <Fields
              fields={fields}
              value={data}
              onChange={(v) => {
                setData(v);
                setSaved(false);
              }}
              errors={error?.fields}
            />
            <div className="notice compact">
              <AlertCircle size={18} />
              <div>
                Modo offline fixo. Mesmo com ambiente 1, os arquivos não possuem assinatura,
                protocolo ou valor fiscal.
              </div>
            </div>
            <div className="form-actions">
              {saved && (
                <span className="success-text" role="status">
                  <Check size={16} />
                  Preferências salvas
                </span>
              )}
              <Button disabled={busy}>{busy ? 'Salvando…' : 'Salvar configurações'}</Button>
            </div>
          </fieldset>
        </form>
      )}
      <section className="panel support-profile">
        <h2>Perfil fiscal do MVP</h2>
        <p>
          NF-e tradicional, modelo 55 e leiaute 4.00. Operações nacionais PF/PJ, ICMS, ST, IPI, PIS
          e COFINS.
        </p>
        <p>
          IBS/CBS, CNPJ alfanumérico, combustíveis, comércio exterior, DIFAL e operações especiais
          não são suportados neste perfil.
        </p>
        <p>
          Os schemas originais são preservados. No perfil de teste, somente a obrigatoriedade da
          assinatura é flexibilizada.
        </p>
      </section>
    </>
  );
}
