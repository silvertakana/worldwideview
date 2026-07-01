/* eslint-disable no-console */
import { createPublicKey, verify } from "crypto";

/** Ed25519 public key for verifying the WWV plugin registry. */
const REGISTRY_PUBLIC_KEY = "MCowBQYDK2VwAyEAk7T+s8Us85H4pR9pJt78pG2H17bUYqLSGi6ngbDvGo8=";

/** Default marketplace registry URL (configurable via env). */
const REGISTRY_URL = process.env.WWV_REGISTRY_URL ?? "https://marketplace.worldwideview.dev/api/registry";

interface RegistryPayload {
  plugins: string[];
  issuedAt: string;
  signature: string;
}

/** In-memory cache for the verified plugin set. */
let cache: { plugins: Set<string>; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Verify the Ed25519 signature on the registry payload. */
function verifySignature(data: string, signatureB64: string): boolean {
  const keyObj = createPublicKey({
    key: Buffer.from(REGISTRY_PUBLIC_KEY, "base64"),
    format: "der",
    type: "spki",
  });
  return verify(null, Buffer.from(data), keyObj, Buffer.from(signatureB64, "base64"));
}

/**
 * Fetch the signed verified-plugins registry and return the set of
 * verified plugin IDs. Caches for 5 minutes.
 * Returns an empty set on failure (fail-open: unknown plugins are unverified).
 */
export async function getVerifiedPluginIds(): Promise<Set<string>> {
  if (cache && Date.now() < cache.expiresAt) return cache.plugins;

  try {
    const res = await fetch(REGISTRY_URL, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error(`Registry returned ${res.status}`);

    const body: RegistryPayload = await res.json();
    const { signature, ...payload } = body;
    const data = JSON.stringify(payload);

    if (!verifySignature(data, signature)) {
      console.error("[RegistryClient] Signature verification failed");
      return cache?.plugins ?? new Set();
    }

    const plugins = new Set(body.plugins);
    cache = { plugins, expiresAt: Date.now() + CACHE_TTL_MS };
    return plugins;
  } catch (err) {
    console.error("[RegistryClient] Failed to fetch registry:", err);
    return cache?.plugins ?? new Set();
  }
}
