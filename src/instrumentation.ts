export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { startAviationPolling } = await import("./lib/aviation-polling");
        const { startAisStream } = await import("./lib/ais-stream");
        startAviationPolling();
        startAisStream();
    }
}
