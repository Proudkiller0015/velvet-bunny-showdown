'use strict';
/**
 * One file, kept in this project's own repository.
 *
 * This host throws the disk away on every restart, and the free tier restarts
 * whenever it has been idle a quarter of an hour, so anything worth keeping has
 * to live somewhere else. The repository is free, durable, and leaves a history
 * of how the thing changed - which is how the ladder, the replays and the
 * battle log are all kept.
 *
 * Those three each grew their own copy of this: the same token lookup, the same
 * PUT, the same "take the current sha and try again" when GitHub refuses a
 * stale write. This is that code once, so the next thing that needs keeping is
 * a few lines rather than another copy of the same forty.
 *
 * With no token configured every call no-ops and says so, which is what happens
 * on a local run and is the right behaviour there.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = process.env.GITHUB_REPO || 'Proudkiller0015/velvet-bunny-showdown';
const BRANCH = process.env.GITHUB_BRANCH || 'main';

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

class RepoFile {
	/**
	 * @param {string} localPath where the file lives on this disk
	 * @param {string} repoPath where it lives in the repository
	 * @param {(msg: string) => void} log
	 */
	constructor(localPath, repoPath, log = () => {}) {
		this.localPath = localPath;
		this.repoPath = repoPath;
		this.log = log;
		this.token = readToken();
		this.sha = '';        // blob sha, needed to overwrite
		this.lastHash = '';   // what was last written, so an idle hour costs nothing
	}

	get enabled() { return !!this.token; }

	headers() {
		return {
			'Authorization': `Bearer ${this.token}`,
			'Accept': 'application/vnd.github+json',
			'User-Agent': 'velvet-bunny-showdown',
		};
	}

	hashOf(buffer) {
		return crypto.createHash('sha1').update(buffer).digest('hex');
	}

	/**
	 * Fetch the saved copy.
	 *
	 * Raw rather than the API: no envelope to unwrap, no token needed for a
	 * public repository, and a 404 is the ordinary first run rather than a
	 * failure. Returns the bytes, or null when there is nothing saved.
	 */
	async fetch() {
		const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${this.repoPath}`;
		try {
			const res = await fetch(url, { headers: { 'User-Agent': 'velvet-bunny-showdown' } });
			if (res.status === 404) return null;
			if (!res.ok) {
				this.log(`could not read ${this.repoPath}: ${res.status}`);
				return null;
			}
			return Buffer.from(await res.arrayBuffer());
		} catch (e) {
			this.log(`could not read ${this.repoPath}: ${e.message}`);
			return null;
		}
	}

	/**
	 * Put the saved copy back on disk, unless there is one here already.
	 *
	 * A file on this disk is either this boot's work or a leftover from a
	 * restart that kept it, and either way it is newer than the commit.
	 * Overwriting it is the one way this could lose data rather than keep it.
	 */
	async restore() {
		if (!this.enabled) {
			this.log(`no GITHUB_TOKEN, so ${this.repoPath} lasts until the next restart`);
			return false;
		}
		try {
			if (fs.existsSync(this.localPath) && fs.statSync(this.localPath).size > 0) {
				this.lastHash = this.hashOf(fs.readFileSync(this.localPath));
				this.log(`${path.basename(this.localPath)} is already here; leaving it alone`);
				return false;
			}
		} catch (e) {
			// Unreadable is the same as absent for this purpose.
		}

		const body = await this.fetch();
		if (!body) {
			this.log(`nothing saved yet for ${this.repoPath}; starting fresh`);
			return false;
		}
		try {
			fs.mkdirSync(path.dirname(this.localPath), { recursive: true });
			fs.writeFileSync(this.localPath, body);
			this.lastHash = this.hashOf(body);
			this.log(`restored ${body.length} bytes into ${path.basename(this.localPath)}`);
			return true;
		} catch (e) {
			this.log(`could not write ${this.localPath}: ${e.message}`);
			return false;
		}
	}

	/**
	 * Commit these bytes, if they are not what was committed last time.
	 *
	 * The hash check is what makes it safe to call this on a timer: a server
	 * nobody has touched costs one hash of a small file and no network at all.
	 */
	async save(bytes, reason = 'update') {
		if (!this.enabled || !bytes || !bytes.length) return false;
		const hash = this.hashOf(bytes);
		if (hash === this.lastHash) return false;

		const url = `https://api.github.com/repos/${REPO}/contents/${this.repoPath}`;
		const payload = {
			message: `${path.basename(this.repoPath)}: ${reason} [skip render]`,   // data, not code: must not redeploy the server
			content: Buffer.from(bytes).toString('base64'),
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
				this.log(`GitHub refused ${this.repoPath}: ${res.status}`);
				return false;
			}
			const data = await res.json();
			if (data.content?.sha) this.sha = data.content.sha;
			this.lastHash = hash;
			this.log(`saved ${bytes.length} bytes to ${this.repoPath} (${reason})`);
			return true;
		} catch (e) {
			this.log(`could not save ${this.repoPath}: ${e.message}`);
			return false;
		}
	}

	/** The file as it is on disk, or null. */
	readLocal() {
		try {
			return fs.readFileSync(this.localPath);
		} catch (e) {
			return null;
		}
	}
}

module.exports = { RepoFile, REPO, BRANCH };
