'use strict';
/**
 * Ratings are saved soon after a game changes the ladder file, not only on
 * the five-minute timer (24 Sep 2026). A fake backend; no network.
 *
 *   node test/ladder-store-save.test.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { LadderStore } = require('../src/ladder-store');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'velvet-ladder-store-test-'));
const writes = [];
const store = new LadderStore(dir, () => {});
store.backend = { write: async (file, body) => { writes.push([file, body]); } };
store.ready = true;
store.start(3600000);   // the timer out of the way; the watch is what is tested
// Re-watched with a short debounce, so the test takes a second rather than thirty.
store.watcher.close();
store.watcher = null;
store.watch(200);

fs.writeFileSync(path.join(dir, 'gen9ou.tsv'), 'userid\telo\nalice\t1030\n');
setTimeout(() => fs.appendFileSync(path.join(dir, 'gen9ou.tsv'), 'bob\t1010\n'), 50);

setTimeout(async () => {
	const ok = writes.length === 1 && writes[0][0] === 'gen9ou.tsv' && writes[0][1].includes('bob');
	console.log(`${ok ? 'ok  ' : 'FAIL'} a change to the ladder is saved once, shortly after (${writes.length} write(s))`);
	await store.stop();
	fs.rmSync(dir, { recursive: true, force: true });
	process.exit(ok ? 0 : 1);
}, 1500);
