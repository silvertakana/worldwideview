"use client";

/**
 * @file page.tsx
 * @description Client component that reads PKCE callback result from
 * `useSearchParams()` and renders error/success messages.
 * @module app/marketplace/connect-status
 */

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import styles from "./page.module.css";

// ─── Error configuration ────────────────────────────────────

interface ErrorConfig {
    icon: string;
    title: string;
    message: string;
}

const ERROR_MAP: Record<string, ErrorConfig> = {
    state_mismatch: {
        icon: "&#128274;",
        title: "Security Check Failed",
        message:
            "The connection request could not be verified. This usually happens when " +
            "the authentication session expired. Please try connecting again.",
    },
    missing_verifier: {
        icon: "&#9203;",
        title: "Session Expired",
        message:
            "The connection request took too long and the security credentials expired. " +
            "Please try connecting again.",
    },
    token_exchange_failed: {
        icon: "&#9888;",
        title: "Connection Failed",
        message:
            "Could not complete the connection. The marketplace may be temporarily " +
            "unavailable. Please try again later.",
    },
    encryption_failed: {
        icon: "&#128477;",
        title: "Configuration Error",
        message:
            "Could not secure your connection. The server is missing the required " +
            "encryption key (ENCRYPTION_MASTER_KEY). Contact your administrator.",
    },
    unknown: {
        icon: "&#10071;",
        title: "Something Went Wrong",
        message:
            "An unexpected error occurred during the connection process. " +
            "Please try again.",
    },
};

// ─── Inner component (needs Suspense for useSearchParams) ────

function ConnectStatusContent() {
    const params = useSearchParams();
    const error = params.get("error");
    const connected = params.get("connected");

    // ── Success state ──
    if (connected === "true") {
        return (
            <div className={styles.card}>
                <span
                    className={styles.icon}
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: "&#10004;&#65039;" }}
                />
                <h1 className={styles.title}>Successfully Connected!</h1>
                <p className={styles.message}>
                    Your globe is now linked to your marketplace account. You can
                    browse and install plugins directly from the marketplace.
                </p>
                <div className={styles.actions}>
                    <Link href="/" className={styles.btnPrimary}>
                        <ArrowLeft size={14} />
                        Back to Globe
                    </Link>
                </div>
            </div>
        );
    }

    // ── Error state ──
    const config = error && ERROR_MAP[error] ? ERROR_MAP[error] : ERROR_MAP.unknown;

    return (
        <div className={styles.card}>
            <span
                className={styles.icon}
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: config.icon }}
            />
            <h1 className={styles.title}>{config.title}</h1>
            <p className={styles.message}>{config.message}</p>
            <div className={styles.actions}>
                <Link href="/" className={styles.btnSecondary}>
                    <ArrowLeft size={14} />
                    Back to Globe
                </Link>
                <Link href="/api/marketplace/connect" className={styles.btnPrimary}>
                    Try Again
                </Link>
            </div>
        </div>
    );
}

// ─── Page (wraps content in Suspense per Next.js 15 requirement) ─

export default function ConnectStatusPage() {
    return (
        <div className={styles.container}>
            <Suspense
                fallback={
                    <div className={styles.card}>
                        <p className={styles.message}>Loading...</p>
                    </div>
                }
            >
                <ConnectStatusContent />
            </Suspense>
        </div>
    );
}
