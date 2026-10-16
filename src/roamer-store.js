'use strict';
/**
 * Keep the roaming Suicune across restarts.
 *
 * src/roamer.js keeps its HP, its nature and whether it has been caught in a
 * small file inside the server process, on a disk this host wipes on every
 * restart - and a roamer that comes back at full HP after every deploy, or
 * twice after it was caught, is not one Suicune any more. Same machinery as
 * the guest book (src/roster-store.js): restored before the server starts,
 * committed when it changes.
 */

const { RepoFile } = require('./repo-file');
const { FILE, ALL } = require('./roamer');

class RoamerStore {
	/**
	 * @param {string} localPath the file the server writes
	 * @param {(msg: string) => void} log
	 */
	constructor(localPath = FILE, log = () => {}, repoPath = process.env.ROAMER_REPO_PATH || 'data/roamer.json') {
		this.log = log;
		this.file = new RepoFile(localPath, repoPath, log);
		this.timer = null;
	}

	get enabled() { return this.file.enabled; }

	/** Put the saved state back before the server starts using it. */
	restore() { return this.file.restore(); }

	/** Commit it, if it has changed since the last time. */
	async save(reason = 'periodic') {
		if (!this.enabled) return false;
		const bytes = this.file.readLocal();
		if (!bytes) return false;
		return this.file.save(bytes, reason);
	}

	/** Every two minutes: a catch lost to a restart would let it be caught twice. Unchanged costs nothing. */
	start(everyMs = Number(process.env.PS_ROAMER_SYNC_MS || 2 * 60 * 1000)) {
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

/** One store per roamer (src/roamer.js ALL), each its own file in the repository. */
function allStores(log = () => {}) {
	return ALL.map(r => (r.FILE === FILE ? new RoamerStore(FILE, log) : new RoamerStore(r.FILE, log, r.REPO_PATH)));
}

module.exports = { RoamerStore, allStores };
