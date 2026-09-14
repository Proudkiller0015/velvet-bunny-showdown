'use strict';
/**
 * Build our damage calculator from Showdown's own.
 *
 *   node scripts/build-calc-page.js [--offline]
 *
 * Exactly the trick scripts/build-client-page.js plays with the client, for the
 * same reasons. The official calculator at calc.pokemonshowdown.com is the one
 * everybody already knows how to use, it is four thousand lines of careful
 * mechanics, and it is wrong about this server in precisely one way: it has
 * never heard of anything we invented. So we serve theirs, with ours added.
 *
 * Everything still loads from their host - scripts, styles, sprites - so their
 * fixes arrive without us doing anything and this repository stays small. Two
 * files of ours go in at the end:
 *
 *   - js/velvet-calc-data.js, the generated tables (build-calc-data.js)
 *   - js/velvet-calc.js, which puts them into the calculator's own data and
 *     teaches it what our abilities, items and moves actually do
 *
 * Both land after their scripts and before their `$(document).ready` runs,
 * which is the one window where the data can be changed before the dropdowns
 * are built out of it.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const SOURCE = 'https://calc.pokemonshowdown.com/';
const OUT = path.join(__dirname, '..', 'client', 'calc.html');
const CACHE = path.join(__dirname, '..', 'client', '.upstream-calc.html');

function fetchPage(url) {
	return new Promise((resolve, reject) => {
		https.get(url, { headers: { 'User-Agent': 'velvet-bunny-showdown build' } }, res => {
			if (res.statusCode !== 200) return reject(new Error(`${url} returned ${res.statusCode}`));
			let body = '';
			res.setEncoding('utf8');
			res.on('data', chunk => body += chunk);
			res.on('end', () => resolve(body));
		}).on('error', reject);
	});
}

function build(upstream) {
	let html = upstream;

	/*
	 * Their page addresses everything relatively - `./calc/calc.js`, `./js/...`,
	 * `./style/...`, `./img/...` - and served from here those would all be our
	 * paths. Absolute URLs back to their host are the whole point: the mechanics
	 * stay theirs and stay current.
	 */
	html = html.replace(/(src|href)="\.\/([^"]+)"/g, (m, attr, rest) => `${attr}="${SOURCE}${rest}"`);

	// Not ours to run, on someone else's server.
	html = html.replace(/<script[^>]*googletagmanager[^>]*>[\s\S]*?<\/script>\n?/g, '');
	html = html.replace(/<script>[\s\S]*?gtag\([\s\S]*?<\/script>\n?/g, '');

	// Whose calculator this is.
	html = html.replace(/<title>[^<]*<\/title>/,
		'<title>Velvet Bunny damage calculator</title>\n' +
		'<link rel="icon" href="/favicon.ico" />\n' +
		'<meta name="theme-color" content="#1a0d1a" />');

	/*
	 * Ours, last: after every script of theirs, and before the ready handler
	 * that reads calc.SPECIES and friends into the dropdowns. A script tag at
	 * the end of the body runs before any $(document).ready callback, which is
	 * what makes this the right place rather than a race.
	 */
	const ours = `
<!-- Ours, and only ours, below this line. -->
<script src="js/velvet-calc-data.js"></script>
<script src="js/velvet-calc.js"></script>
`;
	if (!html.includes('</body>')) throw new Error('no </body> to add ours before');
	html = html.replace('</body>', `${ours}</body>`);

	return html;
}

async function main() {
	const offline = process.argv.includes('--offline');
	let upstream;
	if (offline) {
		upstream = fs.readFileSync(CACHE, 'utf8');
		console.log(`offline: using ${CACHE}`);
	} else {
		upstream = await fetchPage(SOURCE);
		fs.writeFileSync(CACHE, upstream);
		console.log(`fetched ${SOURCE} (${Math.round(upstream.length / 1024)}KB)`);
	}

	const html = build(upstream);
	fs.writeFileSync(OUT, html);
	console.log(`wrote ${OUT} (${Math.round(html.length / 1024)}KB)`);

	// The checks worth having are the ones that catch their page changing shape
	// under us, which is the only way this file can quietly produce a calculator
	// that looks fine and has none of our data in it.
	const problems = [];
	if (!html.includes('js/velvet-calc.js')) problems.push('our script is missing');
	if (!html.includes('js/velvet-calc-data.js')) problems.push('our data is missing');
	if (html.includes('src="./')) problems.push('some relative URLs were not rewritten');
	if (!html.includes(`${SOURCE}calc/calc.js`)) problems.push('their calculator script is not linked');
	if (!html.includes(`${SOURCE}js/shared_controls.js`)) problems.push('their controls are not linked');
	if (html.includes('googletagmanager')) problems.push('analytics survived');
	if (problems.length) {
		console.error('problems:\n  ' + problems.join('\n  '));
		process.exit(1);
	}
	console.log('checked: their mechanics are linked, ours are added, analytics are out');
}

main().catch(e => { console.error(e.message); process.exit(1); });
