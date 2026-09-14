import Decimal from 'decimal.js';
import { UF_CODES } from '../../shared/contracts';
import type { FiscalDocument } from './document';
import type { CalculatedItem } from './totals';
import { applicationVersion } from '../version';
export const escape = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
export const tag = (name: string, value: string | number | undefined) =>
  value === undefined ? '' : `<${name}>${escape(String(value))}</${name}>`;
const g = (name: string, body: string) => `<${name}>${body}</${name}>`;
const f = (v: string, n = 2) => new Decimal(v).toFixed(n);
export function buildFiscalIde(d: FiscalDocument) {
  const v = d.draft;
  return g(
    'ide',
    tag('cUF', UF_CODES[d.emitter.address.uf]) +
      tag('cNF', d.numericCode) +
      tag('natOp', v.nature) +
      tag('mod', '55') +
      tag('serie', v.serie) +
      tag('nNF', d.number) +
      tag('dhEmi', v.issueDate) +
      tag('dhSaiEnt', v.exitDate || undefined) +
      tag('tpNF', v.operation) +
      tag('idDest', v.destination) +
      tag('cMunFG', v.cityCode) +
      tag('tpImp', '1') +
      tag('tpEmis', '1') +
      tag('cDV', d.accessKey.at(-1)) +
      tag('tpAmb', v.environment) +
      tag('finNFe', v.purpose) +
      tag('indFinal', v.finalConsumer) +
      tag('indPres', v.presence) +
      (['2', '3', '4', '9'].includes(v.presence) ? tag('indIntermed', '0') : '') +
      tag('procEmi', '0') +
      tag('verProc', `NFeMock/${applicationVersion().version}`.slice(0, 20)) +
      v.referenceKeys.map((k) => g('NFref', tag('refNFe', k))).join(''),
  );
}
function icms(i: CalculatedItem) {
  const t = i.taxes.icms,
    a = i.amounts,
    code = a.code;
  let body = tag('orig', t.origin),
    group = '';
  const credit = tag('pCredSN', f(t.creditRate)) + tag('vCredICMSSN', a.credit);
  const st =
    tag('modBCST', '4') +
    tag('pMVAST', f(t.stMva)) +
    tag('vBCST', a.stBase) +
    tag('pICMSST', f(t.stRate)) +
    tag('vICMSST', a.stValue);
  const retained =
    tag('vBCSTRet', f(t.retainedBase)) +
    tag('pST', f(t.retainedRate)) +
    tag('vICMSSubstituto', f(t.substituteValue)) +
    tag('vICMSSTRet', f(t.retainedValue));
  if (code.length === 3) {
    body += tag('CSOSN', code);
    if (['102', '103', '300', '400'].includes(code)) group = 'ICMSSN102';
    else if (code === '101') {
      group = 'ICMSSN101';
      body += credit;
    } else if (code === '201') {
      group = 'ICMSSN201';
      body += st + credit;
    } else if (['202', '203'].includes(code)) {
      group = 'ICMSSN202';
      body += st;
    } else {
      group = 'ICMSSN500';
      body += retained;
    }
  } else {
    body += tag('CST', code);
    group = 'ICMS' + code;
    if (['40', '41', '50'].includes(code)) group = 'ICMS40';
    else if (code === '60') body += retained;
    else
      body +=
        tag('modBC', '3') +
        (code === '20' ? tag('pRedBC', f(t.reduction)) : '') +
        tag('vBC', a.base) +
        tag('pICMS', f(t.rate)) +
        tag('vICMS', a.icms) +
        (code === '10' ? st : '');
  }
  return g('ICMS', g(group, body));
}
function contribution(i: CalculatedItem, name: 'PIS' | 'COFINS') {
  const key = name === 'PIS' ? 'pis' : 'cofins',
    t = i.taxes[key],
    a = i.amounts[key];
  if (['04', '05', '06', '07', '08', '09'].includes(t.cst))
    return g(name, g(name + 'NT', tag('CST', t.cst)));
  if (t.cst === '03')
    return g(
      name,
      g(
        name + 'Qtde',
        tag('CST', t.cst) +
          tag('qBCProd', f(a.quantity, 4)) +
          tag('vAliqProd', f(t.quantityRate, 4)) +
          tag('v' + name, a.value),
      ),
    );
  return g(
    name,
    g(
      name + (['01', '02'].includes(t.cst) ? 'Aliq' : 'Outr'),
      tag('CST', t.cst) +
        tag('vBC', a.base) +
        tag('p' + name, f(t.rate, 4)) +
        tag('v' + name, a.value),
    ),
  );
}
function ipi(i: CalculatedItem) {
  const t = i.taxes.ipi;
  if (!t.enabled) return '';
  const body = ['00', '49', '50', '99'].includes(t.cst)
    ? g(
        'IPITrib',
        tag('CST', t.cst) +
          tag('vBC', i.amounts.ipiBase) +
          tag('pIPI', f(t.rate)) +
          tag('vIPI', i.amounts.ipi),
      )
    : g('IPINT', tag('CST', t.cst));
  return g('IPI', tag('cEnq', t.enquiry) + body);
}
export function buildFiscalItems(d: FiscalDocument) {
  return d.items
    .map((i, index) => {
      const product = g(
        'prod',
        tag('cProd', i.code) +
          tag('cEAN', i.gtin || 'SEM GTIN') +
          tag('xProd', i.description) +
          tag('NCM', i.ncm) +
          tag('CEST', i.cest || undefined) +
          tag('CFOP', i.cfop) +
          tag('uCom', i.unit) +
          tag('qCom', f(i.quantity, 4)) +
          tag('vUnCom', f(i.unitPrice, 10)) +
          tag('vProd', i.amounts.total) +
          tag('cEANTrib', i.gtin || 'SEM GTIN') +
          tag('uTrib', i.taxUnit) +
          tag('qTrib', f(i.amounts.taxQuantity, 4)) +
          tag('vUnTrib', f(i.amounts.taxUnitPrice, 10)) +
          (Number(i.freight) ? tag('vFrete', f(i.freight)) : '') +
          (Number(i.insurance) ? tag('vSeg', f(i.insurance)) : '') +
          (Number(i.discount) ? tag('vDesc', f(i.discount)) : '') +
          (Number(i.other) ? tag('vOutro', f(i.other)) : '') +
          tag('indTot', '1'),
      );
      return `<det nItem="${index + 1}">${product}${g('imposto', icms(i) + ipi(i) + contribution(i, 'PIS') + contribution(i, 'COFINS'))}${tag('infAdProd', i.additionalInfo || undefined)}</det>`;
    })
    .join('');
}
export function buildFiscalTotals(d: FiscalDocument) {
  const t = d.totals;
  return g(
    'total',
    g(
      'ICMSTot',
      tag('vBC', t.icmsBase) +
        tag('vICMS', t.icms) +
        tag('vICMSDeson', '0.00') +
        tag('vFCP', '0.00') +
        tag('vBCST', t.stBase) +
        tag('vST', t.st) +
        tag('vFCPST', '0.00') +
        tag('vFCPSTRet', '0.00') +
        tag('vProd', t.products) +
        tag('vFrete', t.freight) +
        tag('vSeg', t.insurance) +
        tag('vDesc', t.discount) +
        tag('vII', '0.00') +
        tag('vIPI', t.ipi) +
        tag('vIPIDevol', '0.00') +
        tag('vPIS', t.pis) +
        tag('vCOFINS', t.cofins) +
        tag('vOutro', t.other) +
        tag('vNF', t.total),
    ),
  );
}
