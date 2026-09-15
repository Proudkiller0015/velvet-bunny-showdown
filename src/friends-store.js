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
 * Same answer as the ladder and the replays, and the same code - see
 * src/repo-file.js. All this adds is how to read a database somebody else has
 * open, which is the only part that is specific to friends.
 *
 * Keeping the database rather than an export of it is deliberate. There is no
 * diff to read, which is a real loss; in exchange this does not have to know
 * Showdown's schema, and so survives them changing it.
 */

const { RepoFile } = require('./repo-file');
const fs = require('fs');

/**
 * Whether better-sqlite3 can be loaded here without taking the process with it.
 *
 * It does not fail politely. Version 13 needs Node 22 or later, and on Node 20
 * the first database it opens is a segmentation fault - no exception, no log
 * line, just the process gone. The host was on Node 20, so every quarter of an
 * hour this store's periodic save opened the database and the whole service
 * died with "Segmentation fault (core dumped)" and was restarted, taking every
 * battle in progress with it; the friends process inside the server was dying
 * the same way on every start. Checked here so that a host on the wrong version
 * loses the friends list rather than the server.
 */
function sqliteUsable() {
	const major = Number(String(process.versions.node).split('.')[0]);
	let wants = 22;
	try {
		const range = require('better-sqlite3/package.json').engines.node;
		wants = Number((/(\d+)/.exec(range) || [])[1]) || wants;
	} catch (e) {
		// No package, or no engines field: the version it needed when this was written.
	}
	return major >= wants;
}

class FriendsStore {
	/**
	 * @param {string} dbPath the database file Showdown will open
	 * @param {(msg: string) => void} log
	 */
	constructor(dbPath, log = () => {}) {
		this.path = dbPath;
		this.log = log;
		this.file = new RepoFile(dbPath, `${process.env.FRIENDS_REPO_DIR || 'data/friends'}/friends.db`, log);
		this.timer = null;
	}

	get enabled() { return this.file.enabled; }

	/** Put the saved database back before Showdown opens it. */
	restore() { return this.file.restore(); }

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
		if (!sqliteUsable()) {
			if (!this.warnedVersion) {
				this.warnedVersion = true;
				this.log(`Node ${process.version} cannot run better-sqlite3 without crashing; not saving the friends list`);
			}
			return null;
		}
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
			return fs.readFileSync(temp);
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
		if (!bytes) return false;
		return this.file.save(bytes, reason);
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

module.exports = { FriendsStore, sqliteUsable };
