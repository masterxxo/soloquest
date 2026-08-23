export type ApiProxy = (
  path: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; body: unknown }>;
