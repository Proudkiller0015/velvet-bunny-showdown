'use strict';
/**
 * Everybody who has ever been here.
 *
 * The user list in the client is who is online *now*, and it is the only answer
 * this server could give to "who plays here". That is the wrong question for
 * the person running it: a room with four people in it at eleven at night says
 * nothing about whether forty came through during the day, and there was no way
 * to find out except watching.
 *
 * So every named account is written down the first time it appears and touched
 * every time it comes back. Three fields and no more: what they are called,
 * when they were first seen, when they were last seen. It is a guest book, not
 * analytics - no addresses, no battle history, nothing that is not already
 * visible to anyone standing in the lobby when they walk in.
 *
 * Read by the owner and administrators only. It is a small private server and
 * the list of who visits is theirs, not something to hand to whoever asks.
 *
 * The file is written by the server process and committed by the wrapper that
 * started it, the same way the ladder status is - two processes, one file on
 * the disk between them, because this host wipes that disk on every restart.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const FILE = process.env.PS_ROSTER_FILE ||
	path.join(process.env.PS_CACHE_DIR || os.tmpdir(), 'velvet-roster.tsv');

/**
 * Tab separated, one line per account, because the ladder is too.
 *
 * A name can hold anything a name can hold, so the two things that would break
 * the format are taken out of it rather than quoted - the id beside it is the
 * real key and is always safe.
 */
function line(row) {
	const clean = s => String(s == null ? '' : s).replace(/[\t\r\n]+/g, ' ');
	return [row.id, clean(row.name), row.first, row.last, row.visits].join('\t');
}

function parse(text) {
	const rows = new Map();
	for (const raw of String(text || '').split('\n')) {
		const trimmed = raw.trim();
		if (!trimmed) continue;
		const [id, name, first, last, visits] = trimmed.split('\t');
		if (!id) continue;
		rows.set(id, {
			id,
			name: name || id,
			first: first || '',
			last: last || first || '',
			visits: Number(visits) || 1,
		});
	}
	return rows;
}

class Roster {
	constructor(file = FILE) {
		this.file = file;
		this.rows = new Map();
		this.dirty = false;
		this.loaded = false;
	}

	load() {
		if (this.loaded) return this.rows;
		this.loaded = true;
		try {
			this.rows = parse(fs.readFileSync(this.file, 'utf8'));
		} catch (e) {
			this.rows = new Map();
		}
		return this.rows;
	}

	/**
	 * Mark somebody as here.
	 *
	 * Ignores the unnamed: a guest is not an account, and writing one down would
	 * fill this with a hundred rows called "Guest 4179" that mean nothing and
	 * can never be looked up again. The bots are skipped for the same reason -
	 * they are furniture, and they are already listed by the ladder.
	 */
	see(id, name, { when = new Date(), skip = () => false } = {}) {
		if (!id || skip(id)) return null;
		this.load();
		const stamp = when.toISOString();
		const existing = this.rows.get(id);
		if (existing) {
			existing.name = name || existing.name;
			existing.last = stamp;
			existing.visits++;
		} else {
			this.rows.set(id, { id, name: name || id, first: stamp, last: stamp, visits: 1 });
		}
		this.dirty = true;
		return this.rows.get(id);
	}

	/** Newest visitor first, which is the order somebody asking would want. */
	all() {
		this.load();
		return [...this.rows.values()].sort((a, b) => String(b.last).localeCompare(String(a.last)));
	}

	get size() {
		this.load();
		return this.rows.size;
	}

	/** Write it out, if anything changed. Cheap enough to call on a timer. */
	flush() {
		if (!this.dirty) return false;
		try {
			fs.mkdirSync(path.dirname(this.file), { recursive: true });
			fs.writeFileSync(this.file, this.all().map(line).join('\n') + '\n');
			this.dirty = false;
			return true;
		} catch (e) {
			// A guest book that cannot be written is still a guest book in memory.
			return false;
		}
	}
}

module.exports = { Roster, FILE, parse, line };
