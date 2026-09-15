'use strict';
/**
 * The format list, without loading every mod in Showdown to write it.
 *
 * The first person to connect is sent the list of formats, and Showdown builds
 * that list once and caches it. Building it looks innocent - a name and a few
 * flags per format - but one of the flags is "this format is played at level
 * 50", and the only way Showdown knows to find that out is to build the
 * format's whole rule table. A rule table is built against the format's own
 * mod, and building one means loading that mod's entire dex.
 *
 * So the first connection loaded all forty-six of them - Let's Go, BDSP, the
 * Card Game, Super Staff Bros, April Fools, every past-gen sub-version - and
 * nothing ever lets go of a loaded dex. Measured on Node 20, the server's heap
 * went from 52MB to 183MB on that one connection, before a single battle had
 * started. That is most of what the health page was reporting as "the server",
 * and nearly all of it is data for formats nobody on this server plays.
 *
 * The flag itself is one number per format and never changes between boots,
 * so it is worked out once in a process of its own, written down, and the
 * server reads it back instead of building rule tables to rediscover it. The
 * list a player receives is byte for byte what Showdown would have sent: the
 * server still runs Showdown's own code to build it, and only the one lookup
 * that loaded the dex is answered from the file.
 *
 * Anything the file does not know - a format added since, a file from another
 * version - falls through to Showdown's own lookup. Wrong would be a format
 * showing the wrong level in the client; missing is only the old memory cost
 * for that one format, which is why the fallback is the real thing and not a
 * guess.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

// Bump to invalidate every file written by an older version of this module.
const VERSION = 1;

const pkgRoot = () => path.dirname(require.resolve('pokemon-showdown/package.json'));
const levelsFile = root => path.join(root, 'config', 'velvet-format-levels.json');

/**
 * Everything a format's level could possibly depend on, hashed.
 *
 * Levels come from rules, and rules come from the format definitions (theirs
 * and ours), the base rulesets, and each mod's own rulesets and scripts. The
 * dex data proper cannot change a level, so the multi-megabyte learnsets are
 * left out and hashing stays quick enough to do on every boot.
 */
function signature(root = pkgRoot()) {
	const hash = crypto.createHash('sha1');
	hash.update(`v${VERSION}\n`);
	hash.update(fs.readFileSync(path.join(root, 'package.json')));
	const add = file => {
		if (!fs.existsSync(file)) return;
		hash.update(path.relative(root, file));
		hash.update(fs.readFileSync(file));
	};
	const dist = path.join(root, 'dist');
	for (const file of fs.readdirSync(path.join(dist, 'config')).sort()) {
		if (file.endsWith('.js')) add(path.join(dist, 'config', file));
	}
	add(path.join(dist, 'data', 'rulesets.js'));
	const velvet = path.join(dist, 'data', 'velvet');
	if (fs.existsSync(velvet)) {
		for (const file of fs.readdirSync(velvet).sort()) add(path.join(velvet, file));
	}
	const mods = path.join(dist, 'data', 'mods');
	for (const mod of fs.readdirSync(mods).sort()) {
		hash.update(`mod:${mod}\n`);
		add(path.join(mods, mod, 'rulesets.js'));
		add(path.join(mods, mod, 'scripts.js'));
	}
	return hash.digest('hex');
}

/** The levels, exactly as the format list reads them. Run in a throwaway process. */
function computeLevels() {
	const { Dex } = require('pokemon-showdown');
	const levels = {};
	for (const format of Dex.formats.all()) {
		if (!format.name) continue;
		if (!format.challengeShow && !format.searchShow && !format.tournamentShow) continue;
		const ruleTable = Dex.formats.getRuleTable(format);
		levels[format.id] = ruleTable.adjustLevel || ruleTable.adjustLevelDown || ruleTable.maxLevel || 0;
	}
	return levels;
}

/**
 * Make sure the file matches this install, writing it if not.
 *
 * Called from scripts/setup-config.js, which runs at install and again before
 * every boot. The work happens in a child process for the same reason the file
 * exists at all: loading every mod costs a hundred megabytes, and a process
 * that exits is the only way to give that back. At boot nothing else heavy is
 * running yet - the wrapper has not loaded the bot and the server has not been
 * started - so this is the one moment the container can afford it. On the host
 * it has normally been done already by the install step.
 */
function ensureLevels(log = () => {}) {
	const root = pkgRoot();
	const file = levelsFile(root);
	const want = signature(root);
	try {
		const have = JSON.parse(fs.readFileSync(file, 'utf8'));
		if (have.signature === want && have.levels) {
			log(`format levels -> up to date (${Object.keys(have.levels).length} formats)`);
			return true;
		}
	} catch (e) {
		// No file, or not one we can read: write it.
	}
	const started = Date.now();
	const child = spawnSync(process.execPath, [__filename, '--write'], {
		cwd: path.join(__dirname, '..'),
		encoding: 'utf8',
		// Its own ceiling, so a small one inherited from the host's NODE_OPTIONS
		// cannot kill it partway through loading the mods.
		env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=400' },
		timeout: 120000,
	});
	if (child.status !== 0) {
		log(`format levels -> could not be worked out (${(child.stderr || child.error || '').toString().trim().split('\n').pop()}); ` +
			'the server will load every mod to build its format list, as Showdown does by default');
		return false;
	}
	log(`format levels -> written in ${Date.now() - started}ms`);
	return true;
}

/**
 * Server side: answer the level lookup from the file while the list is built.
 *
 * Only the lookup inside `formatListText` is replaced, and only for the length
 * of that one call; a battle, a validator or a /formathelp still builds real
 * rule tables exactly as before. A format that already has its rule table - it
 * has been played - is read from that, since it costs nothing.
 */
function installFormatList({ Rooms, Dex, log = () => {} }) {
	const global = Rooms && Rooms.global;
	if (!global || global.velvetFormatLevels) return;
	// The way back to Showdown's own behaviour, for comparing or if this ever
	// turns out to be wrong about something.
	if (process.env.PS_FORMAT_LEVELS === '0') {
		log('[formats] PS_FORMAT_LEVELS=0; the format list will load every mod, as Showdown does');
		return;
	}

	let levels = null;
	try {
		const saved = JSON.parse(fs.readFileSync(levelsFile(pkgRoot()), 'utf8'));
		if (saved.signature === signature()) levels = saved.levels;
	} catch (e) {
		// Leave levels null: Showdown's own lookup for everything.
	}
	if (!levels) {
		log('[formats] no saved format levels for this install; the list will load every mod');
		return;
	}

	const original = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(global), 'formatListText');
	if (!original || !original.get) {
		log('[formats] this Showdown builds its format list differently; leaving it alone');
		return;
	}
	global.velvetFormatLevels = true;

	Object.defineProperty(global, 'formatListText', {
		configurable: true,
		get() {
			if (this.formatList) return this.formatList;
			const formats = Dex.formats;
			const realRuleTable = formats.getRuleTable;
			let answered = 0;
			formats.getRuleTable = function (format, ...rest) {
				if (!rest.length && format && !format.ruleTable &&
					Object.prototype.hasOwnProperty.call(levels, format.id)) {
					answered++;
					// Only the three fields the list reads; see computeLevels.
					return { adjustLevel: levels[format.id] || undefined };
				}
				return realRuleTable.call(this, format, ...rest);
			};
			try {
				return original.get.call(this);
			} finally {
				// An own property shadowing the prototype's method; removing it
				// puts Showdown's back, whatever happened above.
				delete formats.getRuleTable;
				if (formats.getRuleTable !== realRuleTable) formats.getRuleTable = realRuleTable;
				log(`[formats] list built; ${answered} level(s) read from the saved file instead of loading their mods`);
			}
		},
	});
}

module.exports = { ensureLevels, installFormatList, signature, computeLevels };

if (require.main === module && process.argv.includes('--write')) {
	const root = pkgRoot();
	const levels = computeLevels();
	fs.writeFileSync(levelsFile(root), JSON.stringify({ signature: signature(root), levels }, null, '\t'));
}
