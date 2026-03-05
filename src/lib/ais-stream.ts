// Next.js uses Native Node.js ^18 WebSocket APIs, so we don't import 'ws'

// Map to store the latest position of each vessel
// MMSI -> Vessel Data
const vesselCache = new Map<number, any>();

let ws: WebSocket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let isConnecting = false;

// Store the socket connection start time to periodically restart it
// aisstream.io connections can sometimes get stale
let connectionStartTime = 0;
const MAX_CONNECTION_AGE_MS = 1000 * 60 * 60; // 1 hour

export function getCachedVessels() {
    // Return all values from the cache
    return Array.from(vesselCache.values());
}

export function startAisStream() {
    if (ws || isConnecting) {
        // If connection is too old, restart it
        if (ws && Date.now() - connectionStartTime > MAX_CONNECTION_AGE_MS) {
            console.log('[AIS Stream] Connection is stale. Reconnecting...');
            ws.close(); // This will trigger the onclose handler which reconnects
        }
        return;
    }

    const apiKey = process.env.MARITIME_API_KEY;
    if (!apiKey) {
        console.warn('[AIS Stream] MARITIME_API_KEY is not set. AIS streaming is disabled.');
        return;
    }

    isConnecting = true;
    console.log('[AIS Stream] Connecting to aisstream.io...');

    try {
        ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

        // Set a connection timeout (if it hangs without triggering open/error)
        const connectionTimeout = setTimeout(() => {
            if (isConnecting && ws) {
                console.warn('[AIS Stream] Connection timed out. Terminating...');
                ws.terminate();
            }
        }, 30000); // Increased to 30s for slow connections

        ws.on('open', () => {
            clearTimeout(connectionTimeout);
            console.log('[AIS Stream] Connected securely to aisstream.io');
            isConnecting = false;
            connectionStartTime = Date.now();

            const subscriptionMessage = {
                ApiKey: apiKey,
                BoundingBoxes: [[[-90, -180], [90, 180]]],
                FilterMessageTypes: ["PositionReport"]
            };

            ws?.send(JSON.stringify(subscriptionMessage));
            console.log('[AIS Stream] Sent subscription message');

            // Set up ping interval to keep connection alive
            const pingInterval = setInterval(() => {
                if (ws?.readyState === WebSocket.OPEN) {
                    ws.ping();
                } else {
                    clearInterval(pingInterval);
                }
            }, 30000); // Ping every 30s

            // attach interval to ws object so it can be cleared on close
            (ws as any)._pingInterval = pingInterval;
        });

        ws.on('message', (data) => {
            try {
                const rawBuffer = data.toString();
                // Verbose logging removed to prevent spam once it connects
                const message = JSON.parse(rawBuffer);

                if (message.MessageType === 'PositionReport') {
                    const report = message.Message.PositionReport;
                    const meta = message.MetaData;

                    const mmsi = report.UserID;

                    // Basic sanity check on coordinates
                    if (report.Latitude >= 91 || report.Latitude <= -91 ||
                        report.Longitude >= 181 || report.Longitude <= -181) {
                        return;
                    }

                    // Convert speed and heading (Sog is in knots, Cog is in degrees)
                    // aisstream sometimes sends 1023 for "not available" speed or 3600 for "not available" course
                    const speed = report.Sog === 1023 ? 0 : report.Sog;
                    const heading = report.Cog === 3600 ? 0 : report.Cog;

                    // Derive a rough category from ship type if available, otherwise unknown
                    // Since PositionReport doesn't always have ShipType, we might need a separate lookup 
                    // or just default to unknown for now

                    vesselCache.set(mmsi, {
                        mmsi: mmsi,
                        name: meta.ShipName?.trim() || `Unknown (${mmsi})`,
                        type: 'other', // Default type unless we get ShipStaticData
                        lat: report.Latitude,
                        lon: report.Longitude,
                        speed: speed,
                        heading: heading,
                        timestamp: meta.time_utc,
                    });

                    // To prevent memory leaks, limit cache size 
                    // Ensure we don't store more than e.g. 50,000 vessels
                    if (vesselCache.size > 50000) {
                        // Delete the oldest entry (Map iterates in insertion order)
                        const firstKey = vesselCache.keys().next().value;
                        if (firstKey) {
                            vesselCache.delete(firstKey);
                        }
                    }
                }
            } catch (e) {
                // Ignore parsing errors for individual messages
            }
        });

        ws.on('close', () => {
            console.log('[AIS Stream] Connection closed. Reconnecting in 5 seconds...');
            ws = null;
            isConnecting = false;
            scheduleReconnect();
        });

        ws.on('error', (err) => {
            console.error('[AIS Stream] WebSocket error:', err.message);
            // Error usually precedes close, but close handles the reconnect
        });

    } catch (e) {
        console.error('[AIS Stream] Failed to establish connection:', e);
        isConnecting = false;
        scheduleReconnect();
    }
}

function scheduleReconnect() {
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
    }
    reconnectTimeout = setTimeout(() => {
        startAisStream();
    }, 5000);
}
