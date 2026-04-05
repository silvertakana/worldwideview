const fs = require('fs');
const path = require('path');

const packagesDir = path.join(__dirname, 'packages');
const packages = fs.readdirSync(packagesDir);

for (const pkg of packages) {
  const tsconfigPath = path.join(packagesDir, pkg, 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    const data = fs.readFileSync(tsconfigPath, 'utf8');
    try {
      const json = JSON.parse(data);
      if (json.compilerOptions && json.compilerOptions.rootDir) {
        delete json.compilerOptions.rootDir;
        fs.writeFileSync(tsconfigPath, JSON.stringify(json, null, 2) + '\n', 'utf8');
        console.log(`Fixed ${tsconfigPath}`);
      }
    } catch (e) {
      console.error(`Failed to parse ${tsconfigPath}`, e);
    }
  }
}
