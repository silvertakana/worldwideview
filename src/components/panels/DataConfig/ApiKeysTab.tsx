import { useState, useCallback } from "react";
import { Eye, EyeOff, Trash2, Key } from "lucide-react";
import {
    API_KEY_REGISTRY,
    getUserApiKey,
    setUserApiKey,
    clearAllUserApiKeys,
} from "@/lib/userApiKeys";
import { sectionHeaderStyle, inputGroupStyle, labelStyle } from "./sharedStyles";

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

export function ApiKeysTab() {
    // Initialise state from localStorage for each service
    const [keys, setKeys] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        API_KEY_REGISTRY.forEach((e) => {
            initial[e.service] = getUserApiKey(e.service);
        });
        return initial;
    });

    const [visible, setVisible] = useState<Record<string, boolean>>({});

    const handleChange = useCallback((service: string, value: string) => {
        setKeys((prev) => ({ ...prev, [service]: value }));
        setUserApiKey(service, value);
    }, []);

    const toggleVisibility = useCallback((service: string) => {
        setVisible((prev) => ({ ...prev, [service]: !prev[service] }));
    }, []);

    const handleClearAll = useCallback(() => {
        clearAllUserApiKeys();
        const cleared: Record<string, string> = {};
        API_KEY_REGISTRY.forEach((e) => (cleared[e.service] = ""));
        setKeys(cleared);
    }, []);

    const hasAnyKey = Object.values(keys).some((v) => v.length > 0);

    return (
        <>
            <div style={{ marginBottom: "var(--space-lg)" }}>
                <div style={sectionHeaderStyle}>
                    <Key size={10} style={{ marginRight: 4, verticalAlign: "middle" }} />
                    Your API Keys
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: "var(--space-md)" }}>
                    Optional — if set, your key is used instead of the shared default.
                    Keys are stored only in your browser.
                </div>

                {API_KEY_REGISTRY.map((entry) => (
                    <div key={entry.service} style={{ marginBottom: "var(--space-md)" }}>
                        <div style={{ ...inputGroupStyle, marginBottom: "var(--space-xs)" }}>
                            <label style={labelStyle}>{entry.label}</label>
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                            <input
                                type={visible[entry.service] ? "text" : "password"}
                                value={keys[entry.service]}
                                placeholder={entry.placeholder}
                                onChange={(e) => handleChange(entry.service, e.target.value)}
                                style={keyInputStyle}
                                spellCheck={false}
                                autoComplete="off"
                            />
                            <button
                                style={toggleBtnStyle}
                                onClick={() => toggleVisibility(entry.service)}
                                title={visible[entry.service] ? "Hide" : "Show"}
                            >
                                {visible[entry.service]
                                    ? <EyeOff size={14} />
                                    : <Eye size={14} />}
                            </button>
                        </div>
                    </div>
                ))}
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
