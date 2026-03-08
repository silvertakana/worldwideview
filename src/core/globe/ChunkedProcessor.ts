/**
 * Utility to process large arrays of items in chunks over multiple frames
 * to prevent main thread blocking (using requestIdleCallback or setTimeout fallback).
 */

export class ChunkedProcessor {
    private currentRunId: number = 0;

    /**
     * Processes an array of items in chunks. Returns a promise that resolves when all items are processed.
     * If a new call to processChunked is made, any previous pending processing is cancelled.
     *
     * @param items The full array of items to process
     * @param chunkSize How many items to process per chunk
     * @param processFn The function called for each chunk. Receives the chunk array.
     */
    public processChunked<T>(
        items: T[],
        chunkSize: number,
        processFn: (chunk: T[]) => void
    ): Promise<void> {
        this.currentRunId++;
        const runId = this.currentRunId;

        return new Promise((resolve, reject) => {
            if (!items || items.length === 0) {
                return resolve();
            }

            let index = 0;

            const processNextChunk = (deadline?: IdleDeadline) => {
                // Cancel silently if a newer run was started
                if (runId !== this.currentRunId) {
                    return resolve();
                }

                // Process items while we have time (if deadline is provided) or process at least one chunk
                do {
                    const chunk = items.slice(index, index + chunkSize);
                    if (chunk.length === 0) break;

                    try {
                        processFn(chunk);
                    } catch (err) {
                        return reject(err);
                    }

                    index += chunkSize;
                } while (index < items.length && deadline && deadline.timeRemaining() > 5);

                if (index < items.length) {
                    scheduleNext();
                } else {
                    resolve();
                }
            };

            const scheduleNext = () => {
                if (typeof window !== "undefined" && window.requestIdleCallback) {
                    window.requestIdleCallback(processNextChunk);
                } else {
                    setTimeout(() => processNextChunk(), 0);
                }
            };

            scheduleNext();
        });
    }

    /**
     * Cancel any currently running chunked processing
     */
    public cancel() {
        this.currentRunId++;
    }
}

export const globalChunkedProcessor = new ChunkedProcessor();
