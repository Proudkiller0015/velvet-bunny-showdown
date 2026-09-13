'use strict';
/**
 * Every battle, written down where it will still be there tomorrow.
 *
 * The lobby announces battles as they start, but a chat room is a scrollback:
 * the oldest lines fall off the end, and a restart takes the whole room with
 * it. Showdown's own battle logs go to a folder inside the package, which this
 * host wipes on every deploy.
 *
 * So the same trick as the replays and the ladder: one file per month in this
 * project's own repository, a line per battle, appended in batches. Batched
 * because a commit per battle would be one API call per battle and a repository
 * history nobody can read - a minute's worth at a time is plenty for something
 * nobody reads in real time (the logs room is for that).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = process.env.GITHUB_REPO || 'Proudkiller0015/velvet-bunny-showdown';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const DIR = process.env.BATTLE_LOG_REPO_DIR || 'data/battle-log';
const FLUSH_AFTER_MS = Number(process.env.BATTLE_LOG_FLUSH_MS || 60 * 1000);
const FLUSH_AFTER_LINES = Number(process.env.BATTLE_LOG_FLUSH_LINES || 25);
// Survives a crash between flushes, and lets a restart pick up where it left off.
const SPOOL = process.env.BATTLE_LOG_SPOOL ||
	path.join(process.env.PS_CACHE_DIR || os.tmpdir(), 'velvet-battle-log');

const HEADER = ['when', 'format', 'players', 'result', 'battle'].join('\t');

function readToken() {
	if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
	try {
		return fs.readFileSync(path.join(__dirname, '..', '..', '.secrets', 'github-token'), 'utf8').trim();
	} catch (e) {
		return '';
	}
}

class BattleLogStore {
	constructor(log = () => {}) {
		this.log = log;
		this.token = readToken();
		this.pending = [];
		this.timer = null;
		this.flushing = false;
		this.sha = new Map();   // month -> blob sha, needed to append to a file
	}

	get enabled() { return !!this.token; }

	headers() {
		return {
			'Authorization': `Bearer ${this.token}`,
			'Accept': 'application/vnd.github+json',
			'User-Agent': 'velvet-bunny-showdown',
		};
	}

	/** One line. Tabs are stripped rather than escaped: nothing here needs them. */
	record(entry) {
		const clean = value => String(value == null ? '' : value).replace(/[\t\r\n]+/g, ' ').trim();
		const line = [
			new Date().toISOString(),
			clean(entry.format),
			clean((entry.players || []).join(' vs ')),
			clean(entry.result),
			clean(entry.battle),
		].join('\t');

		this.pending.push(line);
		try {
			fs.mkdirSync(SPOOL, { recursive: true });
			fs.appendFileSync(path.join(SPOOL, `${this.month()}.tsv`), line + '\n');
		} catch (e) {
			// The spool is a convenience; the pending list is the real queue.
		}

		if (this.pending.length >= FLUSH_AFTER_LINES) {
			void this.flush();
		} else if (!this.timer) {
			this.timer = setTimeout(() => void this.flush(), FLUSH_AFTER_MS);
			if (this.timer.unref) this.timer.unref();
		}
	}

	month() {
		return new Date().toISOString().slice(0, 7);
	}

	async flush() {
		clearTimeout(this.timer);
		this.timer = null;
		if (this.flushing || !this.pending.length) return;
		if (!this.enabled) {
			// Nothing is lost that was not already going to be lost: the lines are
			// on disk, and the room has them. Say so once rather than every minute.
			if (!this.warned) {
				this.warned = true;
				this.log('no GITHUB_TOKEN, so battles are only logged in the room and on this disk');
			}
			this.pending = [];
			return;
		}

		this.flushing = true;
		const lines = this.pending;
		this.pending = [];
		const month = this.month();
		const url = `https://api.github.com/repos/${REPO}/contents/${DIR}/${month}.tsv`;

		try {
			// Read what is there, because the API has no append - a write is always
			// the whole file plus the sha of the version being replaced.
			let existing = '';
			let sha = this.sha.get(month);
			const current = await fetch(`${url}?ref=${BRANCH}`, { headers: this.headers() });
			if (current.ok) {
				const data = await current.json();
				sha = data.sha;
				existing = Buffer.from(data.content || '', 'base64').toString('utf8');
			} else if (current.status !== 404) {
				throw new Error(`reading the log returned ${current.status}`);
			}

			const body = (existing || HEADER + '\n') + lines.join('\n') + '\n';
			const payload = {
				message: `Battle log: ${lines.length} battle${lines.length === 1 ? '' : 's'}`,
				content: Buffer.from(body, 'utf8').toString('base64'),
				branch: BRANCH,
			};
			if (sha) payload.sha = sha;

			const res = await fetch(url, { method: 'PUT', headers: this.headers(), body: JSON.stringify(payload) });
			if (!res.ok) throw new Error(`writing the log returned ${res.status}`);
			const written = await res.json();
			if (written.content?.sha) this.sha.set(month, written.content.sha);
		} catch (e) {
			// Put them back: the next flush tries again rather than losing them.
			this.pending = lines.concat(this.pending);
			this.log(`could not write the battle log: ${e.message}`);
		} finally {
			this.flushing = false;
		}
	}
}

module.exports = { BattleLogStore, REPO, BRANCH, DIR };
