# Phase 5: Cloud Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the Docker Compose configuration and routing layer necessary to run the multi-tenant cloud application.

**Architecture:** Use Traefik or nginx to route wildcard subdomains to the Next.js container. Provide environment variable overrides.

**Tech Stack:** Docker Compose, Traefik.

---

### Task 1: Docker Compose Setup

**Files:**
- Create: `deploy/cloud/docker-compose.yml`
- Create: `deploy/cloud/.env.example`

- [ ] **Step 1: Create compose file**

```yaml
# deploy/cloud/docker-compose.yml
services:
  wwv-cloud:
    image: ghcr.io/silvertakana/worldwideview:latest
    restart: always
    environment:
      NEXT_PUBLIC_WWV_EDITION: cloud
      DATABASE_URL: ${SUPABASE_PG_URL}
      NEXT_PUBLIC_SUPABASE_URL: ${SUPABASE_URL}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
      SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.wwv.rule=HostRegexp(`{user:[a-z0-9-]+}.app.worldwideview.dev`) || Host(`app.worldwideview.dev`)"
      - "traefik.http.routers.wwv.entrypoints=websecure"
      - "traefik.http.routers.wwv.tls.certresolver=letsencrypt"

  traefik:
    image: traefik:v3.0
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.tlschallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
      - "letsencrypt:/letsencrypt"

volumes:
  letsencrypt:
```

- [ ] **Step 2: Create example env file**

```env
# deploy/cloud/.env.example
SUPABASE_PG_URL=postgresql://postgres:password@db.supabase.co:5432/postgres
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ACME_EMAIL=admin@example.com
```

- [ ] **Step 3: Commit**

```bash
git add deploy/
git commit -m "chore: add cloud deployment compose configuration"
```
