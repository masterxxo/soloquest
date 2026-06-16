import { z } from "zod";

export const createQuestSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  difficulty: z.enum(["E", "D", "C", "B", "A", "S"]).default("E"),
  deadline: z.coerce.date().nullable().optional(), // null = clear the deadline
});

export type CreateQuestInput = z.infer<typeof createQuestSchema>;

export const updateQuestSchema = createQuestSchema.partial();

export type UpdateQuestInput = z.infer<typeof updateQuestSchema>;

export const questIdParamSchema = z.object({ id: z.string().uuid() });

export const questListQuerySchema = z.object({
  status: z.enum(["active", "completed", "failed"]).optional(),
});