import { NextResponse } from "next/server";
import { edition } from "@/core/edition";
import {
    probeRedis,
    probeDb,
    probeEngine,
    probeConfig,
    probeDemoAuth,
    probeDefaultPlugins,
} from "@/lib/healthProbes";

type HealthStatus = "healthy" | "degraded" | "unhealthy";

interface ReadinessBody {
    status: HealthStatus;
    checks: {
        redis: boolean;
        db: boolean;
        engine: boolean;
        config: boolean;
        demoAuth: boolean;
        defaultPlugins: boolean;
    };
    edition: string;
    timestamp: string;
}

export async function GET(): Promise<NextResponse<ReadinessBody>> {
    const [redis, db, engine, config, demoAuth, defaultPlugins] = await Promise.all([
        probeRedis(),
        probeDb(),
        probeEngine(),
        Promise.resolve(probeConfig()),
        probeDemoAuth(),
        probeDefaultPlugins(),
    ]);

    const checks = { redis, db, engine, config, demoAuth, defaultPlugins };

    let status: HealthStatus;
    let httpStatus: 200 | 503;

    if (!db || !config) {
        status = "unhealthy";
        httpStatus = 503;
    } else if (!redis || !engine || !demoAuth || !defaultPlugins) {
        status = "degraded";
        httpStatus = 200;
    } else {
        status = "healthy";
        httpStatus = 200;
    }

    const body: ReadinessBody = {
        status,
        checks,
        edition,
        timestamp: new Date().toISOString(),
    };

    return NextResponse.json(body, { status: httpStatus });
}
