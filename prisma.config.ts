import fs from "fs";
import path from "path";

let dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    try {
        const envPath = path.resolve(process.cwd(), ".env");
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, "utf8");
            const match = envContent.match(/^DATABASE_URL=(.*)$/m);
            if (match) {
                dbUrl = match[1].trim();
            }
        }
    } catch (e) {
        // Ignore
    }
}

export default {
    datasource: {
        url: dbUrl,
    },
};