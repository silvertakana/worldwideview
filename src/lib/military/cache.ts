import { globalState } from "./state";

export function getCachedMilitaryData() {
    if (globalState.militaryData) {
        return {
            data: globalState.militaryData,
            timestamp: globalState.militaryTimestamp,
        };
    }

    return {
        data: null,
        timestamp: 0,
    };
}

export function updateMilitaryCache(data: unknown, timestamp: number) {
    globalState.militaryData = data;
    globalState.militaryTimestamp = timestamp;
}
