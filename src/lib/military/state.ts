export const POLL_INTERVAL = 60000; // 60 seconds (adsb.fi rate limit: 1 req/s)

// Global state to survive HMR in Next.js development
export const globalState = globalThis as unknown as {
    militaryData: any;
    militaryTimestamp: number;
    militaryPollingStarted: boolean;
    militaryPollingInterval: NodeJS.Timeout | null;
    isMilitaryFetching: boolean;
    currentMilitaryBackoff: number;
};

if (globalState.militaryPollingStarted === undefined) {
    globalState.militaryData = null;
    globalState.militaryTimestamp = 0;
    globalState.militaryPollingStarted = false;
    globalState.militaryPollingInterval = null;
    globalState.isMilitaryFetching = false;
    globalState.currentMilitaryBackoff = POLL_INTERVAL;
}
