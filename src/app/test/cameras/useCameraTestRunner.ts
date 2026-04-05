import { useState, useRef, useEffect, useCallback } from "react";
import type { TestResult } from "./types";

export function useCameraTestRunner(testSources: string[], testStatuses: string[]) {
    const [cameras, setCameras] = useState<TestResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchCameras = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/camera/traffic");
            const data = await res.json();

            let staticFeatures: any[] = [];
            try {
                const staticRes = await fetch("/public-cameras.json");
                if (staticRes.ok) {
                    const staticData = await staticRes.json();
                    if (staticData.features) {
                        staticFeatures = staticData.features.map((f: any) => ({
                            ...f,
                            properties: {
                                ...f.properties,
                                name: f.properties.city || f.properties.region || "Public Camera",
                                source: f.properties.source || "cameras_json"
                            }
                        }));
                    }
                }
            } catch (staticErr) {
                console.error("Failed to fetch static cameras:", staticErr);
            }

            let combinedFeatures: any[] = [];
            if (data.cameras) {
                combinedFeatures = [...data.cameras];
            }
            combinedFeatures = [...combinedFeatures, ...staticFeatures];

            setCameras(combinedFeatures.map((c: any) => ({
                feature: c,
                status: "pending"
            })));
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchCameras();
    }, [fetchCameras]);

    const runTests = async () => {
        if (testing) return;
        setTesting(true);

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        const maxConcurrent = 20;
        let index = 0;
        let active = 0;

        const itemsToTest = cameras
            .map((c, originalIndex) => ({ c, originalIndex }))
            .filter(({ c }) => {
                const sourceMatches = testSources.includes("all") || testSources.includes(c.feature.properties.source || "Unknown");
                const statusMatches = testStatuses.includes("all") || testStatuses.includes(c.status);
                return sourceMatches && statusMatches;
            });

        setCameras(prev => {
            const nextState = [...prev];
            for (const { originalIndex } of itemsToTest) {
                nextState[originalIndex] = { ...nextState[originalIndex], status: "pending", testStartTime: undefined, latencyMs: undefined, errorMsg: undefined, httpStatus: undefined, contentType: undefined };
            }
            return nextState;
        });

        await new Promise<void>((resolve) => {
            const next = () => {
                if (signal.aborted) {
                    resolve();
                    return;
                }
                while (active < maxConcurrent && index < itemsToTest.length) {
                    const item = itemsToTest[index++];
                    const currentIndex = item.originalIndex;
                    active++;

                    const cam = item.c;
                    let streamUrl = cam.feature.properties.stream;

                    if (!streamUrl) {
                        setCameras(prev => {
                            const nextState = [...prev];
                            nextState[currentIndex] = {
                                ...nextState[currentIndex],
                                status: "error",
                                errorMsg: "No stream URL provided"
                            };
                            return nextState;
                        });
                        active--;
                        next();
                        continue;
                    }

                    setCameras(prev => {
                        const nextState = [...prev];
                        nextState[currentIndex] = { ...nextState[currentIndex], status: "testing", testStartTime: Date.now() };
                        return nextState;
                    });

                    fetch(`/api/camera/test?url=${encodeURIComponent(streamUrl)}`, { signal })
                        .then(res => res.json())
                        .then(data => {
                            setCameras(prev => {
                                const nextState = [...prev];
                                const isOk = data.status === 200 || data.status === 204 || data.status === 206;
                                nextState[currentIndex] = {
                                    ...nextState[currentIndex],
                                    status: isOk ? "ok" : (data.status === "timeout" ? "timeout" : "error"),
                                    httpStatus: data.status,
                                    contentType: data.contentType,
                                    latencyMs: data.latencyMs,
                                    errorMsg: data.error
                                };
                                return nextState;
                            });
                        })
                        .catch(err => {
                            if (err.name === 'AbortError') return;
                            setCameras(prev => {
                                const nextState = [...prev];
                                nextState[currentIndex] = {
                                    ...nextState[currentIndex],
                                    status: "error",
                                    errorMsg: err.message
                                };
                                return nextState;
                            });
                        })
                        .finally(() => {
                            active--;
                            next();
                        });
                }

                if (active === 0 && index >= itemsToTest.length) {
                    resolve();
                }
            };
            next();
        });

        setTesting(false);
    };

    const stopTests = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setTesting(false);
        }
    };

    const retestCamera = async (globalIndex: number) => {
        const cam = cameras[globalIndex];
        const streamUrl = cam.feature.properties.stream;
        if (!streamUrl) return;

        setCameras(prev => {
            const nextState = [...prev];
            nextState[globalIndex] = { ...nextState[globalIndex], status: "testing", testStartTime: Date.now(), latencyMs: undefined, errorMsg: undefined, httpStatus: undefined, contentType: undefined };
            return nextState;
        });

        try {
            const res = await fetch(`/api/camera/test?url=${encodeURIComponent(streamUrl)}`);
            const data = await res.json();
            setCameras(prev => {
                const nextState = [...prev];
                const isOk = data.status === 200 || data.status === 204 || data.status === 206;
                nextState[globalIndex] = {
                    ...nextState[globalIndex],
                    status: isOk ? "ok" : (data.status === "timeout" ? "timeout" : "error"),
                    httpStatus: data.status,
                    contentType: data.contentType,
                    latencyMs: data.latencyMs,
                    errorMsg: data.error
                };
                return nextState;
            });
        } catch (err: any) {
            setCameras(prev => {
                const nextState = [...prev];
                nextState[globalIndex] = {
                    ...nextState[globalIndex],
                    status: "error",
                    errorMsg: err.message
                };
                return nextState;
            });
        }
    };

    return { cameras, loading, testing, runTests, stopTests, retestCamera };
}
