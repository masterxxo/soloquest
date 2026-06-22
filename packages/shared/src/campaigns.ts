import { z } from "zod";

export const createCampaignSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  difficulty: z.enum(["E", "D", "C", "B", "A", "S"]).default("E"),
  deadline: z.coerce.date().nullable().optional(), // null = clear the deadline
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

// Partial create + the status transition (active ⇄ completed) is editable here.
export const updateCampaignSchema = createCampaignSchema.partial().extend({
  status: z.enum(["active", "completed"]).optional(),
});

export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

export const campaignIdParamSchema = z.object({ id: z.string().uuid() });
