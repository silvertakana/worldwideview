**Describe the bug**
Plugins fail to load on the production Coolify deployment:
1. `military-bases` fails to load with `ManifestLoadError: Failed to load valid WorldPlugin from bundle`.
2. Several runtime plugins (satellite, iranwarlive, gps-jamming) try to fetch from `localhost:5001` resulting in connection refused in production.

**To Reproduce**
1. Deploy WWV to a non-local environment like Coolify.
2. Enable `military-bases`. Observe error in console.
3. Enable `satellite` or other data plugins. Observe the browser network tab failing to reach `localhost:5001`.

**Expected behavior**
Plugins correctly inherit `NEXT_PUBLIC_DEFAULT_ENGINE_URL` dynamically from the host `globalThis` environment. Static plugins correctly instantiate as static instead of evaluating to a bundle.

**Screenshots/Logs**
`[MarketplaceSync] Failed to load "military-bases": ... Failed to load valid WorldPlugin from bundle`

**Environment:**
 - OS: Server/Coolify
 - Browser: Any
 - WorldWideView Edition: demo
