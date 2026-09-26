# MCP Quickstart: Connect an AI Agent to WorldWideView

Connect Claude Desktop, Cursor, or any MCP-compatible client to your own WorldWideView
globe. MCP ships in every edition - the **local (self-hosted)** app you run yourself, and
the **cloud** instance you sign in to.

> **Your endpoint is your own origin.** In every edition the app derives the MCP URL from
> the page you are on: `http://localhost:<port>/api/mcp` locally, and
> `https://<your-instance>.cloud-wwv.dev/api/mcp` on a cloud instance. Nothing is baked
> in, so the "Connect your agent" panel always shows your instance's real URL. See
> "Cloud edition" at the end.

---

## Prerequisites

- The WorldWideView repository, run locally (this is the **local edition**, the default).
- Node.js 20+, pnpm 9+, and Docker (Docker is needed for Postgres, and for Redis + the
  data engine if you want command tools and live data).
- An MCP-compatible client: Claude Desktop, Cursor, VS Code with an MCP extension, or any
  client that supports the Streamable HTTP MCP transport.

---

## Step 1: Install and configure

From the repository root:

```bash
pnpm install
pnpm setup      # generates AUTH_SECRET and your local .env (required for API keys to work)
```

`pnpm setup` writes a random `AUTH_SECRET` into `.env`. In the local edition that same
secret signs your MCP API keys, so this step is required before key generation will work.
The edition defaults to `local` (`WWV_EDITION=local`, with fallback to the `NEXT_PUBLIC_WWV_EDITION` build-time bake).

---

## Step 2: Run the app

Two ways to run it, depending on which tools you need:

```bash
pnpm dev        # frontend + Postgres only. Read/query tools work. Command tools and live
                # data do NOT (no Redis, no data engine).

pnpm dev:all    # frontend + data engine + Redis (via Docker Compose). Everything works:
                # read tools, command tools (open-tab control), geocoding, and live data.
```

Use `pnpm dev:all` for the full MCP experience. The app comes up at
**http://localhost:3000** (it will pick another port if 3000 is taken; check the startup log).

| You want... | Run | Why |
|---|---|---|
| `search_entities`, `get_plugin_data`, `list_available_plugins`, favorites | `pnpm dev` is enough | served from Postgres + the local data-source registry |
| `geocode_location`, command tools (`pan_globe`, `fly_to`, `toggle_layer`, ...) | `pnpm dev:all` | need Redis (sessions, command queue, geocode cache) |
| Live plugin data on the globe and in data tools | `pnpm dev:all` | needs the data engine |

---

## Step 3: Sign in and generate an API key

1. Open **http://localhost:3000** and sign in. On a first run, create the initial account
   via the app's setup flow (see the project README for first-user setup).
2. Open **Settings -> API and MCP Access**.
3. Click **Generate new key**, give it a name, and **copy the key immediately** (it is shown
   only once). Your key looks like `wwv_abc123.<long-secret>`.

The same panel ("Connect your agent") shows a ready-to-paste config block with your
endpoint already filled in - the app derives it from the page origin (`http://localhost:3000/api/mcp`
when you are on the local app).

---

## Step 4: Add the MCP server to your client

Paste this into your client's MCP configuration (e.g. `claude_desktop_config.json` for
Claude Desktop, or the Cursor MCP settings). The endpoint is your own app's origin plus `/api/mcp` (here, the local app):

```json
{
  "mcpServers": {
    "worldwideview": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer wwv_<your-key-here>"
      }
    }
  }
}
```

Replace `wwv_<your-key-here>` with the key from step 3. The key goes in the `Authorization`
header, never in the URL.

---

## Step 5: Restart your client and verify

Restart your MCP client (Claude Desktop needs a full app restart; Cursor reloads
automatically). Ask the agent: "List the available WorldWideView plugins" - it should call
`list_available_plugins`. If you started with `pnpm dev:all` and have plugins streaming, you
will see them; otherwise see the troubleshooting notes about `engine_unreachable` /
`no_active_plugins` below (those mean the connection works but the engine is down or idle).

---

## Two capability tiers

WorldWideView MCP tools split into two tiers based on whether a browser globe session is
required.

### Read / query tools (no open tab required)

These run server-side and return data using only your API key. You do not need the globe open.
The server registers **22 tools**; `tools/list` on a running instance is the authority, and the
"Connect your agent" panel prints that same list from the server's own registry.

| Tool | What it does |
|---|---|
| `search_entities` | Search entities by name across active plugins |
| `get_entities_in_region` | Find entities inside a lat/lng bounding box |
| `get_entity_details` | Get full details for one entity |
| `get_plugin_data` | Get the current snapshot of all entities for a plugin |
| `list_available_plugins` | List streaming plugins and their status |
| `geocode_location` | Resolve a place name or address to coordinates (needs Redis) |
| `save_favorite` | Bookmark an entity |
| `list_favorites` | List your bookmarks |
| `update_favorite` | Rename or annotate a bookmark |
| `remove_favorite` | Delete a bookmark |
| `get_plugin_filters` | List filterable fields a plugin declares |
| `find_nearby_entities` | Find entities within a radius of a point |
| `get_regional_analytics` | Aggregate entity counts per plugin across a region |
| `investigate_area` | Summarise what is live in an area, plugin by plugin |
| `get_globe_context` | Report the globe's live state: camera, layers, filters, attached tabs |

### Command / control tools (open globe tab required)

These control the live 3D globe in your browser. **You must keep a WorldWideView browser tab
open and signed in as the same account.** Without an open tab, the command is accepted but has
no visible effect and the tool returns `"no active globe session to control"`. These also need
Redis (run `pnpm dev:all`).

| Tool | What it does |
|---|---|
| `pan_globe` | Fly the camera to a coordinate |
| `fly_to` | Fly the camera to a geocoded coordinate or bounding box |
| `focus_entity` | Centre the camera on a known entity |
| `toggle_layer` | Enable or disable a plugin data layer |
| `set_timeline` | Set playback time, window, or mode |
| `set_filter` | Apply filters to a plugin's live layer |
| `clear_filter` | Clear filters on one or all plugins |

---

## Recommended agent prompt

The **"Connect your agent" panel generates this brief for you**: your own MCP endpoint, the
tool list the server really registers, and a `mcpServers` config block with your key already in
the Authorization header. Use its **Copy** button - one click, one paste into your harness -
rather than writing a prompt by hand; a hand-written prompt drifts from the server's real tool
surface, which is how the panel came to advertise a tool that did not exist.

If you want a starting prompt of your own, keep the two facts an agent cannot guess:

```
You have access to WorldWideView (WWV) via MCP -- a live 3D globe streaming real-world data
(aviation, shipping, earthquakes, weather, and more). Use the MCP tools to query entities,
move the camera, toggle layers, and filter data. The endpoint and the API key are in your
mcpServers config; the key goes in the Authorization header, never in the URL. Command tools
require the user to have the WWV globe open in a browser tab. Read/query tools work without
a browser tab.
```

---

## Troubleshooting

**"no active globe session to control"**
A command tool (pan_globe, fly_to, toggle_layer, etc.) ran but no globe tab is open. Open
http://localhost:3000 in a browser tab, sign in as the same account that owns the API key,
and keep the tab open while you use the agent. Also make sure you started with `pnpm dev:all`
(command tools need Redis).

**"engine_unreachable" from list_available_plugins**
The data engine is not running or `WWV_DATA_ENGINE_URL` is not set. Start it with
`pnpm dev:all`. The MCP connection itself is working.

**"no_active_plugins" from list_available_plugins**
The data engine is up but no plugins are currently streaming. Enable a plugin from the
Plugins panel in the globe app.

**401 Unauthorized**
Your API key is invalid or revoked, or `pnpm setup` was never run (no `AUTH_SECRET`).
Confirm `.env` has `AUTH_SECRET`, then generate a fresh key in Settings > API and MCP Access.

**Tools do not appear in my client**
Restart the client after editing the config file. For Claude Desktop, a full app
quit-and-relaunch is required.

---

## Cloud edition

Cloud instances run at **`https://<your-instance>.cloud-wwv.dev`** - one subdomain per
tenant. The ecosystem hub and sign-in live at `https://worldwideview.dev`, and the public
demo globe is at `https://demo.worldwideview.dev`.

The flow is the same as the local steps above, with two differences:

- You sign in at your own instance (`https://<your-instance>.cloud-wwv.dev`) instead of
  running the app locally. It is the same account identity you use across the ecosystem.
- The MCP endpoint is **your instance's own origin plus `/api/mcp`**:
  `https://<your-instance>.cloud-wwv.dev/api/mcp`. The app derives it from the page origin,
  so the "Connect your agent" panel fills in the right URL for your instance - you never
  paste a host by hand.
- Infrastructure (Redis, the data engine, secrets) is operated for you, so there is no
  `pnpm setup` / `pnpm dev:all` step.

Everything else - generating a key, the Authorization header, the two capability tiers, and
the open-tab requirement for command tools - is identical.

> Canonical domain map and probe evidence:
> [ADR-0010](architecture/decisions/adr-0010-ecosystem-domain-map-and-tenant-endpoints.md).

---

## Next steps

- See [plugin-filter-guide.md](plugin-filter-guide.md) to learn how to use `get_plugin_filters`
  and `set_filter` to filter live plugin data.
- See [plugin-quickstart.md](plugin-quickstart.md) to build your own data plugin.
