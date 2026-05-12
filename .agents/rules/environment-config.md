# Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | JWT signing secret (generate with `openssl rand -hex 32`) |
| `NEXT_PUBLIC_CESIUM_ION_TOKEN` | No | Cesium Ion access token |
| `NEXT_PUBLIC_BING_MAPS_KEY` | No | Bing Maps imagery |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | No | Google 3D Tiles |
| `NEXT_PUBLIC_WWV_EDITION` | No | `local` / `cloud` / `demo` (default: `local`) |
| `NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL` | No | Override engine WebSocket URL (default: cloud) |
| `OPENSKY_CREDENTIALS` | No | Comma-separated `id:secret` pairs for credential rotation |
| `WWV_BRIDGE_TOKEN` | No | Shared secret for marketplace → WWV install bridge |
| `WWV_DEMO_ADMIN_SECRET` | No | Demo edition admin password |
| `IRANWARLIVE_BACKEND_URL` | No | Override for IranWarLive custom backend URL |

Secrets go in `.env.local` (gitignored). Non-secrets go in `.env` (committed).
