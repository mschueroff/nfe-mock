import type { Draft, Emitter, Recipient } from '../../shared/contracts';
import type { calculate } from './totals';
export type FiscalDocument = {
  draft: Draft;
  emitter: Emitter;
  recipient: Recipient;
  number: number;
  numericCode: string;
  accessKey: string;
} & ReturnType<typeof calculate>;
export interface NFeSigner {
  sign(xml: string): Promise<string>;
}
export class NoOpNFeSigner implements NFeSigner {
  async sign(xml: string) {
    return xml;
  }
}
