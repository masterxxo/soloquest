# SoloQuest API

Hono backend (`@soloquest/api`). Quests, rituals, tags, auth, and the remote MCP endpoint.

## Remote MCP

Streamable HTTP MCP lives at **`/api/mcp`** on this process (same origin as the rest of `/api`).

1. Apply the DB migration that creates the `apikey` table (`packages/db` — user runs `pnpm --filter @soloquest/db db:migrate`).
2. Sign in on the web app → **Status** → **API keys** → create a key (prefix `sq_`). Copy the secret once.
3. Point your MCP host at the endpoint with a Bearer token:

```json
{
  "mcpServers": {
    "soloquest": {
      "url": "https://soloquest.rogson.dev/api/mcp",
      "headers": {
        "Authorization": "Bearer sq_…"
      }
    }
  }
}
```

Locally, use `http://localhost:3001/api/mcp` (or your Nuxt origin if `/api` is proxied — the MCP path is still on the API port unless the reverse proxy forwards it).

### Tools (v1)

| Tool | Action |
|------|--------|
| `list-quests` | List quests (optional status / parentId / subTasks) |
| `get-quest` | Fetch one quest by id |
| `create-quest` | Create a quest (title + description required) |
| `update-quest` | Patch an active quest |

A key authenticates as the owning user for the whole API (same power as a session cookie). Revoke unused keys from Status.
