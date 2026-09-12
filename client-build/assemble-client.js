// Assemble a static, self-contained copy of the patched client.
//
// Sprites, audio and dex data are left pointing at the official CDN (via
// Config.routes.client), so this only carries the client's own code - tens of
// megabytes of sprites do not need hosting.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'psclient', 'play.pokemonshowdown.com');
const ROOTCFG = path.join(__dirname, 'psclient', 'config', 'config.js');
const OUT = process.argv[2] || path.join(__dirname, 'client-dist');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let copied = 0, bytes = 0;
function copyDir(from, to, skip) {
	fs.mkdirSync(to, { recursive: true });
	for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
		const a = path.join(from, entry.name);
		const b = path.join(to, entry.name);
		if (entry.isDirectory()) { copyDir(a, b, skip); continue; }
		if (skip && skip(entry.name)) continue;
		fs.copyFileSync(a, b);
		copied++; bytes += fs.statSync(b).size;
	}
}

// Source maps are for debugging upstream and trebl the size; drop them.
copyDir(path.join(SRC, 'js'), path.join(OUT, 'js'), n => n.endsWith('.map'));
copyDir(path.join(SRC, 'style'), path.join(OUT, 'style'));

// config/config.js in the checkout is a git symlink that Windows wrote out as a
// text file containing its target path, so take the real one from the root.
fs.mkdirSync(path.join(OUT, 'config'), { recursive: true });
fs.copyFileSync(ROOTCFG, path.join(OUT, 'config', 'config.js'));

// `node build` regenerates config/config.js, so our settings have to be applied
// to the assembled copy rather than to the source - appending them before a
// build silently loses them, which is exactly how testclient kept disappearing.
const OURS = `
/*** Velvet Bunny ***/
// Pin the client to our server whatever hostname it is served from:
// client-connection only falls back to defaultserver when Config.server is unset.
Config.defaultserver = {
	id: 'velvetbunny',
	host: 'velvet-bunny-showdown.onrender.com',
	port: 443,
	httpport: 443,
	altport: 80,
	registered: false,
};
Config.server = Config.defaultserver;

// Without this the client, cross-origin to routes.client, injects a hidden
// crossdomain.php iframe into play.pokemonshowdown.com and waits forever for a
// postMessage that never comes - it never even attempts our server. Its only
// other effect is loading battle text relatively, which already falls back to
// the official CDN.
Config.testclient = true;

// English unless the viewer chooses otherwise in Options. Without this the
// client follows the browser's Accept-Language list, so a French browser gets a
// French interface with no obvious cause.
Config.defaultLanguage = 'en';

// routes.client deliberately stays on the official host, so sprites, audio and
// dex data load from their CDN and this bundle stays small and never stale.

// The main-menu panel. Editing this file is enough - no rebuild needed.
Config.botChallenge = {
	name: 'Velvet Bunny',
	difficulties: ['easy', 'normal', 'hard', 'champion'],
	defaultFormat: 'gen9randombattle',
};
/*** end Velvet Bunny ***/
`;
fs.appendFileSync(path.join(OUT, 'config', 'config.js'), OURS);
for (const f of ['colors.json', 'coil.json']) {
	const real = path.join(__dirname, 'psclient', 'config', f);
	if (fs.existsSync(real)) fs.copyFileSync(real, path.join(OUT, 'config', f));
}

for (const f of ['favicon.ico', 'favicon-256.png', 'favicon-32.png', 'favicon-16.png', 'manifest.json']) {
	const a = path.join(SRC, f);
	if (fs.existsSync(a)) fs.copyFileSync(a, path.join(OUT, f));
}

// The index uses absolute paths ("/js/..."), which break when the site is served
// from a subdirectory such as GitHub Pages project pages. Make them relative.
let html = fs.readFileSync(path.join(SRC, 'index-new.html'), 'utf8');
html = html.replace(/(src|href)="\/(js|style|config|fx)\//g, '$1="$2/');
// The dex data (pokedex, moves, items, learnsets...) is many megabytes and
// changes with every Showdown release. Load it from the official CDN rather
// than shipping and maintaining our own stale copy.
html = html.replace(/(src|href)="\/(data|src)\//g, '$1="https://play.pokemonshowdown.com/$2/');
fs.writeFileSync(path.join(OUT, 'index.html'), html);

// GitHub Pages runs Jekyll by default, which ignores files starting with "_".
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

const leftoverAbsolute = (html.match(/(src|href)="\/[a-z]/g) || []).length;
console.log(`assembled ${OUT}`);
console.log(`  files: ${copied + 3}, ~${(bytes / 1048576).toFixed(1)} MB`);
console.log(`  remaining absolute local paths in index.html: ${leftoverAbsolute}`);
console.log(`  server pinned: ${/velvet-bunny-showdown/.test(fs.readFileSync(path.join(OUT, 'config', 'config.js'), 'utf8'))}`);
console.log(`  bot panel present: ${/botChallenge/.test(fs.readFileSync(path.join(OUT, 'js', 'panel-mainmenu.js'), 'utf8'))}`);
