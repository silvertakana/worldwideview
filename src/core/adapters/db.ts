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
                    async $allOperations({ model, operation, args, query }: { model: string, operation: string, args: any, query: any }) {
                        const headersList = await headers();
                        const tenantSubdomain = headersList.get("x-tenant-subdomain");
                        
                        if (tenantSubdomain && model !== 'Workspace' && model !== 'WorkspaceMember') {
                            args = args || {};
                            
                            // Inject into data for creates
                            if (operation === 'create' || operation === 'createMany') {
                                if (Array.isArray(args.data)) {
                                    args.data = args.data.map((d: any) => ({ ...d, tenantId: tenantSubdomain }));
                                } else if (args.data) {
                                    args.data.tenantId = tenantSubdomain;
                                }
                            }
                            
                            // Inject into data for updates
                            if (operation === 'update' || operation === 'updateMany') {
                                if (args.data) args.data.tenantId = tenantSubdomain;
                            }
                            if (operation === 'upsert') {
                                if (args.create) args.create.tenantId = tenantSubdomain;
                                if (args.update) args.update.tenantId = tenantSubdomain;
                            }

                            // Inject into where filters
                            if (['findUnique', 'findFirst', 'findMany', 'update', 'updateMany', 'delete', 'deleteMany', 'count', 'upsert'].includes(operation)) {
                                args.where = { ...(args.where || {}), tenantId: tenantSubdomain };
                            }
                            
                            return query(args);
                        }
                        return query(args);
                    },
                },
            },
        }) as unknown as PrismaClient; // Cast to avoid complex type issues in consuming code for now
    } else {
        return new PrismaClient({
            datasources: {
                db: {
                    url: process.env.DATABASE_URL || "file:./data/wwv.db"
                }
            }
        });
    }
}
