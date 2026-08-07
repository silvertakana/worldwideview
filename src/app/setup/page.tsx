"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createAdminAccount, validateProvisionToken, activateProvisionedAccount } from "./actions";
import { ensureAdminSeeded } from "@/lib/ensureAdminSeeded";
import styles from "./setup.module.css";

function SetupForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const isCloudMode = !!token;

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [prefillEmail, setPrefillEmail] = useState("");
    const [prefillName, setPrefillName] = useState("");
    const [tokenValid, setTokenValid] = useState(!isCloudMode);
    const [tokenChecked, setTokenChecked] = useState(!isCloudMode);
    const [autoSeed, setAutoSeed] = useState<{
        loading: boolean;
        email?: string;
        error?: string;
    }>({ loading: !isCloudMode });

    // Auto-seed check — only in local/demo mode (not cloud provisioning)
    useEffect(() => {
        if (isCloudMode) return;
        ensureAdminSeeded()
            .then((result) => {
                if (result.seeded) {
                    setAutoSeed({ loading: false, email: result.email });
                } else if (result.error) {
                    setAutoSeed({ loading: false, error: result.error });
                } else {
                    setAutoSeed({ loading: false });
                }
            })
            .catch((err: unknown) => {
                const message =
                    err instanceof Error ? err.message : "Auto-seed check failed";
                setAutoSeed({ loading: false, error: message });
            });
    }, [isCloudMode]);

    useEffect(() => {
        if (!isCloudMode) return;
        const cancelled = false;
        validateProvisionToken(token!).then((result) => {
            if (cancelled) return;
            if (result.valid && result.email) {
                setPrefillEmail(result.email);
                setPrefillName(result.name ?? "");
                setTokenValid(true);
            } else {
                setError(result.error ?? "Invalid or expired setup link.");
            }
            setTokenChecked(true);
        });
    }, [token, isCloudMode]);

    async function handleLocalSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const result = await createAdminAccount(formData);

        if (result.success) {
            router.push("/login");
        } else {
            setError(result.error ?? "Setup failed.");
            setLoading(false);
        }
    }

    async function handleCloudSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const name = formData.get("name") as string;
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        const result = await activateProvisionedAccount(token!, name, email, password);

        if (result.success) {
            router.push("/login");
        } else {
            setError(result.error ?? "Activation failed.");
            setLoading(false);
        }
    }

    // ── Cloud provisioning mode ──
    if (isCloudMode && !tokenChecked) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <p className={styles.subtitle}>Validating setup link...</p>
                </div>
            </div>
        );
    }

    if (isCloudMode && !tokenValid) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <div className={styles.logo}>W</div>
                    <h1 className={styles.title}>Invalid Setup Link</h1>
                    <p className={styles.error}>{error || "This setup link is invalid or has expired."}</p>
                </div>
            </div>
        );
    }

    if (isCloudMode) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <div className={styles.logo}>W</div>
                    <h1 className={styles.title}>Activate Your Account</h1>
                    <p className={styles.subtitle}>Set up your password to activate your WorldWideView account</p>
                    <form onSubmit={handleCloudSubmit} className={styles.form}>
                        <label className={styles.label} htmlFor="name">
                            Display Name
                            <input id="name" name="name" type="text" required className={styles.input} placeholder="Your name" defaultValue={prefillName} />
                        </label>
                        <label className={styles.label} htmlFor="email">
                            Email
                            <input id="email" name="email" type="email" required className={styles.input} value={prefillEmail} readOnly />
                        </label>
                        <label className={styles.label} htmlFor="password">
                            Password
                            <input id="password" name="password" type="password" required minLength={8} className={styles.input} placeholder="Min. 8 characters" />
                        </label>
                        <label className={styles.label} htmlFor="confirm">
                            Confirm Password
                            <input id="confirm" name="confirm" type="password" required minLength={8} className={styles.input} />
                        </label>
                        {error && <p className={styles.error}>{error}</p>}
                        <button type="submit" disabled={loading} className={styles.button}>
                            {loading ? "Activating..." : "Activate Account"}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // ── Local/demo mode: auto-seed states ──
    if (autoSeed.loading) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <div className={styles.logo}>W</div>
                    <h1 className={styles.title}>Welcome to WorldWideView</h1>
                    <p className={styles.subtitle}>Checking setup state...</p>
                </div>
            </div>
        );
    }

    if (autoSeed.email) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <div className={styles.logo}>W</div>
                    <h1 className={styles.title}>Admin Account Ready</h1>
                    <p className={styles.subtitle}>An admin account was auto-seeded successfully.</p>
                    <p style={{ color: "var(--text-secondary, #888)", fontSize: "0.85rem", margin: "0 0 1.5rem" }}>
                        Sign in with <strong>{autoSeed.email}</strong> and the configured admin password.
                    </p>
                    <Link href="/login" className={styles.button} style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                        Go to Login
                    </Link>
                </div>
            </div>
        );
    }

    // ── Local/demo mode: manual setup form (auto-seed skipped or failed) ──
    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.logo}>W</div>
                <h1 className={styles.title}>Welcome to WorldWideView</h1>
                <p className={styles.subtitle}>Create your admin account to get started</p>

                {autoSeed.error && <p className={styles.error}>{autoSeed.error}</p>}

                <form onSubmit={handleLocalSubmit} className={styles.form}>
                    <label className={styles.label} htmlFor="name">
                        Display Name
                        <input id="name" name="name" type="text" required className={styles.input} placeholder="Admin" />
                    </label>
                    <label className={styles.label} htmlFor="email">
                        Email
                        <input id="email" name="email" type="email" required className={styles.input} placeholder="admin@example.com" />
                    </label>
                    <label className={styles.label} htmlFor="password">
                        Password
                        <input id="password" name="password" type="password" required minLength={8} className={styles.input} placeholder="Min. 8 characters" />
                    </label>
                    <label className={styles.label} htmlFor="confirm">
                        Confirm Password
                        <input id="confirm" name="confirm" type="password" required minLength={8} className={styles.input} />
                    </label>
                    {error && <p className={styles.error}>{error}</p>}
                    <button type="submit" disabled={loading} className={styles.button}>
                        {loading ? "Creating..." : "Create Admin Account"}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function SetupPage() {
    return (
        <Suspense fallback={<div className={styles.container}><div className={styles.card}><p className={styles.subtitle}>Loading...</p></div></div>}>
            <SetupForm />
        </Suspense>
    );
}
