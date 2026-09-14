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

const fs = require('fs');
const os = require('os');
const path = require('path');
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
 * The damage calculator, at a name worth typing.
 *
 * It is a static page like the client (`client/calc.html`, built by
 * scripts/build-calc-page.js), so it is already served at /calc.html by
 * whatever serves the rest of the folder. `/calc` is what anybody would type,
 * and what fits in a sentence in the lobby.
 */
function calcRedirect(url) {
	if (url !== '/calc' && url !== '/calc/') return null;
	return '/calc.html';
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
<!-- The battle engine, loaded here rather than left to the replay player.
     It loads the engine itself, but only once it has parsed the log - and it
     draws the team preview immediately after, which is a race our own hooks
     lose about half the time. Loading it first means Samantha is known to
     the engine before anything is drawn. -->
<script src="${cdn}/js/battledata.js"></script>
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
		// The page is a shell around the log, and it names scripts by their build
		// stamp - so it has to be re-read, or a browser keeps an old shell pointing
		// at scripts that have moved on. The log itself is in the JSON, which does
		// get a long cache.
		res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
		res.end(replayPage(replay));
	}).catch(e => {
		log(`replay ${id}: ${e.message}`);
		if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
		res.end('That replay could not be read.');
	});
	return true;
}

/**
 * The ladder queues' own status.
 *
 * The bots live in the main process and the HTTP server lives in a socket
 * worker, so this reads the small file src/ladder.js leaves on the disk they
 * share rather than asking anything. It exists because this host offers no way
 * to read the logs from outside, which left "the queues are not running" as a
 * question with no answer that was not a guess.
 *
 * Nothing here is private: the queue names are the names people play against,
 * and the rest is a format, a boolean and an error string.
 */
const LADDER_STATUS = path.join(process.env.PS_CACHE_DIR || os.tmpdir(), 'velvet-ladder-status.json');

function serveLadderStatus(url, res) {
	if (url.split('?')[0] !== '/velvet/ladder.json') return false;
	let body;
	try {
		body = fs.readFileSync(LADDER_STATUS, 'utf8');
	} catch (e) {
		body = JSON.stringify({
			reason: 'no status file: the ladder has not started in this deploy',
			code: e.code,
			lookedIn: LADDER_STATUS,
		}, null, 1);
	}
	res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
	res.end(body);
	return true;
}

/**
 * How much room is left.
 *
 * This host gives the whole service 512MB and kills it without ceremony when it
 * goes over, which is why battles run in this process rather than their own and
 * why every subsystem that wants a child of its own has to argue for it. There
 * was no way to ask how close it was running except by waiting for it to die,
 * so decisions about what to switch on were being made on local numbers from a
 * different operating system.
 *
 * Nothing private: totals for this process, the ones the host would use to
 * decide whether to kill it, and how long it has been up.
 */
function serveHealth(url, res) {
	if (url.split('?')[0] !== '/velvet/health.json') return false;
	const mb = bytes => Math.round(bytes / 1024 / 1024 * 10) / 10;
	const memory = process.memoryUsage();
	/*
	 * What the host is actually counting.
	 *
	 * `process.memoryUsage()` describes this process, and this process is not
	 * what gets killed - the container is, and it holds the wrapper, the server
	 * and any child a subsystem was given. Linux keeps that total in the control
	 * group, which is the same number the 512MB limit is compared against, so
	 * where it exists it is the honest answer and everything above it is detail.
	 * It does not exist on a developer's Windows machine, hence the try.
	 */
	let container = null;
	try {
		const used = Number(fs.readFileSync('/sys/fs/cgroup/memory.current', 'utf8').trim());
		const limit = fs.readFileSync('/sys/fs/cgroup/memory.max', 'utf8').trim();
		container = {
			usedMB: mb(used),
			limitMB: limit === 'max' ? null : mb(Number(limit)),
		};
		if (container.limitMB) container.usedPercent = Math.round(container.usedMB / container.limitMB * 100);

		/*
		 * And the half of that total that actually decides anything.
		 *
		 * `memory.current` counts cached file pages as well as memory the
		 * processes are really holding, and the kernel drops that cache when it
		 * needs the room rather than killing anything. So a container sitting at
		 * 94% can be perfectly healthy or one battle from being killed, and the
		 * difference is entirely in this split: `anon` is the part that has
		 * nowhere to go.
		 *
		 * Reading the total alone is how a service gets declared full when it has
		 * a hundred megabytes of evictable cache in it.
		 */
		const stat = fs.readFileSync('/sys/fs/cgroup/memory.stat', 'utf8');
		const field = name => {
			const found = new RegExp(`^${name} (\\d+)$`, 'm').exec(stat);
			return found ? Number(found[1]) : null;
		};
		const anon = field('anon');
		const file = field('file');
		if (anon !== null) {
			container.anonMB = mb(anon);
			if (file !== null) container.cacheMB = mb(file);
			if (container.limitMB) container.anonPercent = Math.round(container.anonMB / container.limitMB * 100);
		}
	} catch (e) {
		// Not a Linux control group, so there is no container number to give.
	}
	/*
	 * The other process in here.
	 *
	 * This endpoint is served by the Showdown server, and the thing that started
	 * it - which carries the bot, the ladder queues and a second copy of the dex
	 * - is a different process with its own memory that nothing here can read.
	 * It writes a line about itself to the disk both of them share; this picks it
	 * up, with its age, because a stale number is worse than none.
	 */
	let wrapper = null;
	try {
		const raw = JSON.parse(fs.readFileSync(
			path.join(process.env.PS_CACHE_DIR || os.tmpdir(), 'velvet-wrapper.json'), 'utf8'));
		wrapper = {
			pid: raw.pid,
			rssMB: mb(raw.rss),
			heapUsedMB: mb(raw.heapUsed),
			heapTotalMB: mb(raw.heapTotal),
			uptimeSeconds: raw.uptimeSeconds,
			secondsOld: Math.round((Date.now() - new Date(raw.at).getTime()) / 1000),
		};
	} catch (e) {
		// It has not written one yet, or this is not that kind of deployment.
	}

	const body = {
		container,
		wrapper,
		uptimeSeconds: Math.round(process.uptime()),
		process: {
			rssMB: mb(memory.rss),
			heapUsedMB: mb(memory.heapUsed),
			heapTotalMB: mb(memory.heapTotal),
			externalMB: mb(memory.external),
		},
		host: {
			totalMB: mb(os.totalmem()),
			freeMB: mb(os.freemem()),
			cpus: os.cpus().length,
		},
		node: process.version,
		pid: process.pid,
	};
	res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
	res.end(JSON.stringify(body, null, 1));
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
			const moved = playRedirect(req.url) || calcRedirect(req.url) || dataRedirect(req.url);
			if (moved) {
				res.writeHead(302, { Location: moved, 'Cache-Control': 'no-store' });
				res.end();
				return true;
			}
			if (serveLadderStatus(req.url, res)) return true;
			if (serveHealth(req.url, res)) return true;
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
