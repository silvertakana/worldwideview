import { useRef, useState, useEffect } from "react";

const SESSION_ID_KEY = "wwv-globe-session-id";

export function useSessionId(): string {
    // resolvedRef caches the id after the first effect run so rerenders are free
    const resolvedRef = useRef<string>("");
    const [sessionId, setSessionId] = useState<string>("");

    useEffect(() => {
        if (resolvedRef.current) return;

        // sessionStorage is only available in the browser (this effect never runs on the server)
        const existing = sessionStorage.getItem(SESSION_ID_KEY);
        const id = existing ?? (() => {
            const newId = crypto.randomUUID();
            sessionStorage.setItem(SESSION_ID_KEY, newId);
            return newId;
        })();

        resolvedRef.current = id;
        setSessionId(id);
    }, []);

    return sessionId;
}
