// Post-assembly fixes for serving the client from a subdirectory.
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir) { console.error('usage: fix-client-paths.js <dir>'); process.exit(1); }

// 1. config.js is requested with an empty cachebuster, so a browser that has
//    seen an older copy keeps serving it and never picks up config changes.
//    Stamp it with the content hash instead.
const cfgPath = path.join(dir, 'config', 'config.js');
const cfg = fs.readFileSync(cfgPath);
const hash = require('crypto').createHash('sha1').update(cfg).digest('hex').slice(0, 8);

const indexPath = path.join(dir, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
const before = html;
html = html.replace(/config\/config\.js\?[^"']*/g, `config/config.js?${hash}`);
fs.writeFileSync(indexPath, html);
console.log(html === before ? 'index.html: no cachebuster change' : `index.html: config cachebuster -> ${hash}`);

// 2. battle-log.js fetches /config/colors.json from the site root, which 404s
//    under a subdirectory. Harmless (it is caught) but noisy, and custom
//    username colours are nicer to have than not.
const blPath = path.join(dir, 'js', 'battle-log.js');
if (fs.existsSync(blPath)) {
	let bl = fs.readFileSync(blPath, 'utf8');
	const had = bl.includes('"/config/colors.json?"');
	bl = bl.split('"/config/colors.json?"').join('"config/colors.json?"');
	fs.writeFileSync(blPath, bl);
	console.log(had ? 'battle-log.js: colors.json path made relative' : 'battle-log.js: already relative');
}

// 3. Report anything else still reaching for the site root from JS.
let rootRefs = 0;
for (const f of fs.readdirSync(path.join(dir, 'js'))) {
	if (!f.endsWith('.js')) continue;
	const js = fs.readFileSync(path.join(dir, 'js', f), 'utf8');
	const hits = js.match(/["']\/(config|js|style|data)\//g);
	if (hits) { rootRefs += hits.length; console.log(`  ${f}: ${hits.length} root-absolute path(s)`); }
}
console.log(`remaining root-absolute paths in js/: ${rootRefs}`);
