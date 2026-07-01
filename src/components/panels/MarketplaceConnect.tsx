"use client";

/**
 * @file MarketplaceConnect.tsx
 * @description PKCE-based account connection button for the Plugins tab.
 * Checks edition type and credential status, shows connect/disconnect UI.
 * @module src/components/panels
 */

import { useEffect, useState } from "react";
import { Plug, PlugZap } from "lucide-react";
import { isDemo } from "@/core/edition";
import styles from "./MarketplaceConnect.module.css";

// ─── Types ──────────────────────────────────────────────────

interface ConnectionStatus {
    connected: boolean;
    connectedAt?: string;
    lastUpdated?: string;
    encryptionMasterKeyConfigured?: boolean;
}

type Status =
    | { kind: "loading" }
    | { kind: "unavailable"; reason: string }
    | { kind: "connected"; data: ConnectionStatus }
    | { kind: "disconnected"; data: ConnectionStatus };

// ─── Component ──────────────────────────────────────────────

export function MarketplaceConnect() {
    const [status, setStatus] = useState<Status>(() =>
        isDemo
            ? { kind: "unavailable", reason: "Not available on demo edition" }
            : { kind: "loading" },
    );

    useEffect(() => {
        if (isDemo) return;

        let cancelled = false;
        fetch("/api/marketplace/status")
            .then((r) => r.json())
            .then((data: ConnectionStatus) => {
                if (cancelled) return;
                if (data.encryptionMasterKeyConfigured === false) {
                    setStatus({
                        kind: "unavailable",
                        reason: "Configuration incomplete — ENCRYPTION_MASTER_KEY not set",
                    });
                } else if (data.connected) {
                    setStatus({ kind: "connected", data });
                } else {
                    setStatus({ kind: "disconnected", data });
                }
            })
            .catch(() => {
                if (cancelled) return;
                setStatus({ kind: "unavailable", reason: "Could not reach server" });
            });

        return () => {
            cancelled = true;
        };
    }, []);

    // ── Loading state ──
    if (status.kind === "loading") {
        return (
            <div className={styles.loading}>
                Checking connection...
            </div>
        );
    }

    // ── Unavailable (demo / config incomplete / error) ──
    if (status.kind === "unavailable") {
        return (
            <div className={styles.unavailable}>
                <span className={styles.unavailableIcon}>&#9888;</span>
                {status.reason}
            </div>
        );
    }

    // ── Connected ──
    if (status.kind === "connected") {
        const label = status.data.connectedAt
            ? `Connected ${new Date(status.data.connectedAt).toLocaleDateString()}`
            : "Connected";

        return (
            <div className={styles.connected}>
                <span className={styles.connectedDot} />
                <span className={styles.connectedLabel}>
                    <PlugZap size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                    {label}
                </span>
            </div>
        );
    }

    // ── Disconnected → show connect button ──
    const marketplaceUrl =
        process.env.NEXT_PUBLIC_MARKETPLACE_URL ?? "https://marketplace.worldwideview.dev";

    return (
        <a
            href="/api/marketplace/connect"
            className={styles.connect}
            data-testid="marketplace-connect-btn"
            title={`Connect to ${marketplaceUrl}`}
        >
            <Plug size={14} />
            Connect to Marketplace
        </a>
    );
}
