# Agent Bus — driving WWV from external tools

## Overview

The Agent Bus is an opt-in HTTP+SSE surface that lets a trusted external process — most commonly a [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server fronting an LLM agent — drive the running WWV browser session. The agent can fly the globe, toggle layers, focus entities, and select things by posting JSON actions to a server endpoint, which fans them out over SSE to every browser tab belonging to the same logged-in user.

Read-only camera and engine queries already work via the existing REST API. The Agent Bus is the missing **write path**.

```
LLM client  ──MCP──▶  szski/wwv-mcp  ──HTTP──▶  /api/agent/publish  ──SSE──▶  browser
(Claude, Cursor, …)   (separate repo)            (this PR adds these)         (Cesium flies)
```

## Enabling the bus

The bus is **off by default**. The subscriber early-returns and no SSE connection is opened. You explicitly opt in via a build-time environment variable.

### In Docker

Pass the ARG at build time:

```sh
docker build \
  --build-arg NEXT_PUBLIC_WWV_AGENT_BUS_ENABLED=true \
  -t worldwideview .
```

### In a Coolify / hosted build

Set `NEXT_PUBLIC_WWV_AGENT_BUS_ENABLED=true` in the build environment. Because it's a `NEXT_PUBLIC_*` variable, it is inlined into the JavaScript bundle at `next build` time — runtime-only env changes will not enable it.

### Verifying it's on

On a fresh page load, open the browser DevTools console. You should see a one-line build banner:

```
[wwv build] id=1714572934123 built_at=2026-05-13T18:35:34Z agent_bus=on
```

If `agent_bus=off` after enabling the env var, the build did not pick up the variable — re-check that it was passed as `--build-arg` (Docker) or set before `next build` ran (other hosts).

You can also hit `/api/build` to confirm the served bundle's build id and flag state.

## Using it — quick smoke test with curl

To verify the bus end-to-end without an MCP server, log into WWV in your browser, grab your `__Secure-authjs.session-token` cookie value from DevTools, and POST an action:

```sh
curl -X POST https://your-wwv-host/api/agent/publish \
  -H "Content-Type: application/json" \
  -H "Cookie: __Secure-authjs.session-token=PASTE_TOKEN_HERE" \
  -d '{"action":"fly_to","lat":35.7796,"lon":-78.6382,"distance":50000}'
```

If the bus is enabled and the cookie is valid, the open tab will fly to Raleigh and the response will be:

```json
{ "ok": true, "delivered": 1, "subscribers": 1 }
```

`subscribers: 0` means the bus is off in the build, the cookie's user has no open tabs, or the env var wasn't applied — see *Verifying* above.

## Using it — wiring an MCP server

The reference MCP server for WWV is published at **[szski/wwv-mcp](https://github.com/szski/wwv-mcp)**. It exposes 15 tools (`globe_fly_to`, `layer_toggle`, `engine_query`, `geocode`, `system_status`, etc.) and works with any MCP-aware client (Claude Code, Claude Desktop, Cursor, Continue, Cline).

> [!NOTE]
> `szski/wwv-mcp` lives in a contributor's namespace today and may move under the project's own organization later. Update the install URL accordingly when that happens.

### Install (Node)

```sh
git clone https://github.com/szski/wwv-mcp
cd wwv-mcp
npm install
npm run build
```

Then store credentials so the MCP server can auto-login at startup:

```sh
mkdir -p ~/.config/wwv-mcp
cat > ~/.config/wwv-mcp/credentials <<'EOF'
WWV_USERNAME=you@example.com
WWV_PASSWORD=your-password
EOF
chmod 600 ~/.config/wwv-mcp/credentials
```

### Install (Docker)

If a published image exists at `szski/wwv-mcp` (or wherever the maintainer mirrors it), no install step is needed — the MCP client config below uses `docker run` to launch the server on demand.

### Client config — Claude Code

Edit `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "wwv": {
      "command": "node",
      "args": ["/absolute/path/to/wwv-mcp/dist/index.js"],
      "env": {
        "WWV_BASE_URL": "https://your-wwv-host.example",
        "WWV_ENGINE_URL": "http://localhost:5001"
      }
    }
  }
}
```

Or, with Docker:

```json
{
  "mcpServers": {
    "wwv": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "WWV_BASE_URL=http://host.docker.internal:3000",
        "-e", "WWV_ENGINE_URL=http://host.docker.internal:5001",
        "szski/wwv-mcp:latest"
      ]
    }
  }
}
```

Then `/mcp` in Claude Code should list `wwv` with all 15 tools.

### Client config — Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows). The `mcpServers.wwv` block is identical to Claude Code above.

### Client config — Cursor, Continue, Cline

Each of these reads an MCP server list in its own settings UI but the shape of the entry — `command` + `args` + `env` — is the same as Claude Code's. See your client's MCP docs for the exact location of its config file.

### Verifying the wiring

Once configured, ask the agent something like *"What's the status of the WWV system?"* — it should call `system_status` and report back. If you see `agent_bus_enabled: false`, the bus is off in the WWV build; fix that before trying write tools like `globe_fly_to`.

## Security and multi-tenancy

- **Default off.** Without the env var, the subscriber doesn't open a connection, the publish endpoint exists but has no subscribers, and the bundle's dead-code elimination removes the `EventSource` constructor entirely.
- **Auth gated.** Both `/api/agent/publish` and `/api/agent/stream` use the same `auth()` helper as the rest of the marketplace API. No tokens — just the existing Auth.js session cookie.
- **Per-user scoping.** Subscriptions live in `Map<userId, …>`, so a publish from user A's session never reaches user B's stream, even though both sit on the same Node process. Multi-tenant deployments are safe.
- **Same trust model as a browser tab.** An MCP server "acts as the user" by holding the user's session cookie. If you wouldn't trust a browser tab on the same machine, don't give an MCP server the cookie.
- **Single-process only.** The `AgentBus` is in-memory and process-local. Multi-instance deployments behind a load balancer would need a Redis pub/sub adapter — about 30 lines of additional code, not included here.

## Endpoint reference

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/agent/stream` | SSE channel. Auth-gated. Streams `AgentAction` JSON events for the connected user. Heartbeat every 25s. |
| `POST` | `/api/agent/publish` | Accept an `AgentAction` JSON body, broadcast to the publishing user's subscribers, return `{ok, delivered, subscribers}`. |
| `GET` | `/api/build` | Build id + ISO timestamp + `NEXT_PUBLIC_*` flag state. Used by `AgentBusSubscriber` to print the build banner. |

`AgentAction` is currently a six-verb union: `fly_to`, `face_towards`, `layer_toggle`, `highlight_layer`, `select_entity`, `ping`. The shape is `{action: string, …payload}` JSON, so additive changes are backwards-compatible.

## Companion repos

- **[szski/wwv-mcp](https://github.com/szski/wwv-mcp)** — reference MCP server. 15 tools. Required for any LLM-driven use of the bus.
- **[silvertakana/wwv-data-engine](https://github.com/silvertakana/wwv-data-engine)** — separate repo, supplies the read-only `engine_query` data that the MCP server's read tools wrap.
