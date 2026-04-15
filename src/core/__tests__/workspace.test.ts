import { expect, test, describe } from "vitest";
import * as fs from "fs";
import { join } from "path";

describe("Monorepo Workspace Integrity", () => {
    test("all local workspace packages strictly use workspace:* protocol", () => {
        // Find all package.json in packages/
        // __dirname is dist/core/__tests__ when transpiled or src/core/__tests__ when running tsx/vitest natively
        const rootDir = process.cwd(); // vitest runs from workspace root
        
        const packageDirs = fs.readdirSync(join(rootDir, "packages"), { withFileTypes: true })
             .filter(d => d.isDirectory())
             .map(d => `packages/${d.name}/package.json`)
             .filter(p => fs.existsSync(join(rootDir, p)));
        const packageJsonFiles = [
             "package.json",
             ...packageDirs
        ];

        let failedFiles: string[] = [];

        for (const file of packageJsonFiles) {
            const content = fs.readFileSync(join(rootDir, file), "utf-8");
            const pkg = JSON.parse(content);
            const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
            
            for (const [dep, version] of Object.entries(deps)) {
                // If it's an internal package linking to "@worldwideview/..."
                if (dep.startsWith("@worldwideview/")) {
                    if (version === "*") {
                        failedFiles.push(`${file} uses "*" for ${dep}. It MUST use "workspace:*"`);
                    }
                }
            }
        }

        // We expect zero packages to be violating this rule
        expect(failedFiles).toEqual([]);
    });
});
