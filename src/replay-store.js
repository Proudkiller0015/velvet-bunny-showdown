'use strict';
/**
 * Replays, kept in the repository.
 *
 * Showdown has two ways to save a replay and neither one fits here. Its own
 * replay database needs PostgreSQL, which is a service to pay for and a disk
 * this host wipes on every restart; without one, the server asks Smogon's
 * replay server to host the file instead - and Smogon only accepts that from
 * servers registered with them, which is the "This server's request IP is not
 * a registered server" popup.
 *
 * So replays are written to this project's own GitHub repository, one JSON
 * file each, and served back from this server. A repository is a reasonable
 * thing to keep them in: they are small, they are text, they are already
 * public, and they cost nothing. It also means a replay outlives the server -
 * the ratings store does the same thing for the same reason.
 *
 * Without a token nothing is lost immediately: replays are held in memory and
 * still play back, they just do not survive a restart, and the log says so.
 *
 * **The id is not the battle room's name.** It is the room's name plus a suffix
 * fixed for the life of the process - see hostReplays() in
 * config/showdown-config.js. A room is called `gen9rpbattle-2` and that number
 * comes from a counter that starts again at one on every restart, so filing by
 * room name meant the second battle after a deploy overwrote the second battle
 * before it. It cost somebody their replay within a day. The suffix is per boot
 * rather than per upload because a room saves its replay repeatedly as the
 * battle goes on, and every one of those has to land on the same file.
 *
 * Overwritten replays are recoverable, because every save is a commit: see
 * scripts/recover-replays.js, which reads them back out of the file history and
 * re-files them under ids that cannot collide.
 */

const fs = require('fs');
const path = require('path');

const os = require('os');

const REPO = process.env.GITHUB_REPO || 'Proudkiller0015/velvet-bunny-showdown';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const DIR = process.env.REPLAY_REPO_DIR || 'data/replays';
// Enough to serve the recent ones without a network round trip, small enough
// that a busy day cannot grow into the memory ceiling this host runs against.
const CACHE_LIMIT = Number(process.env.REPLAY_CACHE || 200);
/**
 * Replays are saved by one process and served by another.
 *
 * Showdown serves HTTP from a socket worker, while battles - and so replay
 * uploads - happen in the main one, and neither can see the other's memory. A
 * file on disk is the shortest path between them: the worker finds a replay
 * that was saved a second ago without waiting on GitHub, which takes a minute
 * or so to make a new commit readable. The disk here is wiped on every
 * restart, which is exactly right for a cache and exactly wrong for storage -
 * hence the commit as well.
 */
const SPOOL = process.env.REPLAY_SPOOL || path.join(process.env.PS_CACHE_DIR || os.tmpdir(), 'velvet-replays');

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

class ReplayStore {
	constructor(log = () => {}) {
		this.log = log;
		this.token = readToken();
		this.cache = new Map();   // id -> replay
		this.shas = new Map();    // id -> blob sha, needed to overwrite a file
	}

	get enabled() { return !!this.token; }

	headers() {
		return {
			'Authorization': `Bearer ${this.token}`,
			'Accept': 'application/vnd.github+json',
			'User-Agent': 'velvet-bunny-showdown',
		};
	}

	spoolPath(id) {
		return path.join(SPOOL, `${encodeURIComponent(id)}.json`);
	}

	remember(replay) {
		this.cache.set(replay.id, replay);
		try {
			fs.mkdirSync(SPOOL, { recursive: true });
			fs.writeFileSync(this.spoolPath(replay.id), JSON.stringify(replay));
		} catch (e) {
			// A cache that cannot be written is still a cache in memory.
		}
		// Oldest out first; Map iterates in insertion order.
		while (this.cache.size > CACHE_LIMIT) {
			this.cache.delete(this.cache.keys().next().value);
		}
	}

	/**
	 * Save one replay and return the id it can be found under.
	 *
	 * The write is not awaited by the caller's popup: a player should be given
	 * their link as soon as the replay exists, not after GitHub has accepted a
	 * commit. It is in memory either way, so the link works immediately.
	 */
	async save(replay) {
		this.remember(replay);
		if (!this.enabled) {
			this.log(`saved ${replay.id} in memory only - set GITHUB_TOKEN to keep replays`);
			return replay.id;
		}

		const url = `https://api.github.com/repos/${REPO}/contents/${DIR}/${replay.id}.json`;
		const payload = {
			message: `Replay: ${replay.id} [skip render]`,   // data, not code: must not redeploy the server
			content: Buffer.from(JSON.stringify(replay, null, '\t'), 'utf8').toString('base64'),
			branch: BRANCH,
		};
		const sha = this.shas.get(replay.id);
		if (sha) payload.sha = sha;

		let res = await fetch(url, { method: 'PUT', headers: this.headers(), body: JSON.stringify(payload) });
		if (res.status === 409 || res.status === 422) {
			// A replay saved twice - the same battle, uploaded again. Take the
			// current sha and overwrite.
			const check = await fetch(`${url}?ref=${BRANCH}`, { headers: this.headers() });
			if (check.ok) {
				payload.sha = (await check.json()).sha;
				res = await fetch(url, { method: 'PUT', headers: this.headers(), body: JSON.stringify(payload) });
			}
		}
		if (!res.ok) throw new Error(`GitHub refused the replay: ${res.status}`);
		const data = await res.json();
		if (data.content?.sha) this.shas.set(replay.id, data.content.sha);
		return replay.id;
	}

	/** One replay, from memory if it is there and from the repository if not. */
	async get(id) {
		const cached = this.cache.get(id);
		if (cached) return cached;

		try {
			const spooled = JSON.parse(fs.readFileSync(this.spoolPath(id), 'utf8'));
			this.cache.set(id, spooled);
			return spooled;
		} catch (e) {
			// Not saved by this instance, or the disk has been wiped since.
		}

		// Raw, not the API: no token needed for a public repository, and the
		// answer is the file rather than a base64 envelope around it.
		const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${DIR}/${encodeURIComponent(id)}.json`;
		try {
			const res = await fetch(url, { headers: { 'User-Agent': 'velvet-bunny-showdown' } });
			if (!res.ok) return null;
			const replay = await res.json();
			this.remember(replay);
			return replay;
		} catch (e) {
			this.log(`could not read replay ${id}: ${e.message}`);
			return null;
		}
	}
}

module.exports = { ReplayStore, REPO, BRANCH, DIR };
