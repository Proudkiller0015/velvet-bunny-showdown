'use strict';
/**
 * Keep the friends list across restarts.
 *
 * Showdown stores friendships in a SQLite database inside its own package, on
 * the same disk this host throws away every time the service restarts - and the
 * free tier restarts whenever it has been idle a quarter of an hour. Without
 * this, a friend request accepted in the evening is gone by morning, which is
 * worse than not having the feature: the server would be quietly forgetting
 * something it told two people it had remembered.
 *
 * Same answer as the ladder and the replays: keep it in the repository. It is
 * one small file, it changes rarely - only when somebody adds or removes a
 * friend - and a commit history of it is a perfectly good audit trail.
 *
 * Unlike those two this is a binary, so there is no merging and no reading it
 * in a diff. That is a fair trade for not having to know Showdown's schema:
 * this file survives them changing it, which a table-by-table export would not.
 *
 * With no token configured it no-ops and the server behaves as it did before -
 * friends work until the next restart, which is what happens on a local run.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = process.env.GITHUB_REPO || 'Proudkiller0015/velvet-bunny-showdown';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const DIR = process.env.FRIENDS_REPO_DIR || 'data/friends';
const FILE = 'friends.db';

/** The token, from the environment or from a file kept outside the repo. */
function readToken() {
	if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
	const local = path.join(__dirname, '..', '..', '.secrets', 'github-token');
	try {
		return fs.readFileSync(local, 'utf8').trim();
	} catch (e) {
		return '';
	}
}

class FriendsStore {
	/**
	 * @param {string} dbPath the database file Showdown will open
	 * @param {(msg: string) => void} log
	 */
	constructor(dbPath, log = () => {}) {
		this.path = dbPath;
		this.log = log;
		this.token = readToken();
		this.sha = '';          // blob sha, needed to overwrite the file
		this.lastHash = '';     // what was last committed, so an idle hour costs nothing
		this.timer = null;
	}

	get enabled() { return !!this.token; }

	headers() {
		return {
			'Authorization': `Bearer ${this.token}`,
			'Accept': 'application/vnd.github+json',
			'User-Agent': 'velvet-bunny-showdown',
		};
	}

	/**
	 * Put the saved database back before Showdown opens it.
	 *
	 * Only when there is not one already: a file on disk is either this boot's
	 * work or a leftover from a restart that kept the disk, and either way it is
	 * newer than the commit. Overwriting it would be the one way this could lose
	 * data rather than keep it.
	 */
	async restore() {
		if (!this.enabled) {
			this.log('no GITHUB_TOKEN, so friendships last until the next restart');
			return false;
		}
		if (fs.existsSync(this.path) && fs.statSync(this.path).size > 0) {
			this.lastHash = this.hashOf(fs.readFileSync(this.path));
			this.log('a database is already here; leaving it alone');
			return false;
		}

		// Raw rather than the API: no envelope to unwrap, and the repository is
		// public so the token is not needed for reading.
		const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${DIR}/${FILE}`;
		try {
			const res = await fetch(url, { headers: { 'User-Agent': 'velvet-bunny-showdown' } });
			if (!res.ok) {
				// A 404 is the ordinary first run, not a failure.
				this.log(res.status === 404 ? 'nothing saved yet; starting fresh' : `could not read the saved database: ${res.status}`);
				return false;
			}
			const body = Buffer.from(await res.arrayBuffer());
			fs.mkdirSync(path.dirname(this.path), { recursive: true });
			fs.writeFileSync(this.path, body);
			this.lastHash = this.hashOf(body);
			this.log(`restored ${body.length} bytes of friendships`);
			return true;
		} catch (e) {
			this.log(`could not restore the database: ${e.message}`);
			return false;
		}
	}

	hashOf(buffer) {
		return crypto.createHash('sha1').update(buffer).digest('hex');
	}

	/**
	 * A consistent copy of a database somebody else has open.
	 *
	 * The friends database is opened by a child process and written to while
	 * this runs, so the bytes on disk can be a half-finished transaction.
	 * SQLite's own backup API is the answer: a second connection, read-only,
	 * copying under the same locking every other reader uses. Copying the file
	 * by hand is the version of this that works until the first time somebody
	 * adds a friend at the wrong moment.
	 */
	async snapshot() {
		const temp = `${this.path}.snapshot`;
		let Database;
		try {
			Database = require('better-sqlite3');
		} catch (e) {
			// No sqlite means no friends database to save.
			return null;
		}
		let db = null;
		try {
			db = new Database(this.path, { readonly: true, fileMustExist: true });
			await db.backup(temp);
			const bytes = fs.readFileSync(temp);
			return bytes;
		} catch (e) {
			this.log(`could not read the database: ${e.message}`);
			return null;
		} finally {
			try { if (db) db.close(); } catch (e) { /* already closed */ }
			try { fs.unlinkSync(temp); } catch (e) { /* never written */ }
		}
	}

	/** Commit it, if anything has changed since the last time. */
	async save(reason = 'periodic') {
		if (!this.enabled) return false;
		const bytes = await this.snapshot();
		if (!bytes || !bytes.length) return false;

		const hash = this.hashOf(bytes);
		if (hash === this.lastHash) return false;

		const url = `https://api.github.com/repos/${REPO}/contents/${DIR}/${FILE}`;
		const payload = {
			message: `Friends: ${reason}`,
			content: bytes.toString('base64'),
			branch: BRANCH,
		};
		if (this.sha) payload.sha = this.sha;

		try {
			let res = await fetch(url, { method: 'PUT', headers: this.headers(), body: JSON.stringify(payload) });
			if (res.status === 409 || res.status === 422) {
				// Written by an earlier boot whose sha this process never saw.
				const check = await fetch(`${url}?ref=${BRANCH}`, { headers: this.headers() });
				if (check.ok) {
					payload.sha = (await check.json()).sha;
					res = await fetch(url, { method: 'PUT', headers: this.headers(), body: JSON.stringify(payload) });
				}
			}
			if (!res.ok) {
				this.log(`GitHub refused the database: ${res.status}`);
				return false;
			}
			const data = await res.json();
			if (data.content?.sha) this.sha = data.content.sha;
			this.lastHash = hash;
			this.log(`saved ${bytes.length} bytes (${reason})`);
			return true;
		} catch (e) {
			this.log(`could not save the database: ${e.message}`);
			return false;
		}
	}

	/**
	 * Check every so often rather than on every change.
	 *
	 * Nothing tells this process that a friendship happened - it is two
	 * processes away, in a child of the server this one started - so the choice
	 * is polling or nothing. Polling a hash of a 30KB file is free, and a
	 * quarter of an hour is well inside how long this host stays up when it is
	 * being used at all.
	 */
	start(everyMs = Number(process.env.PS_FRIENDS_SYNC_MS || 15 * 60 * 1000)) {
		if (!this.enabled || this.timer) return;
		this.timer = setInterval(() => { void this.save('periodic'); }, everyMs);
		if (this.timer.unref) this.timer.unref();
	}

	/** Last save on the way down, and stop the clock. */
	async stop() {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
		return this.save('shutdown');
	}
}

module.exports = { FriendsStore, REPO, BRANCH, DIR, FILE };
