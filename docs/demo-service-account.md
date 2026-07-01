# Demo Service Account Setup

This guide covers setting up the demo instance with a marketplace service account so anonymous visitors can authenticate through the real auth chain.

## Overview

The demo deployment (`demo.worldmonitor.app`) uses a dedicated marketplace user account with an API key. When a visitor loads the globe, the server reads the API key from `MARKETPLACE_API_KEY` env var, exchanges it for a short-lived JWT, and uses that JWT to authenticate WebSocket connections to the data engine.

No visitor login, no PKCE OAuth flow, no auth bypass flags.

## Prerequisites

- Access to the marketplace Supabase dashboard (for creating the demo user)
- Access to the Coolify deployment for the demo globe app

## Setup Steps

### Step 1: Create the Demo User

The demo identity is a regular marketplace `User` row with `tier` set to `"demo"`:

1. Open the marketplace Supabase dashboard
2. Navigate to the `marketplace_users` table
3. Insert a new row:
   - `email`: `demo@worldwideview.dev`
   - `tier`: `demo`
   - `supabaseUserId`: create a matching Supabase auth account first, then link it here
4. Alternatively: sign up normally via the marketplace, then change the user's `tier` to `demo` in the database

### Step 2: Generate an API Key

1. Sign in to the marketplace as the demo user
2. Navigate to Account Settings > API Keys
3. Click "Generate new key"
4. Copy the raw `mk_` key (shown once)

### Step 3: Set the Env Var on Coolify

1. Open the Coolify dashboard for the demo globe app deployment
2. Navigate to Environment Variables
3. Add: `MARKETPLACE_API_KEY` = the raw key you copied
4. Save and redeploy

### Step 4: Verify

1. Visit `demo.worldmonitor.app` in an incognito/private browser window
2. The globe should load with data streaming — no login prompt
3. Check server logs for: `[ticketClient] Using MARKETPLACE_API_KEY credential (edition: demo)`

## Key Rotation

1. Sign into marketplace as the demo user
2. Account Settings > API Keys > Revoke the old key
3. Generate a new key
4. Update `MARKETPLACE_API_KEY` on Coolify
5. Redeploy the globe app

The old JWT will continue working for up to 4.5 minutes (cached in-memory) after rotation.

## Self-Hosted Usage

Power users running their own instance can set `MARKETPLACE_API_KEY` in `.env.local` to skip the PKCE OAuth connect flow entirely. The server reads it at first ticket request — no restart needed if using `pnpm dev` with hot module reload for server files.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Globe loads but no data | `MARKETPLACE_API_KEY` not set or invalid | Check env var on Coolify, verify key isn't revoked |
| Server crashes at startup on demo | `MARKETPLACE_API_KEY` is unset | Set the env var and redeploy |
| "Token exchange rejected (401)" in logs | API key was revoked | Generate a new key, update env var, redeploy |
| **No** `[ticketClient]` log at startup | Using PKCE/DB path (no env var) | Normal if env var is intentionally unset |
