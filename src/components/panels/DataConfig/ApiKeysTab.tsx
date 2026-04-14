import { useState, useCallback, useEffect, useRef } from "react";
import { Eye, EyeOff, Trash2, Key, CheckCircle, XCircle, Loader, ShieldCheck } from "lucide-react";
import {
    API_KEY_REGISTRY,
    getUserApiKey,
    setUserApiKey,
    clearAllUserApiKeys,
} from "@/lib/userApiKeys";
import { sectionHeaderStyle, inputGroupStyle, labelStyle } from "./sharedStyles";

type VerifyStatus = "idle" | "verifying" | "valid" | "invalid";

const keyInputStyle: React.CSSProperties = {
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border-subtle)",
    color: "var(--text-primary)",
    padding: "var(--space-xs) var(--space-sm)",
    borderRadius: "var(--radius-sm)",
    fontSize: 12,
    width: "100%",
    outline: "none",
    fontFamily: "monospace",
};

const toggleBtnStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    padding: "var(--space-xs)",
    display: "flex",
    alignItems: "center",
};

const DEBOUNCE_MS = 800;
const MIN_KEY_LENGTH = 20;

function StatusIcon({ status }: { status: VerifyStatus }) {
    if (status === "verifying")
        return (
            <span style={{ display: "flex", alignItems: "center", color: "var(--text-muted)" }}>
                <Loader size={13} style={{ animation: "spin 1s linear infinite" }} />
            </span>
        );
    if (status === "valid")
        return <CheckCircle size={13} style={{ color: "#22c55e", flexShrink: 0 }} />;
    if (status === "invalid")
        return <XCircle size={13} style={{ color: "#ef4444", flexShrink: 0 }} />;
    return null;
}

export function ApiKeysTab() {
    const [keys, setKeys] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        API_KEY_REGISTRY.forEach((e) => {
            initial[e.service] = getUserApiKey(e.service);
        });
        return initial;
    });

    const [visible, setVisible] = useState<Record<string, boolean>>({});
    const [status, setStatus] = useState<Record<string, VerifyStatus>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const verifyKey = useCallback(async (service: string, key: string) => {
        setStatus((prev) => ({ ...prev, [service]: "verifying" }));
        setErrors((prev) => ({ ...prev, [service]: "" }));
        try {
            const res = await fetch("/api/keys/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ service, key }),
            });
            const data = await res.json();
            setStatus((prev) => ({ ...prev, [service]: data.valid ? "valid" : "invalid" }));
            if (!data.valid) {
                 setErrors((prev) => ({ ...prev, [service]: data.error || "Invalid key" }));
            } else if (service === "google_maps") {
                 // Prompt user to reload the page to apply the new 3D tileset
                 if (window.confirm("Google Maps API Key validated successfully! The page must be reloaded to apply the 3D tiles. Reload now?")) {
                      window.location.reload();
                 }
            }
        } catch {
            setStatus((prev) => ({ ...prev, [service]: "invalid" }));
            setErrors((prev) => ({ ...prev, [service]: "Verification failed" }));
        }
    }, []);

    const handleChange = useCallback((service: string, value: string) => {
        setKeys((prev) => ({ ...prev, [service]: value }));
        setUserApiKey(service, value);
        setStatus((prev) => ({ ...prev, [service]: "idle" }));
        setErrors((prev) => ({ ...prev, [service]: "" }));

        clearTimeout(debounceRefs.current[service]);
        if (value.length >= MIN_KEY_LENGTH) {
            debounceRefs.current[service] = setTimeout(() => verifyKey(service, value), DEBOUNCE_MS);
        }
    }, [verifyKey]);

    const handleManualVerify = useCallback((service: string) => {
        const key = keys[service];
        if (key && key.length >= MIN_KEY_LENGTH) verifyKey(service, key);
    }, [keys, verifyKey]);

    // Verify pre-loaded keys on mount
    useEffect(() => {
        API_KEY_REGISTRY.forEach((e) => {
            const key = getUserApiKey(e.service);
            if (key.length >= MIN_KEY_LENGTH) verifyKey(e.service, key);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggleVisibility = useCallback(
        (service: string) => setVisible((prev) => ({ ...prev, [service]: !prev[service] })),
        []
    );

    const handleClearAll = useCallback(() => {
        clearAllUserApiKeys();
        const cleared: Record<string, string> = {};
        API_KEY_REGISTRY.forEach((e) => (cleared[e.service] = ""));
        setKeys(cleared);
        setStatus({});
        setErrors({});
    }, []);

    const hasAnyKey = Object.values(keys).some((v) => v.length > 0);

    return (
        <>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            <div style={{ marginBottom: "var(--space-lg)" }}>
                <div style={sectionHeaderStyle}>
                    <Key size={10} style={{ marginRight: 4, verticalAlign: "middle" }} />
                    Your API Keys
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: "var(--space-md)" }}>
                    Optional — if set, your key is used instead of the shared default.
                    Keys are stored only in your browser.
                </div>

                {API_KEY_REGISTRY.map((entry) => {
                    const st = status[entry.service] ?? "idle";
                    const err = errors[entry.service];
                    const borderColor =
                        st === "valid" ? "rgba(34,197,94,0.5)"
                            : st === "invalid" ? "rgba(239,68,68,0.5)"
                                : "var(--border-subtle)";

                    return (
                        <div key={entry.service} style={{ marginBottom: "var(--space-md)" }}>
                            <div style={{ ...inputGroupStyle, marginBottom: "var(--space-xs)" }}>
                                <label style={labelStyle}>{entry.label}</label>
                            </div>
                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                <input
                                    type={visible[entry.service] ? "text" : "password"}
                                    value={keys[entry.service]}
                                    placeholder={entry.placeholder}
                                    onChange={(e) => handleChange(entry.service, e.target.value)}
                                    style={{ ...keyInputStyle, border: `1px solid ${borderColor}` }}
                                    spellCheck={false}
                                    autoComplete="new-password"
                                    data-form-type="other"
                                    data-lpignore="true"
                                    name={`wwv-apikey-${entry.service}`}
                                />
                                <StatusIcon status={st} />
                                <button
                                    onClick={() => handleManualVerify(entry.service)}
                                    disabled={!keys[entry.service] || keys[entry.service].length < MIN_KEY_LENGTH || st === "verifying"}
                                    title="Verify key"
                                    style={{
                                        ...toggleBtnStyle,
                                        color: st === "valid" ? "#22c55e" : st === "invalid" ? "#ef4444" : "var(--text-muted)",
                                        opacity: (!keys[entry.service] || keys[entry.service].length < MIN_KEY_LENGTH || st === "verifying") ? 0.4 : 1,
                                        cursor: (!keys[entry.service] || keys[entry.service].length < MIN_KEY_LENGTH || st === "verifying") ? "not-allowed" : "pointer",
                                    }}
                                >
                                    <ShieldCheck size={14} />
                                </button>
                                <button
                                    style={toggleBtnStyle}
                                    onClick={() => toggleVisibility(entry.service)}
                                    title={visible[entry.service] ? "Hide" : "Show"}
                                >
                                    {visible[entry.service] ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                            {st === "invalid" && err && (
                                <div style={{ fontSize: 10, color: "#ef4444", marginTop: 3 }}>{err}</div>
                            )}
                            {st === "valid" && (
                                <div style={{ fontSize: 10, color: "#22c55e", marginTop: 3 }}>Key verified ✓</div>
                            )}
                        </div>
                    );
                })}
            </div>

            {hasAnyKey && (
                <button
                    onClick={handleClearAll}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: "rgba(239, 68, 68, 0.1)",
                        color: "#ef4444",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        borderRadius: "var(--radius-sm)",
                        padding: "var(--space-xs) var(--space-sm)",
                        fontSize: 12,
                        cursor: "pointer",
                        width: "100%",
                        justifyContent: "center",
                    }}
                >
                    <Trash2 size={12} />
                    Clear All Keys
                </button>
            )}
        </>
    );
}
