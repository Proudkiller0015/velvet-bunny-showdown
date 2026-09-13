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

const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
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
