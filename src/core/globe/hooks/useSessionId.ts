import { useRef, useState, useEffect } from "react";

const SESSION_ID_KEY = "wwv-globe-session-id";

function createSessionId(): string {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

    // randomUUID is restricted to secure contexts in some browsers. WWV is
    // commonly self-hosted over HTTP on a LAN hostname, while getRandomValues
    // remains available there.
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function useSessionId(): string {
    // resolvedRef caches the id after the first effect run so rerenders are free
    const resolvedRef = useRef<string>("");
    const [sessionId, setSessionId] = useState<string>("");

    useEffect(() => {
        if (resolvedRef.current) return;

        // sessionStorage is only available in the browser (this effect never runs on the server)
        const existing = sessionStorage.getItem(SESSION_ID_KEY);
        const id = existing ?? (() => {
            const newId = createSessionId();
            sessionStorage.setItem(SESSION_ID_KEY, newId);
            return newId;
        })();

        resolvedRef.current = id;
        setSessionId(id);
    }, []);

    return sessionId;
}
