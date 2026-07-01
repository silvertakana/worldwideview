# E2E Smoke Test Checklist

**Phase:** 38 — E2E Smoke Test
**Date:** \_\_\_\_\_\_\_\_\_\_\_
**Tester:** \_\_\_\_\_\_\_\_\_\_\_
**Edition:** local / cloud / demo

## Prerequisites

- [ ] All 3 apps running: worldwideview-web (:3001), marketplace (:3002), globe app
- [ ] HTTPS configured on .wwv.local (or equivalent multi-origin setup)
- [ ] Test user credentials available
- [ ] `NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS` set with at least one plugin ID
- [ ] Marketplace OAuth app registered with the correct redirect URI

---

## Test Flow

### 1. New user can sign up

| Step | Action | Expected Result | Pass/Fail |
|------|--------|----------------|-----------|
| 1.1  | Navigate to worldwideview-web signup page | Signup form renders | |
| 1.2  | Fill in email, password, confirm password, submit | Account created; redirect to account or home page | |

### 2. Sign up user sees "Connect to Marketplace"

| Step | Action | Expected Result | Pass/Fail |
|------|--------|----------------|-----------|
| 2.1  | Navigate to globe app URL | Globe loads with app-ready state | |
| 2.2  | Look for "Connect to Marketplace" button | Button is visible (e.g. in Plugins tab or settings) | |

### 3. Click connect triggers PKCE redirect

| Step | Action | Expected Result | Pass/Fail |
|------|--------|----------------|-----------|
| 3.1  | Click "Connect to Marketplace" | Browser redirects to marketplace /oauth/authorize | |
| 3.2  | Inspect the authorize URL | Contains `response_type=code`, `code_challenge`, `state` params | |

### 4. Consent page shows correct information

| Step | Action | Expected Result | Pass/Fail |
|------|--------|----------------|-----------|
| 4.1  | Observe consent page | User email is displayed correctly | |
| 4.2  | Verify scope description | Scope (e.g. "email") is listed on the consent page | |

### 5. Approve completes the PKCE flow

| Step | Action | Expected Result | Pass/Fail |
|------|--------|----------------|-----------|
| 5.1  | Click "Approve" (or "Authorize") | Browser redirects back to globe app | |
| 5.2  | Wait for redirect to complete | Globe app URL loads with callback params handled | |

### 6. "Connected as" confirmation

| Step | Action | Expected Result | Pass/Fail |
|------|--------|----------------|-----------|
| 6.1  | After redirect-back, observe the UI | "Connected as <user@example.com>" message is visible | |

### 7. Database: marketplaceCredential exists

| Step | Action | Expected Result | Pass/Fail |
|------|--------|----------------|-----------|
| 7.1  | Connect to PostgreSQL and query `MarketplaceCredential` | Row exists for the connected user/tenant | |
| 7.2  | Verify encrypted data fields | `version`, `salt`, `nonce`, `ciphertext` are populated | |

### 8. Add a plugin that requires TICKET_AUTH

| Step | Action | Expected Result | Pass/Fail |
|------|--------|----------------|-----------|
| 8.1  | Open Plugins panel in globe app | Plugin list loads | |
| 8.2  | Add/enable a plugin that is in `NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS` | Plugin is installed and activated | |

### 9. WebSocket sends auth message on connect

| Step | Action | Expected Result | Pass/Fail |
|------|--------|----------------|-----------|
| 9.1  | Open browser DevTools -> Network -> WS | WebSocket connection to engine appears | |
| 9.2  | Inspect the first message sent by WsClient | First message is `{"type":"auth","v":1,"token":"..."}` (not a subscribe) | |
| 9.3  | Verify the token is a JWT | Decode the token; it should have `sub`, `aud`, `iat`, `exp` claims | |

### 10. Engine verifies JWT

| Step | Action | Expected Result | Pass/Fail |
|------|--------|----------------|-----------|
| 10.1 | Check the engine (wwv-data-engine) logs | Engine logs "JWT verification passed" or similar auth success message | |
| 10.2 | Verify the engine's JWKS endpoint was called | Engine fetched JWKS from the globe app to verify the JWT signature | |

### 11. Data streams normally after auth

| Step | Action | Expected Result | Pass/Fail |
|------|--------|----------------|-----------|
| 11.1 | Observe globe after auth is complete | Entities from the authenticated plugin appear on the globe | |
| 11.2 | Check browser DevTools -> Network -> WS for data messages | Data messages flow with `{"type":"data","pluginId":"...","payload":[...]}` | |

### 12. Unconnected user still gets data via unauthenticated path

| Step | Action | Expected Result | Pass/Fail |
|------|--------|----------------|-----------|
| 12.1 | Clear the `MarketplaceCredential` row in the database | Row deleted | |
| 12.2 | Reload the globe app | App does not crash; plugins that support unauthenticated mode still show data | |
| 12.3 | Check browser console for errors | No WebSocket auth errors; unauthenticated path handles gracefully | |

### 13. `/api/auth/ticket` returns `noCredential` for unconnected user

| Step | Action | Expected Result | Pass/Fail |
|------|--------|----------------|-----------|
| 13.1 | With credential cleared, call `/api/auth/ticket?pluginId=test` | Returns `{"noCredential":true}` with HTTP 200 | |
| 13.2 | With credential present, call `/api/auth/ticket?pluginId=test` | Returns `{"token":"..."}` with HTTP 200 | |

### 14. All unit tests still pass

| Step | Action | Expected Result | Pass/Fail |
|------|--------|----------------|-----------|
| 14.1 | Run `pnpm test` in worldwideview | All tests pass (1035+ tests) | |
| 14.2 | Run `pnpm test` in worldwideview-marketplace | All tests pass | |
| 14.3 | Run `pnpm test` in wwv-data-engine | All tests pass | |

---

## Summary

| Section | Pass | Fail | N/A |
|---------|------|------|-----|
| 1. Signup | | | |
| 2. Connect button | | | |
| 3. PKCE redirect | | | |
| 4. Consent page | | | |
| 5. Approve flow | | | |
| 6. Connected confirmation | | | |
| 7. Database check | | | |
| 8. Plugin install | | | |
| 9. WebSocket auth | | | |
| 10. Engine JWT verify | | | |
| 11. Data streaming | | | |
| 12. Unconnected fallback | | | |
| 13. noCredential API | | | |
| 14. Unit tests | | | |

**Overall verdict:** PASS / FAIL (with notes)

**Issues found:**

1. \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
2. \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
3. \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Notes:**

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
