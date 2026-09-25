"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { isDemo } from "@/core/edition";
import { authClient } from "@/lib/auth-client";
import { migrateLegacyUserIfNeeded } from "@/lib/auth/migrate-legacy-user";
import styles from "../setup/setup.module.css";

/** Every failure path resolves to one of these, so the user always sees a reason. */
const CREDENTIALS_ERROR = "Sign in failed. Check your credentials and try again.";
const MIGRATION_ERROR = "Sign in failed after migration. Try again.";
const UNREACHABLE_ERROR = "Could not reach the sign-in service. Check your connection and try again.";

/** Allow relative paths or same-origin URLs only (local edition is self-contained). */
function getSafeRedirect(url: string | null): string {
    if (!url) return "/";
    if (url.startsWith("/") && url[1] !== "/" && url[1] !== "\\") return url;
    try {
        const parsed = new URL(url);
        if (parsed.origin === window.location.origin) return url;
    } catch { /* invalid URL — fall through */ }
    return "/";
}

/**
 * One sign-in attempt, plus the legacy-account migration retry.
 *
 * Returns null on success (Better Auth navigates to the callback URL), or
 * human-readable copy for the user.
 */
async function signInWithMigration(
    email: string,
    password: string,
    callbackURL: string,
): Promise<string | null> {
    const { error: signInError } = await authClient.signIn.email({ email, password, callbackURL });
    if (!signInError) return null;

    console.warn("[login] sign-in failed", { code: signInError.code, message: signInError.message });

    // Try migrating legacy NextAuth user to Better Auth
    const migrated = await migrateLegacyUserIfNeeded(email, password);
    if (!migrated) return CREDENTIALS_ERROR;

    // Retry sign-in — the BetterAuthUser + account now exist
    const { error: retryError } = await authClient.signIn.email({ email, password, callbackURL });
    if (!retryError) return null; // On retry success, Better Auth redirects

    console.warn("[login] sign-in retry failed", { code: retryError.code, message: retryError.message });
    return MIGRATION_ERROR;
}

/**
 * Sign in, converting any failure into copy for the user.
 *
 * The request itself can reject — server down, offline, or a cross-origin call
 * the auth server refuses. That rejection used to escape the submit handler and
 * leave the button stuck on "Signing in..." with nothing to read, so it is
 * caught here and reported like any other failure.
 */
async function attemptSignIn(
    email: string,
    password: string,
    callbackURL: string,
): Promise<string | null> {
    try {
        return await signInWithMigration(email, password, callbackURL);
    } catch (cause) {
        console.warn("[login] sign-in request failed", cause);
        return UNREACHABLE_ERROR;
    }
}

export default function LoginForm() {
    const searchParams = useSearchParams();
    const next = searchParams.get("next");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const email = String(formData.get("email") ?? "");
        const password = String(formData.get("password") ?? "");

        const failure = await attemptSignIn(email, password, getSafeRedirect(next));

        // On success Better Auth is navigating — stay pending so the form cannot
        // be submitted twice mid-redirect.
        if (failure) {
            setError(failure);
            setLoading(false);
        }
    }

    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.logo}>W</div>
          <h1 className={styles.title}>Sign in to WorldWideView</h1>
          <p className={styles.subtitle}>Enter your credentials to continue</p>

          <form onSubmit={handleSubmit} method="post" className={styles.form}>
            <label className={styles.label} htmlFor="email">
              Email
              <input
                id="email"
                name="email"
                type="email"
                required
                className={styles.input}
                placeholder={isDemo ? "admin@worldwideview.local" : "admin@example.com"}
              />
            </label>

            <label className={styles.label} htmlFor="password">
              Password
              <input
                id="password"
                name="password"
                type="password"
                required
                className={styles.input}
              />
            </label>

            {error && <p className={styles.error} role="alert">{error}</p>}

            <button type="submit" disabled={loading} className={styles.button}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    );
}
