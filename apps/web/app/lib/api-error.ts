// Reading a failed API response. Every backend error — thrown or returned — is shaped
// as `{ error: string }` (route handlers + the global app.onError), so one helper can
// pull the message out of any non-ok response.
export type ApiError = {
  status: number;
  message: string;
};

// Never throws: a missing body, non-JSON body or missing `error` field falls back to the
// caller's message, then to the status text. Takes a plain Response, so it accepts any
// Hono RPC ClientResponse regardless of which status the route union narrowed to.
export async function readApiError(
  res: Response,
  fallback = 'Something went wrong.',
): Promise<ApiError> {
  const status = res.status;
  try {
    const body: unknown = await res.json();
    if (body && typeof body === 'object' && 'error' in body) {
      const message = (body as { error: unknown }).error;
      if (typeof message === 'string' && message.trim()) return { status, message };
    }
  } catch {
    // Body was empty, already consumed, or not JSON — fall through to the fallback.
  }
  return { status, message: fallback || res.statusText };
}
