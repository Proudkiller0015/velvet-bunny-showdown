'use strict';
/**
 * The battle log never overwrites a month it could not read (24 Sep 2026).
 *
 * Past 1MB GitHub's contents API returns the file's metadata with an empty
 * `content`. The store used to take that for an empty log and write the header
 * plus one batch over the whole month. fetch is faked here; nothing leaves the
 * machine.
 *
 *   node test/battle-log-store.test.js
 */

const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs');

const spool = fs.mkdtempSync(path.join(os.tmpdir(), 'velvet-battle-log-test-'));
process.env.BATTLE_LOG_SPOOL = spool;
process.env.GITHUB_TOKEN = 'test-token';
const { BattleLogStore } = require('../src/battle-log-store');

const BIG = 'when\tformat\tplayers\tresult\tbattle\n' + 'old line\n'.repeat(3);

function fakeGithub({ rawOk = true, rawBody = BIG }) {
	const puts = [];
	global.fetch = async (url, opts = {}) => {
		const accept = opts.headers && opts.headers.Accept;
		if (opts.method === 'PUT') {
			puts.push(Buffer.from(JSON.parse(opts.body).content, 'base64').toString('utf8'));
			return { ok: true, status: 200, json: async () => ({ content: { sha: 'new' } }) };
		}
		if (accept === 'application/vnd.github.raw') {
			return { ok: rawOk, status: rawOk ? 200 : 500, text: async () => rawBody };
		}
		// What the API gives for a file over 1MB: metadata, no content.
		return { ok: true, status: 200, json: async () => ({ sha: 'old', size: Buffer.byteLength(BIG), content: '', encoding: 'none' }) };
	};
	return puts;
}

(async () => {
	let failed = 0;
	const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

	let puts = fakeGithub({});
	let store = new BattleLogStore(() => {});
	store.pending = ['new line'];
	await store.flush();
	check(puts.length === 1 && puts[0] === BIG + 'new line\n', 'a log too big to inline is read raw and appended to');

	puts = fakeGithub({ rawOk: false });
	store = new BattleLogStore(() => {});
	store.pending = ['new line'];
	await store.flush();
	check(puts.length === 0 && store.pending.length === 1, 'if it cannot be read, nothing is written and the line is kept');

	puts = fakeGithub({ rawBody: 'when\n' });
	store = new BattleLogStore(() => {});
	store.pending = ['new line'];
	await store.flush();
	check(puts.length === 0 && store.pending.length === 1, 'a short read is refused too');

	fs.rmSync(spool, { recursive: true, force: true });
	console.log(failed ? `\n${failed} failed` : '\nall passed');
	process.exit(failed ? 1 : 0);
})();
