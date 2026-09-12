// Make the client default to English rather than following the browser's
// Accept-Language list. An explicit choice in Options is stored as a pref and
// still wins over both, so this only changes what a first-time visitor sees.
const fs = require('fs');
const path = require('path');

const DEX = path.join(__dirname, 'psclient', 'play.pokemonshowdown.com', 'src', 'battle-dex.ts');
let d = fs.readFileSync(DEX, 'utf8');

if (d.includes('Config.defaultLanguage')) {
	console.log('battle-dex.ts already patched');
	process.exit(0);
}

// Match the exact line, including its indentation, and require it to be unique.
const OLD = `lang ||= window.PS ? this.getBrowserLanguage() : 'en';`;
const NEW = `lang ||= (window.Config && Config.defaultLanguage) || (window.PS ? this.getBrowserLanguage() : 'en');`;

const count = d.split(OLD).length - 1;
if (count !== 1) {
	console.error(`expected exactly one occurrence of the language fallback, found ${count}`);
	process.exit(1);
}

d = d.replace(OLD, NEW);
fs.writeFileSync(DEX, d);

// Prove it landed in the right place, not at the top of the file.
const line = d.split('\n').findIndex(l => l.includes('Config.defaultLanguage')) + 1;
console.log(`battle-dex.ts patched at line ${line}`);
console.log(`  ${d.split('\n')[line - 1].trim()}`);
if (!d.startsWith('/**')) {
	console.error('FILE HEAD LOOKS WRONG - the patch landed somewhere unexpected');
	process.exit(1);
}
