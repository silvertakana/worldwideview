import { useState } from "react";
import { IntelPropertyRow } from "./IntelPropertyRow";

function formatLocal(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
        day: "numeric", month: "2-digit", year: "numeric",
        hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short",
    });
}

function formatUtc(iso: string): string {
    return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function formatRelative(iso: string): string {
    const diff = new Date(iso).getTime() - Date.now();
    const abs = Math.abs(diff);
    const future = diff > 0;
    if (abs < 60_000) return "just now";
    if (abs < 3_600_000) {
        const n = Math.round(abs / 60_000);
        return future ? `in ${n}m` : `${n}m ago`;
    }
    if (abs < 86_400_000) {
        const n = Math.round(abs / 3_600_000);
        return future ? `in ${n}h` : `${n}h ago`;
    }
    const n = Math.round(abs / 86_400_000);
    return future ? `in ${n}d` : `${n}d ago`;
}

interface DatetimePropertyRowProps {
    label: string;
    iso: string;
    classNamePrefix?: string;
}

export function DatetimePropertyRow({ label, iso, classNamePrefix = "intel-panel" }: DatetimePropertyRowProps) {
    const [expanded, setExpanded] = useState(false);

    if (expanded) {
        return (
            <IntelPropertyRow label={label} isColumn classNamePrefix={classNamePrefix}>
                <span
                    style={{ cursor: "pointer", fontWeight: 600 }}
                    onClick={() => setExpanded(false)}
                >
                    {formatLocal(iso)}
                </span>
                <span style={{ opacity: 0.6, fontSize: "0.85em" }}>{formatUtc(iso)}</span>
                <span style={{ opacity: 0.6, fontSize: "0.85em" }}>{formatRelative(iso)}</span>
            </IntelPropertyRow>
        );
    }

    return (
        <IntelPropertyRow label={label} classNamePrefix={classNamePrefix}>
            <span
                style={{ cursor: "pointer", textDecoration: "underline dotted" }}
                onClick={() => setExpanded(true)}
            >
                {formatLocal(iso)}
            </span>
        </IntelPropertyRow>
    );
}
