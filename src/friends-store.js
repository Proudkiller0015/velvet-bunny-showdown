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

module.exports = { FriendsStore };
