import Redis from "ioredis";

// Narrow interface covering only the commands this app uses directly.
// Exporting this type (rather than the full Redis class) keeps test mocks simple.
export interface RedisMultiChain {
    lrange(key: string, start: number, stop: number): this;
    del(key: string): this;
    rpush(key: string, ...values: string[]): this;
    expire(key: string, seconds: number): this;
    set(key: string, value: string, exFlag: "EX", ttlSeconds: number): this;
    exec(): Promise<Array<[Error | null, unknown]>>;
}

export interface RedisClient {
    set(key: string, value: string, exFlag: "EX", ttlSeconds: number): Promise<string | null>;
    get(key: string): Promise<string | null>;
    zadd(key: string, score: number, member: string): Promise<number>;
    zrange(key: string, start: number | string, stop: number | string, withScores: "WITHSCORES"): Promise<string[]>;
    zrem(key: string, ...members: string[]): Promise<number>;
    rpush(key: string, ...values: string[]): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    multi(): RedisMultiChain;
}

const client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    retryStrategy(times) {
        if (times > 10) return null;
        return Math.min(times * 50, 2000);
    },
    maxRetriesPerRequest: 3,
    lazyConnect: true,
});

// Graceful degrade: connectivity issues are logged but never thrown.
client.on("error", (err) => {
    console.warn("[Redis] connection error:", err);
});

export const redis: RedisClient = client as unknown as RedisClient;
