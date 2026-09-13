'use strict';
/**
 * Build our client's index.html from Showdown's own.
 *
 *   node scripts/build-client-page.js [--offline]
 *
 * We serve the classic client - the one play.pokemonshowdown.com serves, and
 * the one everybody knows. Rather than keep a hand-edited copy of their page
 * that drifts every time they add a script, this fetches theirs and applies
 * our differences to it. Re-run it to pick up their changes.
 *
 * What we change, and why each one:
 *
 *   - their config becomes ours, because ours is what points the client at this
 *     server (and their copy would point it at theirs)
 *   - the analytics and the ad manager go, since neither is ours to run
 *   - `js/velvet-storage.js` goes in right after their storage script: the
 *     client asks Showdown for prefs and teams through a cross-domain iframe
 *     that answers for their hosts and not for ours, and would otherwise wait
 *     on it forever
 *   - `js/velvet-data.js` adds Samantha to the dex the client loaded
 *   - `/showdex/main.js` is the damage calculator, served rather than installed
 *   - the head gains a manifest and icons, so a phone can install this
 *   - the news panel says what this server is
 *
 * Everything else - every script, every stylesheet, every sprite - still comes
 * from their CDN. That is deliberate: it keeps this repository small and means
 * their client updates reach us without us doing anything.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const SOURCE = 'https://play.pokemonshowdown.com/';
const OUT = path.join(__dirname, '..', 'client', 'index.html');
const CACHE = path.join(__dirname, '..', 'client', '.upstream-index.html');

function fetchPage(url) {
	return new Promise((resolve, reject) => {
		https.get(url, { headers: { 'User-Agent': 'velvet-bunny-showdown build' } }, res => {
			if (res.statusCode !== 200) {
				reject(new Error(`${url} returned ${res.statusCode}`));
				return;
			}
			let body = '';
			res.setEncoding('utf8');
			res.on('data', chunk => body += chunk);
			res.on('end', () => resolve(body));
		}).on('error', reject);
	});
}

/** Drop a <script> tag (and any block that follows it) by what it contains. */
function dropScript(html, marker) {
	const pattern = new RegExp(
		`[\\t ]*<script[^>]*${marker}[^>]*>[\\s\\S]*?<\\/script>\\n?`, 'g'
	);
	return html.replace(pattern, '');
}

function build(upstream) {
	let html = upstream;

	// Ours, not theirs: this is the file that names the server to connect to.
	html = html.replace(
		/<script src="\/\/play\.pokemonshowdown\.com\/config\/config\.js[^"]*"><\/script>/,
		'<script src="config/config.js"></script>'
	);

	// Google Analytics, their ad manager, and the window.onerror handler that
	// reports to both - none of it belongs on someone else's server.
	html = html.replace(/<!-- Google Analytics -->[\s\S]*?<!-- End Google Analytics -->\n?/, '');
	html = dropScript(html, 'googletagmanager');
	html = dropScript(html, 'hb\\.vntsm\\.com');
	html = html.replace(/<script>\s*window\.__VM[\s\S]*?<\/script>\n?/, '');
	html = html.replace(/<script>\s*window\.onerror[\s\S]*?<\/script>\n?/, '');

	// Title and the things a phone needs to install this.
	html = html.replace(
		/<title>[^<]*<\/title>/,
		`<title>Velvet Bunny</title>
<link rel="manifest" href="manifest.json" />
<meta name="theme-color" content="#1a0d1a" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Velvet Bunny" />
<link rel="apple-touch-icon" href="icon-192.png" />
<!-- Showdex's typefaces; it is served from here rather than installed as an
     extension, which is what makes it work on a phone. -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Work+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;600;700&display=swap">
`
	);

	// Our stylesheet goes after every one of theirs, or it loses: CSS of equal
	// specificity is decided by which was loaded last, and half of what we
	// correct is a rule of theirs with exactly the same weight.
	const lastStylesheet = /<link rel="stylesheet" href="\/\/play\.pokemonshowdown\.com\/style\/[^"]*"[^>]*>(?![\s\S]*<link rel="stylesheet" href="\/\/play\.pokemonshowdown\.com\/style\/)/;
	if (!lastStylesheet.test(html)) throw new Error('could not find their stylesheets to follow');
	html = html.replace(lastStylesheet, match => `${match}
<link rel="stylesheet" href="style/velvet.css" />`);

	// Prefs and teams, without the cross-domain iframe that never answers.
	const storage = /<script src="\/\/play\.pokemonshowdown\.com\/js\/oldclient\/storage\.js[^"]*"><\/script>/;
	if (!storage.test(html)) throw new Error('could not find the storage script to follow');
	html = html.replace(storage, match => `${match}\n<script src="js/velvet-storage.js"></script>`);

	// Samantha, after the dex data she has to be added to.
	const teambuilderTables = /<script src="\/\/play\.pokemonshowdown\.com\/data\/teambuilder-tables\.js[^"]*"><\/script>/;
	if (!teambuilderTables.test(html)) throw new Error('could not find the teambuilder tables to follow');
	html = html.replace(teambuilderTables, match => `${match}\n<script src="js/velvet-data.js"></script>`);

	// What this server is, in the panel their news would have been in.
	html = html.replace(
		/<div class="pm-log" style="max-height:none">[\s\S]*?<\/div>\s*<\/div>/,
		`<div class="pm-log" style="max-height:none">
						<div class="newsentry"><h4>Custom Showdown Server</h4>
						<p>You are on a custom server. Everything works the way it does on
						Showdown, with a few additions of our own: a house bot with a ladder
						of its own, a damage calculator built in, and one Pok&eacute;mon that
						does not exist anywhere else.</p>
						<p>Accounts are real Pok&eacute;mon Showdown accounts, and you can play
						without one.</p></div>
					</div>
				</div>`
	);

	// Showdex and the service worker, last: both want the client to exist first.
	html += `
<!-- Ours, and only ours, below this line. -->
<script src="/showdex/main.js"></script>
<script>
	// Registering this is what lets a phone offer "Install app"; it caches
	// nothing (see service-worker.js).
	if ('serviceWorker' in navigator) {
		window.addEventListener('load', function () {
			navigator.serviceWorker.register('/service-worker.js').catch(function () {});
		});
	}
</script>
`;

	return html;
}

(async () => {
	let upstream;
	if (process.argv.includes('--offline')) {
		upstream = fs.readFileSync(CACHE, 'utf8');
		console.log('using the cached copy of their page');
	} else {
		upstream = await fetchPage(SOURCE);
		fs.writeFileSync(CACHE, upstream);
		console.log(`fetched ${SOURCE} (${Math.round(upstream.length / 1024)}KB)`);
	}

	const html = build(upstream);
	fs.writeFileSync(OUT, html);
	console.log(`wrote ${OUT} (${Math.round(html.length / 1024)}KB)`);

	// A page that has lost one of our own scripts is worse than no page.
	for (const needed of ['style/velvet.css', 'config/config.js', 'js/velvet-storage.js', 'js/velvet-data.js', '/showdex/main.js', 'manifest.json']) {
		if (!html.includes(needed)) throw new Error(`${needed} is missing from the built page`);
	}
	for (const banned of ['googletagmanager', 'hb.vntsm.com', 'window.__VM']) {
		if (html.includes(banned)) throw new Error(`${banned} survived into the built page`);
	}
	console.log('checked: our scripts are in, theirs are out');
})().catch(err => {
	console.error(err.message);
	process.exit(1);
});
