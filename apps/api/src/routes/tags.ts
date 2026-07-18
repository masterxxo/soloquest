import { Hono } from 'hono';
import { db } from '@soloquest/db/client';
import { createTagSchema, updateTagSchema, tagIdParamSchema } from '@soloquest/shared';
import { requireAuth, type Variables } from '../middleware/auth';
import { zValidator } from '../lib/validate';
import {
  listUserTags,
  createOrGetTag,
  updateTag,
  deleteTag,
} from '../lib/tags';

// Chained so Hono RPC can infer the route types end-to-end.
export const tagsRouter = new Hono<{ Variables: Variables }>()
  .use('*', requireAuth)

  // List the caller's tags, ordered by name, each with its usage count (quests pinning it).
  .get('/', async (c) => {
    const userId = c.get('user')!.id;
    return c.json(await listUserTags(db, userId));
  })

  // Create a tag — or return the existing one on a normalized-name collision (200, not an
  // error), so on-the-fly creation from the quest form never races into a duplicate. Colour
  // is optional; omitted → derived deterministically from the name server-side.
  .post('/', zValidator('json', createTagSchema), async (c) => {
    const userId = c.get('user')!.id;
    const { name, color } = c.req.valid('json');
    const tag = await createOrGetTag(db, userId, name, color);
    return c.json(tag);
  })

  // Update a tag (rename and/or recolour), scoped to the owner. A name collision with a
  // different tag is a 409; changing only the casing of the same tag is allowed.
  .patch(
    '/:id',
    zValidator('param', tagIdParamSchema),
    zValidator('json', updateTagSchema),
    async (c) => {
      const userId = c.get('user')!.id;
      const { id } = c.req.valid('param');
      const { name, color } = c.req.valid('json');

      if (name === undefined && color === undefined) {
        return c.json({ error: 'No fields to update' }, 400);
      }

      const result = await updateTag(db, userId, id, { name, color });
      if ('error' in result) {
        return result.error === 'not_found'
          ? c.json({ error: 'Tag not found' }, 404)
          : c.json({ error: 'A tag with this name already exists' }, 409);
      }
      return c.json(result.tag);
    },
  )

  // Delete a tag; its quest_tags links cascade away, the quests stay.
  .delete('/:id', zValidator('param', tagIdParamSchema), async (c) => {
    const userId = c.get('user')!.id;
    const { id } = c.req.valid('param');
    const removed = await deleteTag(db, userId, id);
    if (!removed) return c.json({ error: 'Tag not found' }, 404);
    return c.json({ success: true });
  });
