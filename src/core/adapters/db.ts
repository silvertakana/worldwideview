import { isCloud } from "@/core/edition";
import { PrismaClient } from "../../generated/prisma/client";
import { headers } from "next/headers";

export function createPrismaClient() {
    if (isCloud) {
        const { Pool } = require("pg");
        const { PrismaPg } = require("@prisma/adapter-pg");
        
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        const adapter = new PrismaPg(pool);
        
        const client = new PrismaClient({ adapter } as any);

        // Use Prisma Client Extension to inject RLS
        return client.$extends({
            query: {
                $allModels: {
                    async $allOperations({ args, query }: { args: any, query: any }) {
                        const headersList = await headers();
                        const tenantSubdomain = headersList.get("x-tenant-subdomain");
                        
                        if (tenantSubdomain) {
                            const [, result] = await client.$transaction([
                                client.$executeRaw`SELECT set_config('app.tenant_id', ${tenantSubdomain}, TRUE)`,
                                query(args),
                            ]);
                            return result as any;
                        }
                        return query(args);
                    },
                },
            },
        }) as unknown as PrismaClient; // Cast to avoid complex type issues in consuming code for now
    } else {
        const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
        const Database = require("better-sqlite3");
        
        // Strip file: prefix if present for better-sqlite3
        let url = process.env.DATABASE_URL || "file:./data/wwv.db";
        if (url.startsWith("file:")) {
            url = url.slice(5);
        }
        
        const sqlite = new Database(url);
        const adapter = new PrismaBetterSqlite3(sqlite);
        return new PrismaClient({ adapter });
    }
}
