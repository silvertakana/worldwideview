---
name: debugging-coolify
description: Use when you need to troubleshoot deployed applications, services, databases, or deployment failures on a Coolify server using MCP tools, SSH into the instances, and mapping resource UUIDs to Docker host states.
---

# Debugging Coolify

## Overview
This workflow provides the exact methodology to cross-reference Coolify MCP data with raw Docker state on the host to effectively debug infrastructure and application issues. It outlines the host mapping ontology for the local Coolify server (e.g., accessible via `ssh root@192.168.68.69`) and how to bridge Coolify UUIDs to physical folders and volumes.

## When to Use
- Applications failing to deploy or start on Coolify
- Checking database or service logs
- Verifying environment variables on running containers
- Investigating 502 Bad Gateway errors from Coolify proxy
- Finding where files and configuration are stored on the Docker host
- "I need to check the database volume for..."
- "SSH into the server and find the configuration for..."
- "I can't find the source code on Coolify..."
- "Check the local laptop server logs"

## Core Pattern: Correlate UUID to Raw State

Coolify abstracts Docker. When things break, you must correlate Coolify's UUIDs to the underlying Docker containers and volumes.

1. **Find the UUID** using Coolify MCP (`mcp_coolify_list_applications`, `mcp_coolify_list_services`, `mcp_coolify_list_databases`).
2. **Diagnose via MCP** using `mcp_coolify_diagnose_app` or `mcp_coolify_application_logs(uuid, lines=200)`.
3. **Map to Host Config** using the SSH host mapping pipeline. Container names and network configs are prefixed with the UUID.
4. **Drop to Raw Docker** when MCP logs aren't enough (e.g., `docker inspect`, `docker exec`, proxy logs) over SSH.

## Host Mapping Reference

Here is the exact topology of the local Coolify server hosted on the laptop:

| Resource | Physical Path on Host (`192.168.68.69`) |
|----------|-----------------------------------------|
| **Base Coolify Data** | `/data/coolify` |
| **Application Configs** | `/data/coolify/applications/<uuid>/` |
| **Service Configs** | `/data/coolify/services/<uuid>/` |
| **Proxy Details** | `/data/coolify/proxy/` |
| **Docker Volumes** | `/var/lib/docker/volumes/<uuid>_<volume_name>/_data` |

## Discovery Pipeline

When requested to debug something on the Coolify server, follow this pipeline to accurately target the data without guessing:

1. **Get the UUID**: Use the `mcp_coolify_list_applications` or `mcp_coolify_list_services` tools to find the UUID of the target resource.
   - Example Application (`worldwideview-demo`): `nmn55t4io3myfubs72worn7k`
   - Example Service (`umami`): `s6iqy8m4mlf3x6e5u4agxsp0`
2. **Access the Docker Compose File**: The raw compose configurations Coolify dynamically generates live at `/data/coolify/(applications|services)/<uuid>/docker-compose.yml`.
   - Command: `ssh root@192.168.68.69 "cat /data/coolify/applications/<uuid>/docker-compose.yml"`
3. **Inspect Volumes**: Coolify uses standard Docker local volumes mapping, prefixing the volume names with the UUID. Retrieve them directly through Docker or by accessing the mapped directory.
   - Command: `ssh root@192.168.68.69 "docker volume ls | grep <uuid>"`
   - Example Volume Mount: `/var/lib/docker/volumes/nmn55t4io3myfubs72worn7k_engine-data/_data`

## Quick Reference For Issues

| Issue | First Action | Deep Dive |
|-------|--------------|-----------|
| App won't start | `mcp_coolify_application_logs(uuid)` | SSH into host, check `/data/coolify/applications/<uuid>/docker-compose.yml` |
| Database connection error | `mcp_coolify_get_database(uuid)` | Query `docker ps \| grep <uuid>` then `docker logs <container>` |
| Proxy routing 502 | `mcp_coolify_diagnose_app(uuid)` | SSH into host, check Traefik proxy logs: `ssh root@192.168.68.69 "docker logs coolify-proxy"` |
| Missing/corrupt data | Recall Host Mapping | SSH and inspect volumes: `/var/lib/docker/volumes/<uuid>_<name>/_data` |
| Deployment failed | `mcp_coolify_list_deployments` | Find deployment UUID, use `mcp_coolify_deployment(action: get, uuid: <uuid>, lines: 200)` to get raw build logs |

## Common Mistakes & Red Flags

### Trying to find files in `/var/www` or `/home`
- **What goes wrong:** Coolify does not use traditional host-bound document roots. Everything is containerized.
- **Fix:** Access `/data/coolify` or directly jump into the container via `docker exec`.

### SSHing with a password
- **What goes wrong:** The connection might hang or prompt interactively.
- **Fix:** Your host agent is already keyed for `root@192.168.68.69`. Ensure you use non-interactive commands: `ssh root@192.168.68.69 "your command here"`.

### Guessing Container Names
- **What goes wrong:** Coolify generates container names dynamically based on internal routing (e.g., `wwv-data-engine-nmn55t4io3myfubs72worn7k-114309953928`).
- **Fix:** Always query `docker ps --format '{{.Names}}'` and `grep` the UUID obtained from the Coolify MCP to accurately identify the target container.

### Editing Files on Host Direct
- **What goes wrong:** Coolify will overwrite generated files.
- **Fix:** Update via MCP settings/environment variables or repo commits to trigger redeploy. Never modify raw `docker-compose.yml` under `/data/coolify/`.

### Re-running Deployment Repeatedly
- **What goes wrong:** The deployment failed, but standard logs are empty, and restarting repeats the error. standard runtime logs are distinct.
- **Fix:** Use deployment MCP tools to check the build log.

**Red Flags - STOP and Start Over:**
- Guessing container paths or volume names.
- Using standard `systemctl` commands to check application status instead of docker.
- Modifying docker-compose rather than relying on standard git updates.

**All of these mean: Stop. Get the UUID via Coolify MCP. Inspect via Docker using that UUID, or use deployment-specific logs.**
