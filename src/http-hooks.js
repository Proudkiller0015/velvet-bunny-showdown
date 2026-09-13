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
			const moved = playRedirect(req.url);
			if (moved) {
				res.writeHead(302, { Location: moved, 'Cache-Control': 'no-store' });
				res.end();
				return true;
			}
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
