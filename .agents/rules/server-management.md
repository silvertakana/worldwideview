---
trigger: model_decision
description: Server development and debugging rules for the production/homelab server using SSH and Coolify MCP.
---

# Server Management & Debugging

## 1. Coolify MCP (High-Level)
Use the `coolify` MCP server for managed actions:
- **Discovery**: `mcp_coolify_projects`, `mcp_coolify_environments`
- **Inspection**: `mcp_coolify_application_logs`, `mcp_coolify_get_application`
- **Actions**: `mcp_coolify_control` (restart, stop)

## 2. Direct SSH (Low-Level)
For filesystem or network issues, use direct SSH to the production server:
`ssh root@192.168.68.69 "<command>"`

**Common Commands**:
- `docker ps`
- `docker logs --tail 100 <container_id>`
- `df -h`
- `top -b -n 1` (Never run interactive `top` or `nano` via agent commands).

## 3. Safety Precautions
Always use non-interactive flags for SSH. Communicate clearly before executing high-risk actions like volume deletion or critical infrastructure restarts.
