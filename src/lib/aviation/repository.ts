/**
 * Aviation history repository — DISABLED.
 *
 * All functions return empty / no-op results so that existing callers
 * (API routes, supabase.ts) continue to work without errors.
 * Re-enable by restoring the Prisma-backed implementation and
 * uncommenting the AviationHistory model in schema.prisma.
 */

export async function getLatestFromDb(): Promise<{ states: any[]; time: number } | null> {
    return null;
}

export async function recordToDb(_states: any[], _timeSecs: number) {
    // no-op while aviation history is disabled
}

export async function getAvailabilityRange() {
    return [];
}

export async function getHistoryAtTime(_targetTimeMs: number) {
    return { records: [], recordTime: null };
}
