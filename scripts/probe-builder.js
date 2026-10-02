'use strict';
/**
 * Ask the real teambuilder a question, in headless Chrome, against a local server.
 *
 *   PORT=8123 node src/index.js            (in another shell)
 *   node scripts/probe-builder.js "<js expression>" [url=http://localhost:8123/teambuilder]
 *
 * The expression runs in the page once the client's data has loaded and its value is
 * printed as JSON. For checking that a new Pokemon is searchable, tiered and drawn
 * (see .claude/skills/custom-pokemon): the extension's browser cannot open localhost.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');

const EXPR = process.argv[2] || 'document.title';
const URL_ = process.argv[3] || 'http://localhost:8123/teambuilder';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
	.find(f => fs.existsSync(f));
const PORT = 9333 + Math.floor(Math.random() * 500);
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
	if (!CHROME) throw new Error('Chrome not found');
	const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-'));
	const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--window-size=1400,900', 'about:blank'], { stdio: 'ignore' });
	try {
		let target = null;
		for (let i = 0; i < 40 && !target; i++) {
			await wait(250);
			try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find(t => t.type === 'page'); } catch (e) { /* not up yet */ }
		}
		if (!target) throw new Error('Chrome did not start');
		const ws = new WebSocket(target.webSocketDebuggerUrl);
		await new Promise(r => ws.once('open', r));
		let id = 0;
		const pending = new Map();
		ws.on('message', raw => { const m = JSON.parse(raw); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
		const send = (method, params = {}) => new Promise(r => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
		const evaluate = async expression => {
			const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
			if (r.result && r.result.exceptionDetails) return { error: r.result.exceptionDetails.exception ? r.result.exceptionDetails.exception.description : r.result.exceptionDetails.text };
			return r.result && r.result.result ? r.result.result.value : undefined;
		};
		await send('Page.enable');
		await send('Page.navigate', { url: URL_ });
		for (let i = 0; i < 80; i++) {
			await wait(500);
			if (await evaluate('!!(window.BattleTeambuilderTable && window.DexSearch && window.BattlePokedex && window.VelvetBuffs)') === true) break;
		}
		await wait(1500);
		console.log(JSON.stringify(await evaluate(EXPR), null, 1));
		ws.close();
	} finally {
		chrome.kill();
		await wait(300);
		try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* still locked: the OS clears temp */ }
	}
})().catch(e => { console.error(e.message); process.exit(1); });
