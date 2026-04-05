"use client";

import { useEffect } from "react";
import { useStore } from "@/core/state/store";
import { AlertTriangle, X } from "lucide-react";
import styles from "./ErrorToast.module.css";

export default function ErrorToast() {
    const errorToastMessage = useStore((state) => state.errorToastMessage);
    const clearErrorToast = useStore((state) => state.clearErrorToast);

    useEffect(() => {
        if (errorToastMessage) {
            const timer = setTimeout(() => {
                clearErrorToast();
            }, 6000); // auto dismiss after 6s
            return () => clearTimeout(timer);
        }
    }, [errorToastMessage, clearErrorToast]);

    if (!errorToastMessage) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.toast}>
                <div className={styles.iconWrapper}>
                    <AlertTriangle color="#ef4444" size={20} />
                </div>
                <div className={styles.message}>
                    {errorToastMessage}
                </div>
                <button
                    className={styles.dismiss}
                    onClick={clearErrorToast}
                    aria-label="Dismiss Error"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}
