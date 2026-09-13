'use strict';
/**
 * Start a deploy on Render, and wait for it to actually be live.
 *
 * Pushing to GitHub is enough on its own - Render notices and deploys - but it
 * notices in its own time, which on the free plan has been most of an hour.
 * The deploy hook skips the waiting: it is a single URL that can do exactly one
 * thing, deploy this one service.
 *
 * The URL contains a key, so it is not in this repository. It lives in
 * ../.secrets/render-deploy-hook, outside the repo entirely rather than merely
 * gitignored, or in RENDER_DEPLOY_HOOK.
 *
 * Waiting is the point of the rest of the file. A build takes minutes, and
 * "deploy started" says nothing about whether the thing that boots is the code
 * you meant - so this watches for the server actually being replaced. The mark
 * it watches is the root page's last-modified time: scripts/setup-config.js
 * rewrites that file on every boot, so it moves once the new build is serving,
 * whatever the change happened to be.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const HOOK_FILE = process.env.RENDER_DEPLOY_HOOK_FILE ||
	path.join(__dirname, '..', '..', '.secrets', 'render-deploy-hook');
const SITE = process.env.PS_PUBLIC_URL || 'https://velvet-bunny-showdown.onrender.com';
const TIMEOUT_MS = Number(process.env.DEPLOY_TIMEOUT_MS || 15 * 60 * 1000);

function readHook() {
	if (process.env.RENDER_DEPLOY_HOOK) return process.env.RENDER_DEPLOY_HOOK.trim();
	try {
		return fs.readFileSync(HOOK_FILE, 'utf8').trim();
	} catch (e) {
		throw new Error(
			`no deploy hook. Put the URL from Render (service -> Settings -> Deploy Hook) in\n` +
			`  ${HOOK_FILE}\n` +
			`or set RENDER_DEPLOY_HOOK. It is a secret: keep it out of the repo.`
		);
	}
}

function get(url, method = 'GET') {
	return new Promise((resolve, reject) => {
		const req = https.request(url, { method }, res => {
			let body = '';
			res.on('data', c => body += c);
			res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
		});
		req.on('error', reject);
		req.end();
	});
}

/**
 * Who is on the server right now.
 *
 * A deploy restarts the server, and a restart drops every connection - which
 * is what "the site crashed" used to mean here. So look before deploying: join
 * the lobby the way a client does and read the user list it sends back. The bot
 * and its ladder queues do not count; they reconnect on their own.
 */
function playersOnline() {
	const WebSocket = require('ws');
	const url = SITE.replace(/^http/, 'ws') + '/showdown/websocket';
	return new Promise(resolve => {
		const ws = new WebSocket(url);
		const done = names => { try { ws.close(); } catch (e) {} resolve(names); };
		// Never let a stuck socket stop a deploy; assume an empty server.
		const timer = setTimeout(() => done([]), 20000);
		ws.on('open', () => ws.send('|/join lobby'));
		ws.on('error', () => { clearTimeout(timer); done([]); });
		ws.on('message', raw => {
			for (const line of raw.toString().split('\n')) {
				if (!line.startsWith('|users|')) continue;
				clearTimeout(timer);
				const names = line.slice('|users|'.length).split(',').slice(1)
					.map(entry => entry.slice(1).trim())
					.filter(name => name && !/^(velvet ?bunny|bunny )/i.test(name) && !/^Guest \d+$/.test(name));
				done(names);
			}
		});
	});
}

const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
	const force = process.argv.includes('--force');
	const players = await playersOnline();
	if (players.length && !force) {
		console.error(
			`[deploy] ${players.length} player(s) on the server right now: ${players.join(', ')}.
` +
			`A deploy restarts it and drops them, mid-battle included. Wait, or pass --force.`
		);
		process.exit(1);
	}
	if (players.length) console.log(`[deploy] --force, dropping ${players.join(', ')}`);

	const before = await get(SITE).catch(() => ({ headers: {} }));
	const mark = before.headers['last-modified'] || '';
	console.log(`[deploy] currently serving a build from ${mark || 'an unknown time'}`);

	const res = await get(readHook(), 'POST');
	if (res.status >= 300) throw new Error(`Render refused the deploy hook: ${res.status} ${res.body.slice(0, 200)}`);
	let id = '';
	try { id = JSON.parse(res.body).deploy?.id || ''; } catch (e) { /* not JSON; the status is what matters */ }
	console.log(`[deploy] started${id ? ` (${id})` : ''}; waiting for it to go live`);

	const deadline = Date.now() + TIMEOUT_MS;
	while (Date.now() < deadline) {
		await wait(15000);
		const now = await get(SITE).catch(() => null);
		const stamp = now && now.headers['last-modified'];
		if (stamp && stamp !== mark) {
			console.log(`[deploy] live: the server now serves a build from ${stamp}`);
			return;
		}
		process.stdout.write('.');
	}
	throw new Error(`\nstill serving the old build after ${Math.round(TIMEOUT_MS / 60000)} minutes`);
})().catch(err => {
	console.error(`[deploy] ${err.message}`);
	process.exit(1);
});
