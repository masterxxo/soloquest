import type { CampaignStatus } from '@soloquest/shared';

// Display label + colour for each campaign status. Single source so the list card
// and the detail view render the status identically.
export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  active: 'Active',
  clearing: 'Clearing',
  completed: 'Completed',
};

export const CAMPAIGN_STATUS_COLOR: Record<CampaignStatus, string> = {
  active: '#8174b8', // muted purple — issued, untouched
  clearing: '#3fa7ff', // System blue — actively being worked
  completed: '#3fbf6f', // green — done
};
