const fs = require('fs');
const path = require('path');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const distPath = path.join(__dirname, '../dist/textlint_versions.json');

const versions = {};

for (const [packageName] of Object.entries(packageJson.devDependencies)) {
  if (packageName.includes('textlint')) {
    const packagePath = path.resolve('node_modules', packageName, 'package.json');
    const installedVersion = require(packagePath).version;
    versions[packageName] = installedVersion;
  }
}

fs.writeFileSync(distPath, JSON.stringify(versions, null, 2));
