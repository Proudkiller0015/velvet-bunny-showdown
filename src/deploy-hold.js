'use strict';
/**
 * Hold new battles while a deploy is pending.
 *
 * scripts/deploy.js used to check for live battles once, right before it fired
 * Render's hook - and a battle that started during the few minutes of building
 * was cut when the new build took over (the owner's game vs Bunny Stockfish,
 * 30 Sep 2026, turn 12). Now the script writes data/deploy-pending.json to the
 * repository first ({ at, until }), this process sees it within 30 seconds and
 * stops new battles from starting (Showdown's own lockdown, the "server is
 * restarting" message), and the script waits for the running ones to finish
 * before it fires the hook.
 *
 * Only a flag written after this process started counts, so the new build -
 * which boots after the flag - ignores it and battles work at once; no clearing
 * step to forget. `until` bounds it: a deploy that never happens cannot hold
 * battles forever. The repository is the authority because only the owner (and
 * this project's own pushes) can write to it; no new secret to keep.
 *
 * Showdown's lockdown normally kills the server when its last battle ends
 * (Config.autolockdown); that is turned off while held, or the old build would
 * restart itself before the deploy and reopen the window.
 */
const { REPO, BRANCH } = require('./repo-file');

const PATH = 'data/deploy-pending.json';
const BOOT = Date.now();
const EVERY_MS = 30 * 1000;
const state = { held: false, since: 0, until: 0 };

function apply(hold, flag) {
	if (typeof Rooms === 'undefined' || !Rooms.global) return;
	if (hold && !state.held) {
		if (typeof Config !== 'undefined') Config.autolockdown = false;
		Rooms.global.lockdown = true;
		state.held = true;
		state.since = Date.now();
	} else if (!hold && state.held) {
		Rooms.global.lockdown = false;
		state.held = false;
	}
	state.until = hold ? flag.until : 0;
}

async function check() {
	try {
		const headers = { 'User-Agent': 'velvet-bunny-showdown', Accept: 'application/vnd.github.raw' };
		if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN.trim()}`;
		const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}?ref=${BRANCH}`, { headers });
		let flag = {};
		if (res.ok) { try { flag = JSON.parse((await res.text()) || '{}') || {}; } catch (e) { flag = {}; } }
		else if (res.status !== 404) return; // a bad read changes nothing either way
		const hold = Number(flag.at) > BOOT && Date.now() < Number(flag.until || 0);
		apply(hold, flag);
	} catch (e) { /* offline: leave things as they are */ }
}

function start() {
	if (global.velvetDeployHold) return;
	global.velvetDeployHold = setInterval(check, EVERY_MS);
	if (global.velvetDeployHold.unref) global.velvetDeployHold.unref();
	check();
}

module.exports = { start, state, PATH, check };
