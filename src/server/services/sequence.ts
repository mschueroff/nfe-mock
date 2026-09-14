import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { Store } from '../repositories/store';
import { AppError } from '../errors';
import { AccessKeyService } from '../fiscal/access-key';
import { sequences } from '../../../db/schema';
import type { Draft, Emitter } from '../../shared/contracts';

/** Reservation participates in the caller's transaction, including artifact generation. */
export class NFeSequenceService {
  constructor(private store: Store) {}
  get(emitterId: string, serie: number) {
    return this.store.sequence(emitterId, serie) || { next_number: 1, next_code: 1 };
  }
  reserve(draft: Draft, emitter: Emitter) {
    const s = this.store;
    if (!s.raw.inTransaction)
      throw new AppError('TRANSACTION_REQUIRED', 'Reserva exige uma transação ativa', 500);
    const now = new Date().toISOString();
    s.db
      .insert(sequences)
      .values({
        id: randomUUID(),
        emitterId: draft.emitterId,
        serie: draft.serie,
        nextNumber: 1,
        nextCode: 1,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .run();
    const sequence = s.sequence(draft.emitterId, draft.serie)!;
    const number = draft.manualNumber === '' ? sequence.next_number : draft.manualNumber;
    if (number > 999999999)
      throw new AppError('SEQUENCE_EXHAUSTED', 'Numeração esgotada nesta série');
    if (
      s.raw
        .prepare('SELECT id FROM invoices WHERE emitter_id=? AND serie=? AND number=?')
        .get(draft.emitterId, draft.serie, number)
    )
      throw new AppError('DUPLICATE_NUMBER', 'Número já utilizado neste emitente e série', 409);
    const numericCode = AccessKeyService.numeric(emitter.numericCodeMode, sequence.next_code);
    s.db
      .update(sequences)
      .set({
        nextNumber: Math.max(sequence.next_number, number + 1),
        nextCode:
          emitter.numericCodeMode === 'SEQUENTIAL' ? sequence.next_code + 1 : sequence.next_code,
        updatedAt: now,
      })
      .where(eq(sequences.id, sequence.id))
      .run();
    return { number, numericCode };
  }
  reset(emitterId: string, serie: number, next: number, expected: number) {
    return this.store.reset(emitterId, serie, next, expected);
  }
}
