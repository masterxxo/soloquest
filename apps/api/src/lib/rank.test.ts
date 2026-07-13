import { describe, it, expect } from 'vitest';
import { effectiveParentId, rankWarnings } from './rank';

describe('effectiveParentId', () => {
  it('keeps the stored parent when the PATCH omits parentId', () => {
    expect(effectiveParentId(undefined, 'parent-1')).toBe('parent-1');
  });

  it('clears the parent when the PATCH sends an explicit null', () => {
    expect(effectiveParentId(null, 'parent-1')).toBeNull();
  });

  it('re-parents when the PATCH sends a new parentId', () => {
    expect(effectiveParentId('parent-2', 'parent-1')).toBe('parent-2');
  });

  it('stays top-level when neither the PATCH nor the stored quest has a parent', () => {
    expect(effectiveParentId(undefined, null)).toBeNull();
  });
});

describe('rankWarnings', () => {
  it('warns when the sub-task out-ranks its parent', () => {
    expect(rankWarnings('S', { difficulty: 'C' })).toEqual([
      'Sub-task rank (S) exceeds Quest rank (C)',
    ]);
  });

  it('stays silent when the sub-task ranks below its parent', () => {
    expect(rankWarnings('E', { difficulty: 'C' })).toEqual([]);
  });

  it('stays silent when the ranks are equal', () => {
    expect(rankWarnings('C', { difficulty: 'C' })).toEqual([]);
  });

  it('stays silent for a top-level quest (no parent)', () => {
    expect(rankWarnings('S', null)).toEqual([]);
  });

  it('warns for a PATCH that only raises the difficulty of an existing sub-task', () => {
    // The regression A-M7 fixes: the parent comes from the stored quest, not the request.
    const parent = { difficulty: 'D' } as const;
    expect(rankWarnings('A', parent)).toEqual([
      'Sub-task rank (A) exceeds Quest rank (D)',
    ]);
  });
});
