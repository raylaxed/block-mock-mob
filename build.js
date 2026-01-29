const fs = require('fs');
const { execSync } = require('child_process');

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

// --- Build Chrome Version ---
console.log('Building Chrome Zip...');
const chromeManifest = { ...manifest };
chromeManifest.background = {
    service_worker: "src/background/background.js",
    type: "module"
};
delete chromeManifest.browser_specific_settings; // Chrome doesn't need this

fs.writeFileSync('manifest.json', JSON.stringify(chromeManifest, null, 2));
execSync('zip -r block-mock-mobb-chrome.zip manifest.json src/');

// --- Build Firefox Version ---
console.log('Building Firefox XPI...');
const firefoxManifest = { ...manifest };
firefoxManifest.background = {
    scripts: ["src/background/background.js"]
};
// Ensure Firefox specific settings are there
firefoxManifest.browser_specific_settings = {
    gecko: {
        id: "block-mock-mobb@mobbit-db.vercel.app",
        strict_min_version: "109.0"
    }
};

fs.writeFileSync('manifest.json', JSON.stringify(firefoxManifest, null, 2));
execSync('zip -r block-mock-mobb-firefox.xpi manifest.json src/');

// --- Restore Original (or leave as Firefox for your current testing) ---
// fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2));

console.log('Done! Created:');
console.log('- block-mock-mobb-chrome.zip');
console.log('- block-mock-mobb-firefox.xpi');
