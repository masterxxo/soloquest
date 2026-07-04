import { z } from "zod";
import { DIFFICULTY_ORDER, QUEST_STATUS } from "./enums";

export const createQuestSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  difficulty: z.enum(DIFFICULTY_ORDER).default("E"),
  deadline: z.coerce.date().nullable().optional(), // null = clear the deadline
  parentId: z.string().uuid().nullable().optional(), // null = promote to top-level quest
});

export type CreateQuestInput = z.infer<typeof createQuestSchema>;

export const updateQuestSchema = createQuestSchema.partial();

export type UpdateQuestInput = z.infer<typeof updateQuestSchema>;

export const questIdParamSchema = z.object({ id: z.string().uuid() });

export const questListQuerySchema = z.object({
  status: z.enum(QUEST_STATUS).optional(),
  // Filter by parent: a uuid returns that quest's sub-tasks; "null" returns only
  // top-level quests (those with no parent).
  parentId: z.union([z.string().uuid(), z.literal("null")]).optional(),
  // include=subTasks attaches each quest's sub-tasks to the response rows.
  include: z.literal("subTasks").optional(),
});