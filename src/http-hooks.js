'use strict';
/**
 * Two things this server answers itself, before Showdown's web server sees
 * them: the login request, and the old /play/ address.
 *
 * ## Borrowing Showdown's login server instead of running one.
 *
 * Accounts on this server are real Pokemon Showdown accounts. Nothing is
 * registered with Smogon and no account database lives here - the official
 * login server does the proving, and this server checks its work:
 *
 *   - the client asks the login server for an assertion, passing the challstr
 *     *this* server issued
 *   - the login server signs it, binding the challstr to a userid
 *   - this server verifies that signature against Showdown's public key, which
 *     ships in Showdown's own config
 *
 * An assertion is therefore worth nothing anywhere else: it names one account
 * and one challstr, and challstrs are issued per connection. The hostname baked
 * into it is only checked when `legalhosts` is configured, which it is not - so
 * an assertion issued under any server id is good here. Unregistered names get
 * an assertion too, marked user type 1, which is how someone can pick a name
 * without an account and still be seen as unregistered.
 *
 * On the psim.us address none of this file runs: that client is served by
 * Showdown, so it asks its own origin and passwords never come near this
 * server. This file exists for the client served from our own domain, which is
 * the one with the bot panel and Samantha in it. Showdown's crossdomain
 * handshake returns nothing for our hostname and their login server sends no
 * CORS headers, so a browser on our domain cannot reach them directly - the
 * request has to be forwarded, and forwarding it means a password typed on our
 * domain passes through this process on its way to Showdown. It is not stored
 * or logged, but it does pass through, and that is the cost of serving our own
 * client.
 */

const https = require('https');

/** Built on first use: the web worker serves replays, it does not save them. */
let replayStore = null;

const UPSTREAM_HOST = 'play.pokemonshowdown.com';
// Showdown's own id. What comes back is bound to our challstr either way, and
// the id inside the assertion is not checked unless `legalhosts` says to.
const UPSTREAM_PATH = '/~~showdown/action.php';
// A login request is a few hundred bytes; anything larger is not one.
const MAX_BODY = 64 * 1024;

/** The one path the login server answers, however the client spells the id. */
function isLoginRequest(url) {
	if (!url) return false;
	const path = url.split('?')[0];
	return /^\/~~[A-Za-z0-9_-]*\/action\.php$/.test(path) || path === '/action.php';
}

/** Send one request on to Showdown and hand their answer straight back. */
function relay(req, res, log) {
	const chunks = [];
	let size = 0;
	req.on('data', chunk => {
		size += chunk.length;
		if (size > MAX_BODY) {
			req.destroy();
			return;
		}
		chunks.push(chunk);
	});
	req.on('error', () => { /* the client hung up; nothing to answer */ });
	req.on('end', () => {
		const body = Buffer.concat(chunks);
		const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
		const headers = {
			'Content-Type': req.headers['content-type'] || 'application/x-www-form-urlencoded',
			'Content-Length': body.length,
			'User-Agent': req.headers['user-agent'] || 'velvet-bunny-showdown',
			'Accept': req.headers.accept || '*/*',
		};
		// The session cookie, so that staying logged in works the way it does on
		// the official client. It is Showdown's cookie for Showdown's login
		// server; it is passed along untouched and read by nobody here.
		if (req.headers.cookie) headers.Cookie = req.headers.cookie;

		const upstream = https.request({
			host: UPSTREAM_HOST,
			path: UPSTREAM_PATH + query,
			method: req.method === 'GET' ? 'GET' : 'POST',
			headers,
		}, upstreamRes => {
			const out = { ...upstreamRes.headers };
			// The cookie comes back scoped to their domain, which a browser on ours
			// would drop. Without the scope it belongs to whatever host served it,
			// which is this one, and comes back here to be forwarded again.
			if (out['set-cookie']) {
				out['set-cookie'] = [].concat(out['set-cookie']).map(
					cookie => cookie.replace(/;\s*domain=[^;]*/i, '')
				);
			}
			delete out['content-security-policy'];
			res.writeHead(upstreamRes.statusCode || 502, out);
			upstreamRes.pipe(res);
		});
		upstream.on('error', e => {
			log(`login server unreachable: ${e.message}`);
			if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
			res.end('');
		});
		upstream.end(body);
	});
}

/**
 * Where the client used to live.
 *
 * It was served at /play/ while the root belonged to Showdown's redirect. It
 * is the root itself now - it has to be, because the client reads the room out
 * of the path and writes it back the same way, so every link it made under
 * /play/ pointed at the root regardless. Old links and bookmarks still work:
 * they are sent to the same path one level up. 302 rather than 301, so nothing
 * is cached into a browser that we cannot take back.
 */
function playRedirect(url) {
	if (!url.startsWith('/play')) return null;
	const rest = url.slice('/play'.length);
	if (rest && !rest.startsWith('/') && !rest.startsWith('?')) return null;
	return rest.startsWith('?') ? `/${rest}` : (rest || '/');
}

/**
 * Dex data the client asks us for, which was never ours to serve.
 *
 * The client is configured to skip Showdown's cross-domain handshake - it
 * returns an empty page for our hostname and the client waits on it forever -
 * and one consequence is that it looks for `data/text/<lang>.js` relative to
 * wherever it is served from. That file is where every move and ability
 * description lives, so when this server answered for it (it does not have it)
 * the whole client came up with no descriptions at all.
 *
 * Sending it to their CDN is both the fix and the right answer: the dex data is
 * theirs, it changes every time they patch a move, and a copy kept here would
 * be wrong within a week. Only /data/ is forwarded - /sprites/ is ours, and
 * hers live in it.
 */
function dataRedirect(url) {
	if (!url.startsWith('/data/')) return null;
	return 'https://' + UPSTREAM_HOST + url;
}

/**
 * Let the page itself go stale for an hour and nothing else matters.
 *
 * Showdown's static server stamps everything `max-age=3600`, which is right
 * for the files it was written for - sprites and dex data that never change
 * under the same name. Our client's page is not one of those: it names the
 * scripts it loads, with a build stamp on each, so a browser holding an hour-old
 * copy of the page keeps loading an hour-old client and a deploy appears to do
 * nothing. Revalidating the page costs one request and fixes that; everything
 * it points at keeps the long cache it deserves.
 */
function isPage(url) {
	const path = url.split('?')[0];
	if (path === '/' || path === '/index.html') return true;
	// A client route (/ladder, /teambuilder, /battle-gen9ou-1) - anything the
	// static server will answer with index.html because it is not a file.
	return !path.slice(1).includes('.');
}

/** Make one response revalidate, whatever headers the static server picks. */
function revalidate(res) {
	const writeHead = res.writeHead;
	res.writeHead = function (status, reason, headers) {
		const given = typeof reason === 'object' && reason ? reason : headers;
		if (given) given['cache-control'] = 'no-cache';
		else this.setHeader('Cache-Control', 'no-cache');
		return writeHead.apply(this, arguments);
	};
}

/**
 * A replay, as a page.
 *
 * Showdown's own replay page is a preact app with a search index and an
 * archive behind it, none of which applies to one server's worth of replays.
 * This is the other thing they ship: the embed, which is what a downloaded
 * replay file uses. It takes a log in a script tag and plays it, loading the
 * battle engine and sprites it needs by itself.
 *
 * Samantha's data goes in alongside it for the same reason it goes into the
 * client: the engine draws a question mark for anything it has never heard of,
 * and a replay of her battle is exactly where she has to be recognisable.
 */
/**
 * The same build stamp the client's own page carries.
 *
 * Our scripts are served with a long cache lifetime, which is right for files
 * whose name changes when they do - and these do not, so the name is given a
 * query that changes with the deploy. Without it a replay page keeps running
 * whichever copy of velvet-data.js the browser happened to fetch first, which
 * is exactly how Samantha stayed a broken image in replays after the fix.
 */
function buildStamp() {
	return (process.env.RENDER_GIT_COMMIT || '').slice(0, 8) || process.env.PS_BUILD_STAMP || 'dev';
}

function replayPage(replay) {
	const escape = text => String(text || '')
		.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	const players = (replay.players || []).map(escape);
	const title = players.length ? `${players.join(' vs. ')}` : 'Replay';
	const cdn = 'https://play.pokemonshowdown.com';
	const stamp = buildStamp();

	return `<!DOCTYPE html>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width" />
<title>${title} - ${escape(replay.format)} replay</title>
<link rel="stylesheet" href="${cdn}/style/font-awesome.css" />
<link rel="stylesheet" href="${cdn}/style/battle.css" />
<link rel="stylesheet" href="${cdn}/style/replay.css" />
<link rel="stylesheet" href="${cdn}/style/utilichart.css" />
<script src="/config/config.js?${stamp}"></script>
<script src="${cdn}/js/lib/jquery-1.11.0.min.js"></script>
<!-- The dex itself. The replay player fetches a cut-down copy of it for
     sprites, but not the tables Samantha has to be added to - without these
     she is a question mark with no typing and no moves. -->
<script src="${cdn}/data/pokedex.js"></script>
<script src="${cdn}/data/moves.js"></script>
<script src="${cdn}/data/abilities.js"></script>
<script src="${cdn}/data/items.js"></script>
<script src="/js/velvet-data.js?${stamp}"></script>
<div class="wrapper replay-wrapper">
<div class="battle"></div><div class="battle-log"></div><div class="replay-controls"></div><div class="replay-controls-2"></div>
</div>
<script type="text/plain" class="battle-log-data">${String(replay.log || '').replace(/<\/script/gi, '<\/script')}</script>
<script src="/js/replay-embed.js?${stamp}"></script>
`;
}

/**
 * `/replay/<id>` and `/replay/<id>.json`.
 *
 * Asynchronous because a replay this instance did not save has to be fetched
 * back out of the repository - which is the normal case after a restart, since
 * everything else here is wiped.
 */
function serveReplay(url, res, log) {
	const path = url.split('?')[0];
	const match = /^\/replay\/([A-Za-z0-9_-]+)(\.json)?$/.exec(path);
	if (!match) return false;

	const [, id, asJson] = match;
	const { ReplayStore } = require('./replay-store');
	const store = replayStore || (replayStore = new ReplayStore(log));

	void store.get(id).then(replay => {
		if (!replay) {
			res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
			res.end('<!DOCTYPE html><meta charset="utf-8" /><title>No such replay</title>' +
				'<p>No replay by that name. It may never have been saved, or it may have been removed.</p>');
			return;
		}
		if (asJson) {
			res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'max-age=600' });
			res.end(JSON.stringify(replay));
			return;
		}
		res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'max-age=600' });
		res.end(replayPage(replay));
	}).catch(e => {
		log(`replay ${id}: ${e.message}`);
		if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
		res.end('That replay could not be read.');
	});
	return true;
}

/**
 * Answer that one path before Showdown's own web server sees it.
 *
 * Showdown serves HTTP from a worker process, and its request handler is wired
 * up out of reach of config. Intercepting at `emit` rather than adding another
 * listener is what makes this reliable: a listener would run alongside theirs,
 * and both would try to answer the same request. Stopping the event instead
 * means the request never reaches them at all, and everything that is not this
 * one path is passed on untouched.
 *
 * It also has to sit in front, not behind: a body can only be read once, and
 * their handler discards it before config would ever get a look in.
 */
function hookServer(server, log) {
	if (server.velvetHttpHooks) return;
	server.velvetHttpHooks = true;
	const emit = server.emit;
	server.emit = function (event, ...args) {
		if (event === 'request' && args[0] && args[0].url) {
			const [req, res] = args;
			if (isLoginRequest(req.url)) {
				relay(req, res, log);
				return true;
			}
			const moved = playRedirect(req.url) || dataRedirect(req.url);
			if (moved) {
				res.writeHead(302, { Location: moved, 'Cache-Control': 'no-store' });
				res.end();
				return true;
			}
			if (serveReplay(req.url, res, log)) return true;

			if (isPage(req.url)) revalidate(res);
		}
		return emit.apply(this, [event, ...args]);
	};
}

/**
 * Hook every HTTP server this process goes on to create.
 *
 * Config is loaded in each of Showdown's processes, including the one that
 * serves HTTP, but it is loaded before that server exists - so the hook is on
 * the constructor rather than on a server we could be handed.
 */
function installHttpHooks(log = () => {}) {
	const http = require('http');
	if (http.velvetHttpHooks) return;
	http.velvetHttpHooks = true;
	const createServer = http.createServer;
	http.createServer = function (...args) {
		const server = createServer.apply(this, args);
		hookServer(server, log);
		return server;
	};
}

module.exports = { installHttpHooks, isLoginRequest, UPSTREAM_HOST, UPSTREAM_PATH };
