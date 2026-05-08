import fs from 'fs';
import path from 'path';

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf-8');

if (process.env.NEXT_PUBLIC_WWV_EDITION === 'cloud') {
  schema = schema.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
  console.log("Swapped Prisma provider to PostgreSQL for cloud edition.");
} else {
  // Revert back to sqlite just in case it was swapped
  schema = schema.replace(/provider\s*=\s*"postgresql"/, 'provider = "sqlite"');
}

fs.writeFileSync(schemaPath, schema);
