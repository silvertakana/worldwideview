export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { startAviationPolling } = await import("./lib/aviation");
        const { startAisStream } = await import("./lib/ais-stream");
        const { startMilitaryPolling } = await import("./lib/military");
        startAviationPolling();
        startAisStream();
        startMilitaryPolling();
    }
}
