import { z } from "zod";

export const createCampaignSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  difficulty: z.enum(["E", "D", "C", "B", "A", "S"]).default("E"),
  deadline: z.coerce.date().nullable().optional(), // null = clear the deadline
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

// Reusable status enum so the value set lives in one place (mirrors the DB enum).
export const campaignStatusSchema = z.enum(["active", "clearing", "completed"]);
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;

// Partial create + the status field. Status transitions are driven by the dedicated
// /start and /complete endpoints; it's accepted here too for completeness.
export const updateCampaignSchema = createCampaignSchema.partial().extend({
  status: campaignStatusSchema.optional(),
});

export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

export const campaignIdParamSchema = z.object({ id: z.string().uuid() });
