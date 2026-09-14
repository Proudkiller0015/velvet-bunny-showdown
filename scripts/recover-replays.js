'use strict';
/**
 * Bring back replays that a later battle overwrote.
 *
 *   node scripts/recover-replays.js          # list what the history holds
 *   node scripts/recover-replays.js --write  # file the missing ones properly
 *
 * Replays used to be filed under the battle room's name - `gen9rpbattle-2` -
 * and that number comes from a counter that restarts with the server. So the
 * second battle after a deploy landed on the file belonging to the second
 * battle before it, and somebody's replay became somebody else's. The cause is
 * fixed in config/showdown-config.js, where the id now carries a per-boot
 * suffix; this is the clean-up.
 *
 * Nothing was actually lost. Every save was a commit to this repository, so an
 * overwritten replay is still sitting in the history of the file that replaced
 * it - `git log --follow` finds it and `git show <sha>:<path>` reads it back.
 *
 * A single battle uploads several times as it goes on, each upload a little
 * longer than the last, so the versions are grouped by how the log *starts*
 * (the player lines and the team preview, which do not change) and only the
 * longest of each group is kept. `--write` files those under ids that cannot
 * collide, and leaves the existing files alone so that links already shared go
 * on working.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'data', 'replays');
const WRITE = process.argv.includes('--write');

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });

/** Every version of every replay file that has ever been committed. */
function everyVersion() {
	const out = [];
	for (const file of git('ls-files', 'data/replays').trim().split('\n').filter(Boolean)) {
		for (const line of git('log', '--format=%H %ct', '--follow', '--', file).trim().split('\n').filter(Boolean)) {
			const [sha, when] = line.split(' ');
			let replay;
			try {
				replay = JSON.parse(git('show', `${sha}:${file}`));
			} catch (e) {
				continue;   // the path existed but held something else, or nothing
			}
			if (replay && replay.log) out.push({ sha, committed: Number(when), file, replay });
		}
	}
	return out;
}

/**
 * One entry per battle, rather than per upload.
 *
 * The opening of a log - `|player|p1|...`, the team preview - is written once
 * and never changes, so two versions that start the same way are the same
 * battle seen at two moments. The longest is the whole thing.
 */
function battles(versions) {
	const byStart = new Map();
	for (const version of versions) {
		const key = String(version.replay.log).slice(0, 300);
		const best = byStart.get(key);
		if (!best || String(version.replay.log).length > String(best.replay.log).length) {
			byStart.set(key, version);
		}
	}
	return [...byStart.values()].sort((a, b) =>
		(a.replay.uploadtime || a.committed) - (b.replay.uploadtime || b.committed));
}

/** A name that cannot be taken by a later battle: the room, plus when it ended. */
function permanentId(replay, committed) {
	const at = replay.uploadtime || committed;
	return `${String(replay.id).replace(/-[0-9a-z]{6,}$/, '')}-${at.toString(36)}`;
}

const found = battles(everyVersion());
console.log(`${found.length} distinct battle(s) in the history\n`);

let missing = 0;
for (const version of found) {
	const { replay, committed } = version;
	const id = permanentId(replay, committed);
	const at = new Date((replay.uploadtime || committed) * 1000).toISOString().replace('T', ' ').slice(0, 16);
	const turns = (String(replay.log).match(/\n\|turn\|/g) || []).length;
	const players = (replay.players || []).join(' vs ');
	const already = fs.existsSync(path.join(DIR, `${id}.json`));
	if (!already) missing++;

	console.log(`${at}  ${id.padEnd(26)} ${String(turns).padStart(3)} turns  ${players}` +
		(already ? '' : '   <- not filed'));

	if (WRITE && !already) {
		// The id inside the file has to match the name it is filed under: the
		// replay page builds its own links out of it.
		fs.writeFileSync(path.join(DIR, `${id}.json`), JSON.stringify({ ...replay, id }));
	}
}

console.log();
if (!WRITE) {
	console.log(missing ? `${missing} not filed. Run with --write to restore them.` : 'nothing missing.');
} else {
	console.log(`${missing} replay(s) restored into data/replays/.`);
	console.log('Commit them, and they are live at /replay/<id>.');
}
