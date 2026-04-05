import { mkdirSync, writeFileSync, readFileSync, readdirSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function scaffold(name: string): void {
    const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const dir = resolve(process.cwd(), slug);

    console.log(`\n🌍 Creating WorldWideView plugin: ${slug}\n`);
    mkdirSync(join(dir, "src"), { recursive: true });

    const templateDir = join(__dirname, "..", "templates");
    const files = readdirSync(templateDir);

    for (const file of files) {
        let content = readFileSync(join(templateDir, file), "utf8");
        content = content.replace(/\{\{SLUG\}\}/g, slug);
        content = content.replace(
            /\{\{NAME\}\}/g,
            slug
                .split("-")
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(""),
        );

        // Strip .tpl extension and route index.ts into src/
        const outName = file.replace(/\.tpl$/, "");
        const dest =
            outName === "index.ts"
                ? join(dir, "src", outName)
                : join(dir, outName);

        writeFileSync(dest, content);
        console.log(`  ✓ ${outName === "index.ts" ? "src/" + outName : outName}`);
    }

    console.log(`\n✅ Done! Next steps:`);
    console.log(`  cd ${slug}`);
    console.log(`  npm install`);
    console.log(`  npm run dev    # Watch mode`);
    console.log(`  npm run build  # Production bundle`);
    console.log(`  npm publish    # Publish to npm\n`);
}
