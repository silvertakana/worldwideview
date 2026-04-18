import fs from "fs";
import path from "path";

const packagesDir = path.resolve(process.cwd(), "..", "worldwideview-plugins", "packages");
const publicPluginsDir = path.resolve(process.cwd(), "public", "plugins");

if (!fs.existsSync(publicPluginsDir)) {
    fs.mkdirSync(publicPluginsDir, { recursive: true });
}

const dirs = fs.readdirSync(packagesDir).filter(d => d.startsWith("wwv-plugin-") && d !== "wwv-plugin-sdk");

for (const dir of dirs) {
    const pkgDir = path.join(packagesDir, dir);
    const pkgPath = path.join(pkgDir, "package.json");
    const distPath = path.join(pkgDir, "dist", "frontend.mjs");
    
    if (fs.existsSync(distPath) && fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        
        if (!pkg.worldwideview) {
            console.log(`Skipped ${dir} - No worldwideview metadata in package.json`);
            continue;
        }

        const publicName = dir.replace("wwv-plugin-", "");
        const targetDir = path.join(publicPluginsDir, publicName);
        
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        
        const manifest = {
            id: pkg.worldwideview.id || publicName,
            name: pkg.worldwideview.name || publicName,
            version: pkg.version,
            description: pkg.description || "",
            capabilities: pkg.worldwideview.capabilities || [],
            category: pkg.worldwideview.category || "custom",
            icon: pkg.worldwideview.icon || "Plugin",
            entry: `/plugins/${publicName}/frontend.mjs`,
            format: "bundle",
            trust: "unverified"
        };
        
        fs.copyFileSync(distPath, path.join(targetDir, "frontend.mjs"));
        fs.writeFileSync(path.join(targetDir, "plugin.json"), JSON.stringify(manifest, null, 2));
        console.log(`Deployed ${publicName} to public/plugins`);
    } else {
        console.log(`Skipped ${dir} - dist or package.json not found.`);
    }
}
