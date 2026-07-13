import { compareDifficulty, type Difficulty } from '@soloquest/shared';

/**
 * The parent a quest ends up with after a PATCH. `parentId` is nullable in the update
 * schema, so the three cases differ:
 *   omitted (undefined) → keep the stored parent,
 *   explicit null       → promote to a top-level quest,
 *   a uuid              → re-parent.
 * Collapsing the first two (e.g. `input.parentId ?? existing.parentId`) would either
 * lose the stored parent or resurrect a parent the caller just cleared.
 */
export function effectiveParentId(
  inputParentId: string | null | undefined,
  existingParentId: string | null,
): string | null {
  return inputParentId !== undefined ? inputParentId : existingParentId;
}

/**
 * Non-blocking rank sanity check: a sub-task shouldn't out-rank its parent quest.
 * Pure — the caller loads the parent. Returns human-readable warnings; never rejects.
 */
export function rankWarnings(
  difficulty: Difficulty,
  parent: { difficulty: Difficulty } | null,
): string[] {
  if (parent && compareDifficulty(difficulty, parent.difficulty) > 0) {
    return [`Sub-task rank (${difficulty}) exceeds Quest rank (${parent.difficulty})`];
  }
  return [];
}
