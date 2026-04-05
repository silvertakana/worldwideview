"use client";

export interface CapturedLog {
    level: "log" | "warn" | "error" | "info" | "debug";
    message: string;
    timestamp: string;
}

const capturedLogs: CapturedLog[] = [];
const MAX_LOGS = 500;
let isInitialized = false;

// Store original console methods so we don't cause infinite loops
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;
const originalInfo = console.info;
const originalDebug = console.debug;

export function initLogCatcher() {
    if (typeof window === "undefined" || isInitialized) return;
    
    const levels = [
        { name: "log" as const, original: originalLog },
        { name: "warn" as const, original: originalWarn },
        { name: "error" as const, original: originalError },
        { name: "info" as const, original: originalInfo },
        { name: "debug" as const, original: originalDebug }
    ];
    
    levels.forEach(({ name, original }) => {
        console[name] = (...args: any[]) => {
            // Forward to original console
            original.apply(console, args);
            
            try {
                // Stringify arguments safely, aggressively optimizing performance 
                // to avoid freezing the main thread rendering loop on large objects.
                const message = args.map(arg => {
                    if (typeof arg === "string") return arg;
                    if (arg instanceof Error) return arg.stack || arg.message;
                    if (typeof arg === "object" && arg !== null) {
                        try {
                            // Very shallow serialization. Do not traverse deeply.
                            const str = JSON.stringify(arg, (key, value) => {
                                if (key !== "" && typeof value === "object" && value !== null) {
                                    return Array.isArray(value) ? "[Array]" : "[Object]";
                                }
                                return value;
                            });
                            return str.length > 500 ? str.slice(0, 500) + "..." : str;
                        } catch {
                            return "[Complex Object]";
                        }
                    }
                    return String(arg);
                }).join(" ");
                
                // Cap the maximum length of any single log to 1000 chars to avoid memory leaks
                const finalMessage = message.length > 1000 ? message.slice(0, 1000) + "..." : message;
                
                capturedLogs.push({
                    level: name,
                    message: finalMessage,
                    timestamp: new Date().toISOString()
                });
                
                if (capturedLogs.length > MAX_LOGS) {
                    capturedLogs.shift();
                }
            } catch (err) {
                // Ignore errors inside log catcher to avoid infinite loops
            }
        };
    });
    
    isInitialized = true;
}

export function getCapturedLogs(): CapturedLog[] {
    return [...capturedLogs];
}
