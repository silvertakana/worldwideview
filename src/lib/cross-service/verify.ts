import crypto from "node:crypto";
import { CrossServiceSignature } from "./types";
import { nonceCache } from "./nonceCache";

export type { CrossServiceSignature } from "./types";

/**
 * Verify a hub-to-globe request's HMAC signature.
 *
 * Async because replay protection is recorded in the shared database, so a
 * nonce cannot be replayed against a sibling instance or across a restart.
 */
export async function verifyCrossServiceSignature(
    request: Request,
    rawBody: string,
): Promise<CrossServiceSignature> {
    const secret = process.env.CROSS_SERVICE_SECRET;
    if (!secret) {
        return { valid: false, reason: "server_configuration_error" };
    }

    const sigHeader = request.headers.get("X-Service-Signature");
    if (!sigHeader) {
        return { valid: false, reason: "missing_header" };
    }

    const tMatch = sigHeader.match(/t=(\d+)/);
    const nMatch = sigHeader.match(/n=([^,]+)/);
    const sigMatch = sigHeader.match(/sig=([0-9a-f]+)$/i);

    if (!tMatch || !nMatch || !sigMatch) {
        return { valid: false, reason: "malformed_header" };
    }

    const timestamp = parseInt(tMatch[1], 10);
    const nonce = nMatch[1];
    const providedSig = sigMatch[1];

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - timestamp) > 300) {
        return { valid: false, reason: "expired" };
    }

    const method = request.method;
    const pathname = new URL(request.url).pathname;
    const bodyHash = crypto.createHash("sha256").update(rawBody, "utf8").digest("hex");
    const canon = `${method}\n${pathname}\n${timestamp}\n${bodyHash}`;

    const expectedSig = crypto.createHmac("sha256", secret).update(canon, "utf8").digest();
    const providedBuf = Buffer.from(providedSig, "hex");

    if (expectedSig.length !== providedBuf.length) {
        return { valid: false, reason: "signature_mismatch" };
    }

    if (!crypto.timingSafeEqual(expectedSig, providedBuf)) {
        return { valid: false, reason: "signature_mismatch" };
    }

    // Recorded only after the signature verifies, so an unauthenticated caller
    // cannot fill the nonce store with junk.
    if (!(await nonceCache.checkAndRecord(nonce))) {
        return { valid: false, reason: "replay" };
    }

    return { valid: true };
}
