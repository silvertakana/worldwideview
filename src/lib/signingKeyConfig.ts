/**
 * Pure, side-effect-free predicate for the HMAC signing-key configuration rule.
 *
 * Single source of truth for the cloud/demo guard that also lives in
 * apiKeyAuth.getSigningKey() and was previously duplicated in healthProbes.
 * No crypto operations, no I/O, no imports beyond the edition constant.
 */

import { edition } from "@/core/edition";

/**
 * Returns true when the HMAC signing-key preconditions are satisfied for the
 * current edition.
 *
 * Local edition: always true. BETTER_AUTH_SECRET fallback is intentional and the
 * dedicated key is optional.
 *
 * Cloud/demo edition: API_KEY_HMAC_SECRET must be present and must differ from
 * BETTER_AUTH_SECRET. Either absence is an operator misconfiguration.
 */
export function isSigningKeyValid(): boolean {
    if (edition === "local") return true;

    const dedicated = process.env.API_KEY_HMAC_SECRET;
    const fallback = process.env.BETTER_AUTH_SECRET;

    return !!dedicated && dedicated !== fallback;
}
