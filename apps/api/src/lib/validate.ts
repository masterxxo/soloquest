import { zValidator as baseZValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';

// The schema type @hono/zod-validator itself accepts (zod v3 or v4) — read off its own
// signature so this module doesn't need a direct zod dependency.
type ZodSchemaLike = Parameters<typeof baseZValidator>[1];

interface ValidationIssue {
  path: PropertyKey[];
  message: string;
}

/**
 * Flatten a ZodError into one human-readable line: "title: Too small; deadline: Invalid date".
 * The error is typed as a zod-version-dependent conditional, so its concrete shape is only
 * known at the call site; both versions expose `issues`, which is all we read.
 */
function formatValidationError(error: unknown): string {
  const issues = (error as { issues?: ValidationIssue[] }).issues ?? [];
  const details = issues
    .map((issue) =>
      issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
    )
    .join('; ');
  return details.length > 0 ? details : 'Invalid request';
}

/**
 * zValidator with the API's uniform failure body. @hono/zod-validator's default hook
 * answers a rejected request with the raw ZodError dump; this one answers with
 * `400 { error: "title: Too small" }`, the single error shape used everywhere in the API
 * (see also app.onError in index.ts). Use this instead of the library's zValidator.
 */
export function zValidator<T extends ZodSchemaLike, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return baseZValidator(target, schema, (result, c) => {
    if (result.success) return;
    return c.json({ error: formatValidationError(result.error) }, 400);
  });
}
