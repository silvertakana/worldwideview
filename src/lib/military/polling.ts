import { globalState, POLL_INTERVAL } from "./state";
import { updateMilitaryCache } from "./cache";

const ADSB_FI_MIL_URL = "https://opendata.adsb.fi/api/v2/mil";

export async function pollMilitary() {
    if (globalState.isMilitaryFetching) return;
    globalState.isMilitaryFetching = true;

    try {
        const res = await fetch(ADSB_FI_MIL_URL, {
            cache: "no-store",
            signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
            globalState.currentMilitaryBackoff = Math.min(
                (globalState.currentMilitaryBackoff || POLL_INTERVAL) * 2,
                5 * 60 * 1000,
            );
            console.warn(
                `[Military Polling] adsb.fi returned ${res.status}: ${res.statusText} ` +
                `(Backing off to ${globalState.currentMilitaryBackoff / 1000}s)`,
            );
            return;
        }

        globalState.currentMilitaryBackoff = POLL_INTERVAL;
        const data = await res.json();
        const now = Date.now();

        console.log(
            `[Military Polling] Fetched ${data.ac?.length ?? 0} military aircraft from adsb.fi`,
        );

        updateMilitaryCache(data, now);
    } catch (err) {
        globalState.currentMilitaryBackoff = Math.min(
            (globalState.currentMilitaryBackoff || POLL_INTERVAL) * 2,
            5 * 60 * 1000,
        );

        const error = err as any;
        const isTimeout =
            error?.name === "AbortError" ||
            error?.name === "TimeoutError" ||
            error?.cause?.code === "UND_ERR_CONNECT_TIMEOUT";
        const message = isTimeout
            ? "Connection timed out"
            : error?.message || String(error);
        console.error(
            `[Military Polling] Error (Backing off to ${globalState.currentMilitaryBackoff / 1000}s): ${message}`,
        );
    } finally {
        globalState.isMilitaryFetching = false;

        if (globalState.militaryPollingInterval) {
            clearTimeout(globalState.militaryPollingInterval);
        }
        const jitter = Math.floor(Math.random() * 5000);
        globalState.militaryPollingInterval = setTimeout(
            pollMilitary,
            globalState.currentMilitaryBackoff + jitter,
        );
    }
}
