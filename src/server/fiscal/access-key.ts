import { randomInt } from 'node:crypto';
import { AppError } from '../errors';
import { UF_CODES } from '../../shared/contracts';
export class AccessKeyService {
  static pad(value: string | number, length: number): string {
    const s = String(value);
    if (!/^\d+$/.test(s) || s.length > length)
      throw new AppError('INVALID_KEY_COMPONENT', `Componente deve possuir até ${length} dígitos`);
    return s.padStart(length, '0');
  }
  static dv(base: string): string {
    if (!/^\d{43}$/.test(base))
      throw new AppError('INVALID_KEY', 'Base da chave deve ter 43 dígitos');
    let sum = 0;
    for (let i = 42; i >= 0; i--) sum += Number(base[i]) * (((42 - i) % 8) + 2);
    const rem = sum % 11;
    return String(rem < 2 ? 0 : 11 - rem);
  }
  static valid(key: string) {
    return /^\d{44}$/.test(key) && this.dv(key.slice(0, 43)) === key[43];
  }
  static build(v: {
    uf: string;
    issueDate: string;
    cnpj?: string;
    document?: string;
    serie: number;
    number: number;
    numericCode: string;
    emission?: string;
  }): string {
    const document = v.document ?? v.cnpj ?? '';
    if (
      !UF_CODES[v.uf] ||
      !/^(\d{11}|\d{14})$/.test(document) ||
      !/^\d{4}-\d{2}-/.test(v.issueDate)
    )
      throw new AppError('INVALID_KEY', 'UF, CPF/CNPJ ou data inválidos');
    const base =
      UF_CODES[v.uf] +
      v.issueDate.slice(2, 4) +
      v.issueDate.slice(5, 7) +
      this.pad(document, 14) +
      '55' +
      this.pad(v.serie, 3) +
      this.pad(v.number, 9) +
      (v.emission || '1') +
      this.pad(v.numericCode, 8);
    return base + this.dv(base);
  }
  static numeric(mode: 'RANDOM' | 'SEQUENTIAL', next: number) {
    if (mode === 'RANDOM') return this.pad(randomInt(0, 100000000), 8);
    if (next > 99999999) throw new AppError('SEQUENCE_EXHAUSTED', 'cNF esgotado nesta série');
    return this.pad(next, 8);
  }
}
