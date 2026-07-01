"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isDemo } from "@/core/edition";
import { authClient } from "@/lib/auth-client";
import { migrateLegacyUserIfNeeded } from "@/lib/auth/migrate-legacy-user";
import styles from "../setup/setup.module.css";

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

export default function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const next = searchParams.get("next");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        const { error: signInError } = await authClient.signIn.email({
            email,
            password,
            callbackURL: getSafeRedirect(next),
        });

        if (signInError) {
            // Try migrating legacy NextAuth user to Better Auth
            const migrated = await migrateLegacyUserIfNeeded(email, password);
            if (migrated) {
                // Retry sign-in — the BetterAuthUser + account now exist
                const { error: retryError } = await authClient.signIn.email({
                    email,
                    password,
                    callbackURL: getSafeRedirect(next),
                });
                if (retryError) {
                    console.error("[Login] Retry sign-in error after migration:", retryError.message);
                    setError("Sign in failed after migration. Try again.");
                }
                // On retry success, Better Auth redirects
            } else {
                console.error("[Login] Sign-in error:", signInError.message);
                setError("Sign in failed. Check your credentials and try again.");
            }
            setLoading(false);
        }
        // On success, Better Auth redirects to callbackURL
    }

    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.logo}>W</div>
          <h1 className={styles.title}>Sign in to WorldWideView</h1>
          <p className={styles.subtitle}>Enter your credentials to continue</p>

          <form onSubmit={handleSubmit} method="post" className={styles.form}>
            <label className={styles.label} htmlFor="email">
              {isDemo ? "Username" : "Email"}
              <input
                id="email"
                name="email"
                type={isDemo ? "text" : "email"}
                required
                className={styles.input}
                placeholder={isDemo ? "admin" : "admin@example.com"}
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

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" disabled={loading} className={styles.button}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    );
}
