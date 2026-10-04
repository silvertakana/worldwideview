# ADR-0011: Two-Tier Onboarding and Risk-Ranked Data Access

## Status
Accepted

## Date
2026-09-26

## Related
- **Amends:** ADR-0005 (Demo Service Account) - the demo identity is marked on its API key, not on a user tier column, which no longer exists
- **Clarifies:** ADR-0001 (Decentralized Plugin Auth) - first-message auth, clock tolerance, per-connection limits, claim-based subscription scoping
- **Builds on:** ADR-0007 (Globe Local Auth with Cloud Provisioning) - local and cloud editions already differ in what they require
- **Relates to:** ADR-0009 (Engine-Direct Plugin Data Routing) - the engine, not the globe, is the surface being protected

---

## Context

Every data-layer plugin in the ecosystem reaches live data through the data engine's WebSocket stream. Until now the hosted engine accepted every connection: production ran with authentication disabled by an explicit environment flag, a documented and accepted temporary risk.

The obvious replacement - require a marketplace account for all data access - was rejected because it breaks the users this project exists for. A person running the stack on their own hardware, or on a machine with no route to the internet, has no account and wants none. Making a central service the gate for all data would also turn one outage into a total outage, and would contradict the project's own position that plugin code and data handling stay as close to the user as possible.

The ecosystem already distinguishes editions (`local`, `cloud`, `demo`) and already mints short-lived Ed25519 tickets from the marketplace. What was missing was a stated rule for **who pays for the compute, and therefore who is asked to identify themselves**.

The everyday analogy: this is a gym. Buying your own equipment and training at home involves no membership desk and no record of when you work out. Using the staffed gym across town means showing a card at the door, because someone else maintains those machines. A free trial day-pass gets you onto the general floor without signing anything, but it is stamped with today's date and does not open the premium studios.

---

## Decision

Data access is tiered by **who pays for the compute**, never by who the user is.

**Sovereign (self-hosted, offline).** A local deployment runs with engine authentication disabled by configuration and no key service configured. It never contacts the marketplace. No account exists anywhere in this path, and no feature may introduce one.

**Cloud-connected (hosted).** Our hosted engine requires a valid short-lived ticket on every connection. The globe obtains that ticket server-side from the marketplace using a credential it already holds - an operator-provided key for a managed deployment, or the tenant's own linked credential. The browser receives only the short-lived ticket, never a long-lived key. A missing credential is a visible, explained state, never a silent empty globe.

**Demo (public).** The public demo serves anonymous visitors. Its server holds a service-account credential and mints a fresh short-lived ticket per visitor session. Demo connections are bounded by three independent controls: an origin allowlist, a per-connection rate limit, and a scope that limits which channels may be subscribed. A demo ticket is public by design: it is a speed bump, not a secret.

**Identity attaches to the credential, not the person.** Where a deployment must be distinguishable - the demo, for instance - the marker lives on the API key that presents itself, not on a user record. This keeps the ticket contract stable as account features change.

---

## Consequences

- The protocol is never account-gated; only our infrastructure is. A marketplace outage degrades the cloud and demo tiers and leaves the sovereign tier untouched.
- The demo tier accepts a bounded, documented risk: a determined visitor can extract a demo ticket and reuse it for its lifetime, from an allowed origin. That is the same access any visitor has, bounded by the rate limit and the channel scope, and revocable by rotating the demo service-account key.
- Enforcement is a configuration change on the engine, and so is its reversal. A single environment variable returns the engine to its previous behaviour, which makes the change safe to stage.
- Ordering becomes load-bearing: clients must be able to present a ticket before the engine demands one. Shipping enforcement first would black out every live client.
- Per-channel scope becomes the mechanism for any future premium tier, which means the engine must read the scope claim it currently discards.

---

## Alternatives considered

**A single central account gate for all data.** Rejected: excludes offline and self-hosted users, makes a central outage total, and contradicts the project's local-first position.

**Self-signed demo tickets from the demo server, as a second trust root.** Rejected for now: it adds a second issuer for a credential that is public by design, duplicating expiry, rotation, and revocation logic the marketplace already provides, while adding no protection that origin binding, rate limiting, and channel scope do not already give.

**Marking the demo identity on the user record, as ADR-0005 originally specified.** No longer possible: the tier column it relied on was removed from the marketplace database in June 2026. Superseded by attaching the marker to the API key.
