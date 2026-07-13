// Cross-cutting constants shared by the routes, the daily cron and the pure date helpers.

/**
 * Milliseconds in one calendar day. Only ever added to dates pinned at UTC midnight
 * (see getUserDate), so it never drifts across DST boundaries.
 */
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Timezone used whenever a user has no (or an unusable) timezone of their own. */
export const DEFAULT_TIMEZONE = 'UTC';
