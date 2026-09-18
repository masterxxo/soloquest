import { describe, it, expect } from 'vitest';
import { createQuestSchema, updateQuestSchema } from './schemas';
import { createRecurringQuestSchema, updateRecurringQuestSchema } from './recurring';

// Regression guard for the Zod 4 `.partial()` behaviour: an inner `.default()` survives
// `.partial()`, so a default placed on the shared base object would make every PATCH
// carry `difficulty: 'E'` (and the route would then recompute xpReward from it). The
// update schemas must therefore be built from a default-free base — these tests pin that.
describe('quest schemas', () => {
  it('create defaults difficulty to E when omitted', () => {
    expect(createQuestSchema.parse({ title: 'x' }).difficulty).toBe('E');
  });

  it('update leaves an omitted difficulty omitted (no default leaks through .partial())', () => {
    const renamed = updateQuestSchema.parse({ title: 'renamed' });
    expect('difficulty' in renamed).toBe(false);
    expect(updateQuestSchema.parse({})).toEqual({});
  });

  it('update still writes an explicit difficulty as sent', () => {
    expect(updateQuestSchema.parse({ difficulty: 'B' }).difficulty).toBe('B');
  });
});

describe('recurring quest schemas', () => {
  it('create defaults difficulty to E when omitted', () => {
    const parsed = createRecurringQuestSchema.parse({ title: 'x', recurrenceType: 'daily' });
    expect(parsed.difficulty).toBe('E');
  });

  it('update leaves an omitted difficulty omitted (no default leaks through .partial())', () => {
    const renamed = updateRecurringQuestSchema.parse({ title: 'renamed' });
    expect('difficulty' in renamed).toBe(false);
    expect(updateRecurringQuestSchema.parse({})).toEqual({});
  });

  it('update still writes an explicit difficulty as sent', () => {
    expect(updateRecurringQuestSchema.parse({ difficulty: 'A' }).difficulty).toBe('A');
  });
});
