'use strict';
/**
 * Keep the guest book across restarts.
 *
 * src/roster.js writes down everybody who turns up, inside the server process.
 * This is the other half: the file it writes lives on a disk this host wipes on
 * every restart, so a record of who has visited would only ever cover the last
 * few hours - which is the one thing it exists not to be.
 *
 * Same machinery as the ladder, the replays and the friends database; see
 * src/repo-file.js. A tab separated file this time rather than a database, so
 * the history in the repository is readable: a commit says who arrived.
 */

const { RepoFile } = require('./repo-file');
const { FILE } = require('./roster');

class RosterStore {
	/**
	 * @param {string} localPath the file the server writes
	 * @param {(msg: string) => void} log
	 */
	constructor(localPath = FILE, log = () => {}) {
		this.log = log;
		this.file = new RepoFile(localPath, process.env.ROSTER_REPO_PATH || 'data/roster.tsv', log);
		this.timer = null;
	}

	get enabled() { return this.file.enabled; }

	/** Put the saved list back before the server starts adding to it. */
	restore() { return this.file.restore(); }

	/** Commit it, if it has changed since the last time. */
	async save(reason = 'periodic') {
		if (!this.enabled) return false;
		const bytes = this.file.readLocal();
		if (!bytes) return false;
		return this.file.save(bytes, reason);
	}

	/**
	 * Look every so often, because nothing tells this process that somebody
	 * arrived - that happens in the server it started. Hashing a small text file
	 * on a quiet server costs nothing and commits nothing.
	 */
	start(everyMs = Number(process.env.PS_ROSTER_SYNC_MS || 10 * 60 * 1000)) {
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

module.exports = { RosterStore };
