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

/*
 * The deploy hold's flag (src/deploy-hold.js reads it from the repository). Only a flag
 * newer than the running server counts, so the new build ignores it and needs no clearing;
 * {} releases the hold when a deploy is abandoned.
 */
const HOLD_MS = Number(process.env.DEPLOY_HOLD_MS || 25 * 60 * 1000);
function writeFlag(flag) {
	const { execSync } = require('child_process');
	const root = path.join(__dirname, '..');
	fs.writeFileSync(path.join(root, 'data', 'deploy-pending.json'), JSON.stringify(flag) + '\n');
	const run = cmd => execSync(cmd, { cwd: root, stdio: 'pipe' });
	run('git add data/deploy-pending.json');
	try { run(`git commit -q -m "deploy hold: ${flag.at ? 'pending' : 'released'}"`); } catch (e) { /* nothing changed */ }
	run('git pull -q --rebase --autostash');
	run('git push -q');
}

(async () => {
	const force = process.argv.includes('--force');
	/*
	 * The owner's own accounts never hold a deploy up: the owner is the one asking
	 * for it, and kept having to say so twice. Everyone else still does.
	 */
	const OWNER = new Set(['slimequeensamantha', 'unseenface']);
	const everyone = await playersOnline();
	const owner = everyone.filter(name => OWNER.has(name.toLowerCase().replace(/[^a-z0-9]/g, '')));
	const players = everyone.filter(name => !owner.includes(name));
	if (owner.length) console.log(`[deploy] owner online (${owner.join(', ')}): not waiting for them`);
	if (players.length && !force) {
		console.error(
			`[deploy] ${players.length} player(s) on the server right now: ${players.join(', ')}.
` +
			`A deploy restarts it and drops them, mid-battle included. Wait, or pass --force.`
		);
		process.exit(1);
	}
	if (players.length) console.log(`[deploy] --force, dropping ${players.join(', ')}`);

	/*
	 * And no battle in progress, anyone's - the owner's included. The owner's
	 * account not holding a deploy up still cut two of their games in one evening,
	 * because being online and being mid-battle are different things. The server
	 * counts its unfinished battles on the health page; read that right before the
	 * hook fires. (An older server without the count reports nothing and passes.)
	 */
	const readHealth = async () => {
		const h = await get(SITE + '/velvet/health.json').catch(() => null);
		try { return JSON.parse(h.body) || {}; } catch (e) { return {}; }
	};
	let health = await readHealth();
	const running = () => health.battles || [];
	const describe = list => list.map(b => `${b.players.join(' vs ')} (${b.format}, turn ${b.turn})`).join('; ');
	if (!force && health.deployHold !== undefined) {
		/*
		 * Hold new battles, then wait for the running ones (src/deploy-hold.js). Checking
		 * once and firing cut a battle that started during the build (30 Sep 2026).
		 */
		writeFlag({ at: Date.now(), until: Date.now() + HOLD_MS });
		console.log('[deploy] asked the server to hold new battles');
		const asked = Date.now();
		while (!(health.deployHold && health.deployHold.held) && Date.now() - asked < 3 * 60 * 1000) { await wait(15000); health = await readHealth(); }
		if (!(health.deployHold && health.deployHold.held)) {
			writeFlag({});
			console.error('[deploy] the server never confirmed the hold; nothing deployed');
			process.exit(1);
		}
		console.log('[deploy] new battles are held');
		const deadline = asked + HOLD_MS - 2 * 60 * 1000;
		while (running().length && Date.now() < deadline) {
			console.log(`[deploy] waiting for ${running().length} battle(s) to finish: ${describe(running())}`);
			await wait(20000);
			health = await readHealth();
		}
		if (running().length) {
			writeFlag({});
			console.error(`[deploy] still ${running().length} battle(s) in progress after the hold: ${describe(running())}. Hold released; try again later.`);
			process.exit(1);
		}
	} else if (running().length && !force) {
		// An older server without the hold: the old rule, refuse.
		console.error(`[deploy] ${running().length} battle(s) in progress: ${describe(running())}.
A deploy would end them. Wait, or pass --force.`);
		process.exit(1);
	}

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
