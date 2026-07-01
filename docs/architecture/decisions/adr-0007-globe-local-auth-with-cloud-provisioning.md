# ADR-0007: Globe Local Authentication with Cloud Provisioning

## Status
Accepted *(2026-06-23)*

## Date
2026-06-23 *(revised — this document supersedes the previous ADR-0007 draft from the same date, which documented an incorrect Hub-dependent architecture)*

## Related
- **Supersedes:** The original ADR-0007 draft (`adr-0007-edition-conditional-cloud-auth.md`) — that document described a Hub-dependent model where `cloudAuthorize()` delegated to `supabase.auth.signInWithPassword()` on every cloud login. This ADR replaces it entirely. The old file should be deleted.
- **Builds on:** ADR-0003 (Shared Identity & Ecosystem Auth Host) — the Hub's Supabase Auth serves as the ecosystem identity provider for signup, billing, and OAuth, but the Globe does not depend on it for day-to-day authentication.
- **Builds on:** ADR-0004 (httpOnly Session Cookies) — the Globe's single NextAuth session cookie remains the only session artifact in the browser.
- **Builds on:** ADR-0008 (Cross-Service Linking & HMAC) — the HMAC-authenticated provisioning API and the auto-link JWT mechanism (HS256, `POST /api/connect/direct`) are used during instance creation to inject the Marketplace API key.
- **Complements:** ADR-0005 (Demo Service Account) — the demo edition authenticates locally like all other editions, with a synthetic admin account.

---

## Context

The WorldWideView globe app (`worldwideview/`) must serve two fundamentally different deployment populations:

| Population | How they get the Globe | Identity relationship to Hub |
|---|---|---|
| **Cloud users** | Provisioned by the Hub (`worldwideview-web`) | Have a Hub account (Supabase Auth), but the Globe should not depend on it after setup |
| **Local users** | Self-install (Docker, etc.) | No Hub account — the Globe is fully standalone |

A previous draft of this ADR documented a Hub-dependent model: cloud edition logins delegated to `supabase.auth.signInWithPassword()` server-side, creating a permanent runtime dependency from the Globe to the Hub's Supabase project. That design was **wrong**. It violated the core architectural principle:

> **The Globe must function standalone.** A user who bookmarks their Globe URL must be able to log in directly without the Hub being reachable.

This is not negotiable:
- Local/self-hosted users run without Supabase (open-source deployment contract)
- Cloud users should have the same independence once provisioned — the Hub creates the instance, but after that the Globe stands alone

### Everyday-life analogy

A building manager pre-cuts a key and leaves it at the front desk for the new tenant. The tenant arrives, picks up their key, and from then on uses it directly — they never need the manager again to enter their own apartment. The Hub is the building manager; the Globe is the apartment. The manager creates the apartment, hands over the key, and steps back.

---

## Decisions

### ADR-007A: Globe Authenticates Locally for ALL Editions

NextAuth v5 (Credentials provider, JWT strategy) validates credentials against the **Globe's own Prisma `User` table** for every edition — local, cloud, and demo. There is no edition branching in the auth provider selection, no delegation to an external identity provider at login time, and no runtime dependency on the Hub's Supabase project.

This means:

- **Local edition:** Users sign up directly on the Globe. Their email + bcrypt-hashed password are stored in the Globe's `User` table. NextAuth validates against this table. No external dependency exists.
- **Cloud edition:** Users were provisioned at instance creation time (see ADR-007B). Their email + bcrypt-hashed password are stored in the Globe's `User` table — the same table, the same schema, the same validation logic. NextAuth validates against this table. No Supabase call on login.
- **Demo edition:** A synthetic admin account pre-seeded in the `User` table at startup. NextAuth validates against this table. Same path.

The auth provider configuration reduces to a single path:

```typescript
// Conceptually — no edition branch
providers: [localCredentialsProvider],
```

The `localCredentialsProvider` validates email + password against the Globe's own `User` table via bcrypt comparison. This is the only provider. There is no `cloudCredentialsProvider`, no `supabase.auth.signInWithPassword()` call, no `isCloud` gate.

### ADR-007B: Cloud Provisioning Flow — Hub Creates the Globe User at Instance Creation

Cloud users don't self-register on an empty Globe. The Hub creates their Globe identity during **instance provisioning**, before the user ever visits the Globe:

```
Hub (worldwideview-web)                  Globe (worldwideview)
     │                                        │
     │ 1. User creates instance via Hub UI    │
     │                                        │
     │ 2. POST /api/instance                  │
     │    (HMAC-SHA256, per ADR-0008)         │
     │────────────────────────────────────────►
     │                                        │── Create Globe User row with:
     │                                        │     • one-time setup token (UUID)
     │                                        │     • linked Hub UUID (NOT email)
     │                                        │     • status: "pending_setup"
     │                                        │
     │ 3. POST /api/connect/direct            │
     │    (HS256 JWT, auto-link, ADR-0008)    │
     │────────────────────────────────────────►
     │                                        │── Obtain Marketplace API key
     │                                        │── Store encrypted in marketplaceCredential
     │                                        │
     │◄── instance + user created ────────────│
     │                                        │
     │ 4. Redirect user to:                   │
     │    globe.example.com/setup?token=XXX   │
```

Key properties of this flow:

- **Provisioning closes the registration race condition.** In the previous model, the Globe sat empty between instance creation and user registration — an attacker who learned the Globe URL could register first. Provisioning eliminates that window: the Globe account exists before the user arrives, protected by the one-time setup token.
- **The setup token is linked to a Hub UUID, not an email.** This handles every edge case: OAuth providers that don't return email (GitHub private email), phone-based signup, and any future identity source. The Globe identity is linked to the Hub identity via the provisioning record, not via email matching.
- **The Marketplace API key is injected at provisioning time** via the existing auto-link JWT mechanism (ADR-0008). Cloud users never see the PKCE OAuth flow — their marketplace credential is ready before they log in for the first time.
- **All Hub-to-Globe calls during provisioning use HMAC-SHA256** (ADR-0008B). The provisioning API is not publicly accessible.

### ADR-007C: Dedicated Setup Page — Independent Globe Identity

When the user arrives at `globe.example.com/setup?token=XXX`, they see a dedicated setup page:

1. **"Set up your admin account"** — a clean form with email and password fields
2. **No email prefill.** The Globe identity is fully independent from the Hub identity. The user chooses their Globe email from scratch.
3. The user sets their email + password
4. The Globe validates the setup token (one-time use, time-limited), creates the account, marks the token as used, auto-logs-in via NextAuth, and redirects to the dashboard
5. From this point: the Globe authenticates locally. No Hub calls on login. The Marketplace API key is already stored.

The Globe account is linked to the Hub account via the provisioning record: `Hub UUID → setup token → Globe account`. This is a database relationship, not an email-based join. It survives email changes, OAuth edge cases, and any future identity model changes.

### ADR-007D: Local User Flow — Self-Registration, PKCE for Marketplace

Local users install the Globe standalone (Docker, self-hosted). They have no Hub account:

1. User signs up directly on the Globe — email + password stored in the Globe's `User` table
2. NextAuth validates against the local `User` table on every login
3. When the user wants Marketplace plugins, they go through the PKCE OAuth flow (ADR-0008, Path 2) to link their Globe instance to their Marketplace account and obtain an API key
4. The Marketplace API key is stored encrypted in the `marketplaceCredential` table

This flow has no Hub involvement. It is the standard self-hosted experience.

### ADR-007E: UX Guard Rails

Two UX rules follow from this architecture:

1. **Authenticated users visiting `/login` or `/signup` are redirected to the dashboard.** This is standard best practice and prevents confusion when a user with an active session lands on the login page.
2. **The setup page (`/setup`) is a dedicated route, separate from `/login` and `/signup`.** It is keyed on the setup token in the URL query parameter. Without a valid token, the page redirects to `/login`. This prevents the setup flow from being confused with the regular login flow.

---

## Implementation Gap

> **The current code does not yet match this ADR.** The `cloudAuthorize()` function at `src/lib/auth.ts:138-176` calls `supabase.auth.signInWithPassword()` for cloud edition logins, creating the Hub dependency that this ADR explicitly rejects. The `cloudCredentialsProvider` (lines 183-191) is wired into the NextAuth providers array when `isCloud` is true.
>
> This is a known divergence. The intended fix is:
> 1. Remove `cloudAuthorize()` and `cloudCredentialsProvider`
> 2. Make the `localCredentialsProvider` validate against the Globe's `User` table for all editions
> 3. Implement the provisioning API endpoint (HMAC-protected) that creates user records with setup tokens
> 4. Implement the `/setup` page that consumes setup tokens
> 5. Remove the `isCloud` gate from the provider selection in `auth.ts`
>
> Until this is resolved, the cloud edition remains Hub-dependent at login time, contrary to this ADR's decision.

---

## Consequences

**Positive:**
- The Globe is fully standalone. A bookmarked Globe URL works without the Hub being reachable — the only session is the Globe's own NextAuth JWT.
- Local/self-hosted users have zero Supabase dependency. The open-source deployment contract is fulfilled by design, not by edition branching.
- Cloud users get the same independence after a one-time provisioning step. The Hub creates the apartment; the tenant gets the key and never needs the manager again.
- A single auth code path serves all editions. No `isCloud ? cloudProvider : localProvider` branch. Less surface area for bugs.
- The registration race condition is eliminated — the Globe account exists before the user arrives.
- No email-matching identity linking. Globe identity and Hub identity are linked by provisioning record (UUID), not by a fragile email string comparison.

**Negative / accepted tradeoffs:**
- The provisioning API must be available during instance creation. If the Globe is unreachable, instance creation fails. This is acceptable — a Globe that can't be reached can't be provisioned.
- Setup tokens must be single-use and time-limited. A leaked setup token could be used by an attacker before the legitimate user arrives. Mitigation: short token expiry (e.g., 1 hour) and the user is notified immediately if the token is already used.
- The Hub must maintain a provisioning record (Hub UUID → setup token → Globe account) for auditing and support. This is a small additional table.
- **Implementation gap:** The current `cloudAuthorize()` function still delegates to Supabase. Until the code is updated, cloud logins retain the Hub dependency this ADR rejects. See Implementation Gap section above.
- Password resets for cloud users must be handled by the Globe (since the Globe owns the credential), not by the Hub's Supabase Auth. This means the Globe must implement its own password reset flow — a follow-up task.

---

## Rejected Alternatives

This section is the load-bearing part of this ADR. Every alternative listed here was considered and rejected. Future agents: if you are about to propose one of these, **stop — it was already considered and rejected.**

### "Delegate cloud logins to Supabase Auth (the previous ADR-0007 draft)"
**Rejected.** This was the model documented in the original ADR-0007 draft: `cloudAuthorize()` calls `supabase.auth.signInWithPassword()` on every cloud login, with `isCloud ? cloudCredentialsProvider : localCredentialsProvider` branching. It was rejected because:
- The Globe cannot function standalone — a Supabase outage means cloud users cannot log in
- It creates a two-class auth system: local users get independence, cloud users get a permanent dependency
- The edition branch in the provider array is a code smell — the same `Credentials` form should validate the same way regardless of edition
- It contradicts the core architectural principle that the Globe must be independently bookmarkable and functional

This ADR replaces that model entirely. The old `adr-0007-edition-conditional-cloud-auth.md` file should be deleted.

### "Pre-fill the setup email from the Hub"
**Rejected.** Passing the Hub-registered email to the Globe and only asking the user to set a password seems simpler — one less field to fill. But:
- OAuth providers like GitHub may not expose the user's email (GitHub's "Keep my email private" setting returns a `users.noreply.github.com` address)
- Phone-based signup has no email to pass
- The Globe identity should be fully independent from the Hub identity — email prefill ties them together in a way that breaks if the user changes their Hub email or uses a provider without email
- A blank slate setup page is conceptually cleaner: "This is your Globe. Set up your identity for it."

### "No provisioning — let users self-register on an empty Globe"
**Rejected.** In this model, the Hub creates an empty Globe instance with no user, and the first person to visit the URL registers as admin. This creates a race condition: if an attacker learns the Globe URL before the legitimate user, the attacker registers first and gains admin access. Provisioning eliminates this window entirely. It also means cloud users would need to separately link their Globe to the Hub for billing — provisioning bundles this step.

### "Shared user table — Globe reads/writes Supabase auth.users directly"
**Rejected.** This would mean the Globe's `User` table is Supabase's `auth.users`. Local/self-hosted users have no Supabase instance, so this model breaks the local edition entirely. Even for cloud, it creates a data residency concern (user credentials live in Supabase, not the Globe's own database) and makes the Globe dependent on the Supabase GoTrue Admin API for user management operations.

### "Hub proxies all Globe login requests"
**Rejected.** In this model, the user always logs in at the Hub, and the Hub forwards authenticated requests to the Globe. This makes the Hub a single point of failure for Globe authentication — if the Hub is down, cloud users cannot access their Globe. It also means the Globe login page is a redirect to the Hub, which breaks the bookmarkable-URL principle.

### "Unify on a single auth provider across the ecosystem (NextAuth OR Supabase)"
**Rejected** for the same reasons documented in the original ADR-0007 (which was correct about this specific point). The Globe's local edition must operate without Supabase — removing NextAuth breaks self-hosted users. The Hub's ecosystem needs Supabase Auth for shared sessions across subdomains — removing Supabase breaks cross-product login. Both frameworks serve different purposes in different contexts, and removing either creates more problems than it solves.

### "Let cloud users create a Globe account with the same email as their Hub account, match by email"
**Rejected.** Email matching is fragile: users change emails, OAuth providers don't always return email, and email matching creates an implicit trust relationship ("if your email matches, you get admin access") that is vulnerable to email takeover attacks. The provisioning model's explicit token-based link (Hub UUID → setup token → Globe account) is cryptographically sound and immune to email changes.
