import type { Context } from 'hono';
import type { Hono } from 'hono';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { auth } from '../auth';
import type { Variables } from '../middleware/auth';
import type { ApiProxy } from './types';
import { registerQuestTools } from './tools/quests';

/** Pull the raw API key from Bearer or x-api-key (same rules as the Better Auth getter). */
export function extractApiKey(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length).trim();
    return token.length > 0 ? token : null;
  }
  const header = request.headers.get('x-api-key');
  return header && header.length > 0 ? header : null;
}

function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: {
      'content-type': 'application/json',
      'www-authenticate': 'Bearer realm="soloquest-mcp"',
    },
  });
}

/**
 * In-process fetch against the Hono app, authenticated with the caller's API key.
 * Keeps ownership / Zod / XP logic on the existing quest routes.
 */
export function createApiProxy(app: Hono<{ Variables: Variables }>, apiKey: string): ApiProxy {
  return async function apiProxy(path, init = {}) {
    const headers = new Headers(init.headers);
    headers.set('x-api-key', apiKey);
    if (init.body != null && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
    const response = await app.request(path, { ...init, headers });
    const text = await response.text();
    let body: unknown = text;
    if (text.length > 0) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = text;
      }
    } else {
      body = null;
    }
    return { ok: response.ok, status: response.status, body };
  };
}

function createQuestMcpServer(apiProxy: ApiProxy): McpServer {
  const server = new McpServer({
    name: 'soloquest',
    version: '1.0.0',
  });
  registerQuestTools(server, apiProxy);
  return server;
}

/**
 * Streamable HTTP MCP at /api/mcp. Stateless: one server+transport per request,
 * tools close over the verified API key and proxy to /api/quests.
 */
export async function handleMcpRequest(
  c: Context<{ Variables: Variables }>,
  app: Hono<{ Variables: Variables }>,
): Promise<Response> {
  const apiKey = extractApiKey(c.req.raw);
  if (!apiKey) return unauthorizedResponse();

  // Verify the key explicitly. Hosts send Authorization: Bearer; quest proxy uses
  // x-api-key so enableSessionForAPIKeys can mint a session on the in-process routes.
  const verified = await auth.api.verifyApiKey({ body: { key: apiKey } });
  if (!verified.valid) return unauthorizedResponse();

  const apiProxy = createApiProxy(app, apiKey);
  const server = createQuestMcpServer(apiProxy);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
}
