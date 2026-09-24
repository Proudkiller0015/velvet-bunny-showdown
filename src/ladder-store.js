'use strict';
/**
 * Keep the ladder across restarts.
 *
 * Showdown writes each format's ratings to config/ladders/<format>.tsv inside
 * its own package, and on this host that disk is thrown away on every restart -
 * and the free tier restarts whenever it has been idle a quarter of an hour. So
 * ratings were real while the server was up and gone by morning, which is not a
 * ladder.
 *
 * The files are small and Showdown owns their format, so rather than reaching
 * into its ladder code this syncs the files themselves: read them back on boot,
 * write them out when they change and on the way down.
 *
 * Two backends, picked by whichever is configured:
 *
 *   github  commits the files back to this project's own repository. Free and
 *           actually durable, and it leaves a visible history of how the ladder
 *           moved. Needs a token with contents:write on that one repo.
 *   redis   a Key Value store. Simpler, but Render's free tier is explicitly
 *           non-persistent, so it survives the web service restarting and not
 *           much else.
 *
 * With neither configured it no-ops and the server behaves as it did before.
 */

const fs = require('fs');
const path = require('path');

const KEY_PREFIX = 'ladder:';

class GithubBackend {
	constructor(log) {
		this.log = log;
		this.token = process.env.GITHUB_TOKEN || process.env.LADDER_GITHUB_TOKEN || '';
		this.repo = process.env.GITHUB_REPO || 'Proudkiller0015/velvet-bunny-showdown';
		this.branch = process.env.GITHUB_BRANCH || 'main';
		this.dir = process.env.LADDER_REPO_DIR || 'data/ladders';
		this.shas = new Map();   // filename -> blob sha, needed to update a file
	}

	get enabled() { return !!this.token; }

	headers() {
		return {
			'Authorization': `Bearer ${this.token}`,
			'Accept': 'application/vnd.github+json',
			'User-Agent': 'velvet-bunny-showdown',
		};
	}

	async connect() {
		if (!this.enabled) return false;
		try {
			const res = await fetch(`https://api.github.com/repos/${this.repo}`, { headers: this.headers() });
			if (!res.ok) throw new Error(`repo check returned ${res.status}`);
			this.log(`ladder stored in ${this.repo}/${this.dir}`);
			return true;
		} catch (e) {
			this.log(`cannot reach the repository (${e.message}); ratings will be session-only`);
			return false;
		}
	}

	async list() {
		const url = `https://api.github.com/repos/${this.repo}/contents/${this.dir}?ref=${this.branch}`;
		const res = await fetch(url, { headers: this.headers() });
		if (res.status === 404) return [];        // nothing saved yet
		if (!res.ok) throw new Error(`listing returned ${res.status}`);
		const items = await res.json();
		return Array.isArray(items) ? items.filter(i => i.type === 'file' && i.name.endsWith('.tsv')) : [];
	}

	async read(item) {
		const res = await fetch(item.url, { headers: this.headers() });
		if (!res.ok) throw new Error(`read returned ${res.status}`);
		const data = await res.json();
		this.shas.set(item.name, data.sha);
		return Buffer.from(data.content || '', 'base64').toString('utf8');
	}

	async write(name, body) {
		const url = `https://api.github.com/repos/${this.repo}/contents/${this.dir}/${name}`;
		const payload = {
			message: `Ladder: ${name.replace(/\.tsv$/, '')} [skip render]`,   // data, not code: must not redeploy the server
			content: Buffer.from(body, 'utf8').toString('base64'),
			branch: this.branch,
		};
		const sha = this.shas.get(name);
		if (sha) payload.sha = sha;

		let res = await fetch(url, { method: 'PUT', headers: this.headers(), body: JSON.stringify(payload) });
		if (res.status === 409 || res.status === 422) {
			// Someone else moved it; re-read the sha and try once more.
			const check = await fetch(`${url}?ref=${this.branch}`, { headers: this.headers() });
			if (check.ok) {
				const data = await check.json();
				payload.sha = data.sha;
				res = await fetch(url, { method: 'PUT', headers: this.headers(), body: JSON.stringify(payload) });
			}
		}
		if (!res.ok) throw new Error(`write returned ${res.status}`);
		const data = await res.json();
		if (data.content?.sha) this.shas.set(name, data.content.sha);
	}
}

class RedisBackend {
	constructor(log) {
		this.log = log;
		this.url = process.env.REDIS_URL || process.env.LADDER_REDIS_URL || '';
		this.client = null;
	}

	get enabled() { return !!this.url; }

	async connect() {
		if (!this.enabled) return false;
		try {
			const { createClient } = require('redis');
			this.client = createClient({ url: this.url });
			this.client.on('error', e => this.log(`store error: ${e.message}`));
			await this.client.connect();
			this.log('ladder store connected');
			return true;
		} catch (e) {
			this.log(`could not reach the store (${e.message}); ratings will be session-only`);
			this.client = null;
			return false;
		}
	}

	async list() {
		const keys = await this.client.keys(`${KEY_PREFIX}*`);
		return keys.map(k => ({ name: k.slice(KEY_PREFIX.length), key: k }));
	}

	async read(item) { return (await this.client.get(item.key)) || ''; }
	async write(name, body) { await this.client.set(`${KEY_PREFIX}${name}`, body); }
}

class LadderStore {
	/** @param {string} dir the package's config/ladders directory */
	constructor(dir, log) {
		this.dir = dir;
		this.log = log || (() => {});
		const github = new GithubBackend(this.log);
		const redis = new RedisBackend(this.log);
		this.backend = github.enabled ? github : (redis.enabled ? redis : null);
		this.ready = false;
		this.timer = null;
		this.lastWritten = new Map();
	}

	async connect() {
		if (!this.backend) {
			this.log('no store configured; ladder ratings will not survive a restart');
			return false;
		}
		this.ready = await this.backend.connect();
		return this.ready;
	}

	/** Put saved ratings back on disk, before Showdown reads them. */
	async restore() {
		if (!this.ready) return 0;
		try {
			fs.mkdirSync(this.dir, { recursive: true });
			const items = await this.backend.list();
			let restored = 0;
			for (const item of items) {
				// Names come from our own writes, but never let one escape the directory.
				if (!/^[A-Za-z0-9._-]+\.tsv$/.test(item.name)) continue;
				const body = await this.backend.read(item);
				if (!body) continue;
				fs.writeFileSync(path.join(this.dir, item.name), body);
				this.lastWritten.set(item.name, body);
				restored++;
			}
			this.log(restored ? `restored ${restored} ladder file(s)` : 'no saved ladder yet');
			return restored;
		} catch (e) {
			this.log(`restore failed: ${e.message}`);
			return 0;
		}
	}

	/** Push anything that has changed since the last save. */
	async save() {
		if (!this.ready || !fs.existsSync(this.dir)) return 0;
		let saved = 0;
		for (const file of fs.readdirSync(this.dir)) {
			if (!file.endsWith('.tsv')) continue;
			let body;
			try { body = fs.readFileSync(path.join(this.dir, file), 'utf8'); } catch (e) { continue; }
			if (this.lastWritten.get(file) === body) continue;   // nothing new to say
			try {
				await this.backend.write(file, body);
				this.lastWritten.set(file, body);
				saved++;
			} catch (e) {
				this.log(`save of ${file} failed: ${e.message}`);
			}
		}
		if (saved) this.log(`saved ${saved} ladder file(s)`);
		return saved;
	}

	/**
	 * Save on a timer. Five minutes by default: often enough that little is lost,
	 * rare enough that the repository does not fill with commits.
	 */
	start(everyMs = Number(process.env.LADDER_SAVE_MS || 300000)) {
		if (!this.ready) return;
		this.timer = setInterval(() => void this.saveOnce(), everyMs);
		this.timer.unref?.();
		this.watch();
	}

	/**
	 * And soon after every rated game, not up to five minutes later (24 Sep 2026).
	 *
	 * A restart inside those five minutes - a deploy, a crash, the host
	 * recycling the box - lost every rating change since the last save, and a
	 * player who just climbed watched it undone. This process cannot see a
	 * battle end (that is two processes away), but it can see Showdown write
	 * the ladder file when it does. The write is debounced so an evening of
	 * back-to-back games is a commit every half a minute at most, not one per
	 * game; the interval above stays as the backstop in case the watch misses.
	 */
	watch(debounceMs = Number(process.env.LADDER_SAVE_DEBOUNCE_MS || 30000)) {
		if (this.watcher) return;
		try {
			fs.mkdirSync(this.dir, { recursive: true });
			this.watcher = fs.watch(this.dir, (event, file) => {
				if (file && !String(file).includes('.tsv')) return;
				if (this.debounce) return;   // one save per burst, at the end of the window
				this.debounce = setTimeout(() => { this.debounce = null; void this.saveOnce(); }, debounceMs);
				this.debounce.unref?.();
			});
			this.watcher.unref?.();
			this.watcher.on('error', e => this.log(`watching the ladder stopped: ${e.message}`));
		} catch (e) {
			this.log(`cannot watch the ladder (${e.message}); saving every few minutes only`);
		}
	}

	/** save(), but never two at once: a slow commit and the next change overlap. */
	async saveOnce() {
		if (this.saving) { this.again = true; return 0; }
		this.saving = true;
		try {
			return await this.save();
		} finally {
			this.saving = false;
			if (this.again) { this.again = false; void this.saveOnce(); }
		}
	}

	async stop() {
		if (this.timer) clearInterval(this.timer);
		if (this.debounce) clearTimeout(this.debounce);
		try { this.watcher?.close(); } catch (e) { /* already closed */ }
		await this.save();
		try { await this.backend?.client?.quit(); } catch (e) { /* already gone */ }
	}
}

module.exports = { LadderStore };
