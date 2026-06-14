import { z } from "zod";

export const createQuestSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  difficulty: z.enum(["E", "D", "C", "B", "A", "S"]).default("E"),
  deadline: z.coerce.date().optional(),
});

export type CreateQuestInput = z.infer<typeof createQuestSchema>;