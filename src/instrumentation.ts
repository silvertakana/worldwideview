export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { startMilitaryPolling } = await import("./lib/military");
        startMilitaryPolling();
    }
}
