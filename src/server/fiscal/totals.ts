import Decimal from 'decimal.js';
import type { Item } from '../../shared/contracts';
import { AppError } from '../errors';
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const D = (v: string | number) => new Decimal(v);
const money = (v: Decimal) => v.toFixed(2);
const percent = (base: string, rate: string) => money(D(base).mul(rate).div(100));
export function calculateItem(item: Item, crt: string, index: number) {
  const total = money(D(item.quantity).mul(item.unitPrice));
  if (D(item.discount).gt(total))
    throw new AppError('INVALID_DISCOUNT', 'Desconto maior que o valor do item', 422, {
      [`items.${index}.discount`]: 'Desconto excede o valor dos produtos',
    });
  const net = D(total)
    .minus(item.discount)
    .plus(item.freight)
    .plus(item.insurance)
    .plus(item.other);
  const ic = item.taxes.icms,
    code = crt === '1' ? ic.csosn : ic.cst;
  const own = ['00', '10', '20'].includes(code),
    st = ['10', '201', '202', '203'].includes(code);
  const base = own
    ? money(ic.base ? D(ic.base) : net.mul(code === '20' ? D(100).minus(ic.reduction).div(100) : 1))
    : '0.00';
  const icms = own ? percent(base, ic.rate) : '0.00';
  const stBase = st
    ? money(ic.stBase ? D(ic.stBase) : net.mul(D(1).plus(D(ic.stMva).div(100))))
    : '0.00';
  const stValue = st
    ? money(Decimal.max(0, D(stBase).mul(ic.stRate).div(100).minus(icms)))
    : '0.00';
  function contribution(t: Item['taxes']['pis']) {
    const nt = ['04', '05', '06', '07', '08', '09'].includes(t.cst),
      b = money(t.base ? D(t.base) : net);
    const quantity = t.quantityBase || item.quantity;
    return {
      base: nt ? '0.00' : b,
      value: nt
        ? '0.00'
        : t.cst === '03'
          ? money(D(quantity).mul(t.quantityRate))
          : percent(b, t.rate),
      quantity,
    };
  }
  const ip = item.taxes.ipi,
    ipiTaxed = ip.enabled && ['00', '49', '50', '99'].includes(ip.cst);
  const ipiBase = ipiTaxed ? money(ip.base ? D(ip.base) : net) : '0.00',
    ipi = ipiTaxed ? percent(ipiBase, ip.rate) : '0.00';
  const taxQuantity = item.taxQuantity || D(item.quantity).mul(item.taxFactor).toFixed(4);
  const taxUnitPrice = item.taxUnitPrice || D(item.unitPrice).div(item.taxFactor).toFixed(10);
  if (D(taxQuantity).lte(0) || D(taxQuantity).mul(taxUnitPrice).minus(total).abs().gt('0.01'))
    throw new AppError(
      'INVALID_TAX_QUANTITY',
      'Quantidade × valor tributáveis devem corresponder ao valor do produto',
      422,
      { [`items.${index}.taxQuantity`]: 'Confira quantidade e valor unitário tributáveis' },
    );
  const amounts = {
    total,
    base,
    icms,
    stBase,
    stValue,
    credit: ['101', '201'].includes(code) ? percent(money(net), ic.creditRate) : '0.00',
    ipiBase,
    ipi,
    pis: contribution(item.taxes.pis),
    cofins: contribution(item.taxes.cofins),
    taxQuantity,
    taxUnitPrice,
    code,
  };
  return { ...item, amounts };
}
export type CalculatedItem = ReturnType<typeof calculateItem>;
export function calculate(items: Item[], crt: string) {
  const calculated = items.map((x, i) => calculateItem(x, crt, i));
  const sum = (fn: (i: CalculatedItem) => string) =>
    money(calculated.reduce((acc, i) => acc.plus(fn(i)), D(0)));
  const totals = {
    products: sum((i) => i.amounts.total),
    discount: sum((i) => i.discount),
    freight: sum((i) => i.freight),
    insurance: sum((i) => i.insurance),
    other: sum((i) => i.other),
    icmsBase: sum((i) => i.amounts.base),
    icms: sum((i) => i.amounts.icms),
    stBase: sum((i) => i.amounts.stBase),
    st: sum((i) => i.amounts.stValue),
    ipi: sum((i) => i.amounts.ipi),
    pis: sum((i) => i.amounts.pis.value),
    cofins: sum((i) => i.amounts.cofins.value),
    total: '0.00',
  };
  totals.total = money(
    D(totals.products)
      .minus(totals.discount)
      .plus(totals.freight)
      .plus(totals.insurance)
      .plus(totals.other)
      .plus(totals.st)
      .plus(totals.ipi),
  );
  for (const value of Object.values(totals))
    if (D(value).gt('9999999999999.99'))
      throw new AppError('TOTAL_LIMIT', 'Total excede o limite do layout NF-e');
  return { items: calculated, totals };
}
