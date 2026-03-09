export const POLL_INTERVAL = 15000; // 15 seconds

// Global state to survive HMR in Next.js development
export const globalState = globalThis as unknown as {
    aviationData: any;
    aviationTimestamp: number;
    aviationPollingStarted: boolean;
    aviationPollingInterval: NodeJS.Timeout | null;
    accessToken: string | null;
    tokenExpiry: number;
    isFetching: boolean;
    lastSupabaseInsert: number;
    currentBackoff: number;
    creditsRemaining: number | null;
    retryAfterSec: number | null;
};

if (globalState.aviationPollingStarted === undefined) {
    globalState.aviationData = null;
    globalState.aviationTimestamp = 0;
    globalState.aviationPollingStarted = false;
    globalState.aviationPollingInterval = null;
    globalState.accessToken = null;
    globalState.tokenExpiry = 0;
    globalState.isFetching = false;
    globalState.lastSupabaseInsert = 0;
    globalState.currentBackoff = 8000;
    globalState.creditsRemaining = null;
    globalState.retryAfterSec = null;
}
