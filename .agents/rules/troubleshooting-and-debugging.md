---
trigger: model_decision
description: Troubleshooting and debugging guidelines for WorldWideView, covering latency, logging, and namespace collisions.
---

# Troubleshooting and Debugging

## 1. Plugin Data Latency
If there is a noticeable delay (e.g., ~1 second) between enabling a plugin and the initial data arriving on the globe, **do not assume the UI is blocking**.
- **WebSocket Handshake**: Initial latency is often caused by the time it takes to establish a new WebSocket connection to the engine's `/stream`.
- **Upstream Cooldowns**: Plugins querying external providers (like OpenSky for `aviation`) have strict rate limits. If a snapshot returns a `404`, it might mean the seeder is in a cooldown period or hasn't successfully fetched data yet. This is expected behavior.
- **Diagnosis**: Instrument the `DataBusSubscriber` and `WsClient` with timing logs (`performance.now()`) to track exactly where the bottleneck occurs (manifest discovery vs connection establishment vs first payload).

## 2. Log Verbosity and Structured Logging
We employ a **structured logging strategy** in the frontend to reduce noise and improve readability.
- **Rule**: Do not add excessive `console.log` statements that dump raw JSON payloads or stream contents directly to the console in core files like `WsClient.ts` or `PluginManager.ts`.
- **Implementation**: If detailed logs are needed, use conditional debug levels or summarize the output (e.g., logging payload sizes or entity counts instead of the full object array). This ensures critical diagnostic information remains visible without overflowing the terminal.

## 3. Namespace Collisions
If a plugin fails to load in the Data Engine with a `404` or `Error [ERR_MODULE_NOT_FOUND]` error during startup:
- **Root Cause**: The seeder may exist simultaneously in both the `wwv-seeders-community` and `wwv-seeders-private` repositories. 
- **Resolution**: Seeders must have a unique namespace. Ensure that private plugins (e.g., `aviation`, `maritime`, `military-aviation`) are explicitly removed from the community repository to prevent workspace-level module resolution failures when the V2 engine attempts to load them. Private seeders take priority, but overlapping names will cause dependency conflicts.
