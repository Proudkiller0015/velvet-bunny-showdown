'use strict';
/**
 * Read the mined replays and work out how strong players actually behave.
 *
 *   node scripts/learn-playbook.js                  # everything mined
 *   node scripts/learn-playbook.js --format gen9ou  # one pool
 *   node scripts/learn-playbook.js --sample 50      # a quick look
 *
 * Writes data/playbook.json: a table of what people do, conditioned on the
 * situation they are in. Not a model - counts. "When the opponent switches
 * something in and your active is slower, a 2000-rated player switches out 41%
 * of the time" is a fact about the ladder, and the bot currently has no idea of
 * it; its switching is a hand-set margin in points of expected damage.
 *
 * ## What a replay does and does not tell you
 *
 * A log is what happened, not what was chosen. Nobody's decision is written
 * down - only its result - so every one of these has to be reconstructed, and
 * that reconstruction is where this can quietly go wrong:
 *
 * - A switch after a faint is not a decision of the same kind. It is a
 *   replacement, and counting it as "they chose to switch" would put the switch
 *   rate up by everything that dies.
 * - A switch caused by Roar or Whirlwind arrives as `|drag|`, and is nobody's
 *   choice at all.
 * - U-turn is a move *and* a switch in the same turn. It is one decision, and
 *   the interesting one: a player who pivots is not a player who switches.
 * - The turn a Pokemon comes in, its choice is made with information the
 *   previous turn did not have. Turn one of a Random Battle is a different
 *   question from turn one of OU, because there was no team preview.
 *
 * So the parser walks the log turn by turn, keeps a small model of the field,
 * and records one decision per side per turn, labelled with what was knowable
 * when it was made.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const MINED = process.env.MINE_DIR || path.join(ROOT, '..', 'reference', 'replays');
const OUT = path.join(ROOT, 'data', 'playbook.json');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
	const at = args.indexOf('--' + name);
	return at >= 0 ? (args[at + 1] && !args[at + 1].startsWith('--') ? args[at + 1] : true) : fallback;
};
const ONLY = typeof flag('format', '') === 'string' ? flag('format', '') : '';
const SAMPLE = Number(flag('sample', 0)) || 0;

/* ------------------------------------------------------------------ parsing */

/** The parts of a `|switch|p1a: Nickname|Species, L50, F|100/100` line. */
function parseSlot(text) {
	const match = /^(p[1-4])([a-f]?): (.*)$/.exec(String(text || ''));
	if (!match) return null;
	return { side: match[1], position: match[2] || 'a', name: match[3] };
}

function parseHealth(text) {
	const first = String(text || '').split(' ')[0];
	if (first === '0' || first === '0 fnt') return 0;
	const parts = first.split('/');
	if (parts.length !== 2) return null;
	const current = parseFloat(parts[0]), max = parseFloat(parts[1]);
	if (!max) return null;
	return current / max;
}

/** Whole numbers, so a table of counts stays readable and small. */
const hpBucket = fraction =>
	fraction === null ? 'unknown' :
	fraction <= 0.25 ? 'low' :
	fraction <= 0.6 ? 'half' :
	fraction < 1 ? 'high' : 'full';

/**
 * One replay, as a list of decisions.
 *
 * Each decision is a side's single choice on one turn, with the situation it
 * was made in. Turn order within the log is resolution order, which is also the
 * order things became known - so the state is updated as the lines are read and
 * a decision is labelled with the state *before* that turn resolved.
 */
function decisions(log, meta) {
	const lines = log.split('\n');
	const out = [];

	const sides = { p1: {}, p2: {} };
	const state = {
		p1: { active: null, hp: {}, status: {}, hazards: 0, cameInLastTurn: false, switchedLastTurn: false },
		p2: { active: null, hp: {}, status: {}, hazards: 0, cameInLastTurn: false, switchedLastTurn: false },
	};
	let turn = 0;
	let teamPreview = false;
	let winner = null;

	// What happened in the turn being read, per side.
	let pending = null;
	const startTurn = () => ({
		p1: { action: null, move: null, to: null, fainted: false },
		p2: { action: null, move: null, to: null, fainted: false },
	});

	/** Snapshot of what a chooser could see, before their choice resolved. */
	const situation = side => {
		const them = side === 'p1' ? 'p2' : 'p1';
		return {
			turn,
			hp: hpBucket(state[side].hp[state[side].active] ?? null),
			foeHp: hpBucket(state[them].hp[state[them].active] ?? null),
			status: state[side].status[state[side].active] || 'none',
			justCameIn: state[side].cameInLastTurn,
			foeJustCameIn: state[them].cameInLastTurn,
			hazards: state[side].hazards > 0,
		};
	};

	const flush = () => {
		if (!pending || !turn) return;
		for (const side of ['p1', 'p2']) {
			const what = pending[side];
			if (!what.action) continue;
			out.push({
				side,
				player: sides[side].name || '',
				rating: sides[side].rating || null,
				action: what.action,
				move: what.move,
				...pending[side].situation,
				// Both players leaving at once is its own thing, and the reason
				// this is recorded per turn rather than per side.
				doubleSwitch: pending.p1.action === 'switch' && pending.p2.action === 'switch',
			});
		}
		pending = null;
	};

	for (const raw of lines) {
		if (!raw.startsWith('|')) continue;
		const parts = raw.slice(1).split('|');
		const kind = parts[0];

		if (kind === 'player' && parts[1] && parts[2]) {
			sides[parts[1]] = { name: parts[2], rating: Number(parts[4]) || null };
			continue;
		}
		if (kind === 'teampreview') { teamPreview = true; continue; }
		if (kind === 'win') { winner = parts[1]; continue; }

		if (kind === 'turn') {
			flush();
			turn = Number(parts[1]) || turn + 1;
			pending = startTurn();
			// Recorded now, before anything resolves: this is what each player was
			// looking at when they chose.
			pending.p1.situation = situation('p1');
			pending.p2.situation = situation('p2');
			for (const side of ['p1', 'p2']) {
				state[side].cameInLastTurn = state[side].switchedLastTurn;
				state[side].switchedLastTurn = false;
			}
			continue;
		}

		if (kind === 'move') {
			const who = parseSlot(parts[1]);
			if (!who || !pending || !pending[who.side]) continue;
			if (!pending[who.side].action) {
				pending[who.side].action = 'move';
				pending[who.side].move = parts[2] || '';
			}
			continue;
		}

		if (kind === 'switch' || kind === 'drag') {
			const who = parseSlot(parts[1]);
			if (!who) continue;
			const species = String(parts[2] || '').split(',')[0];
			const before = state[who.side].active;
			state[who.side].active = species;
			const health = parseHealth(parts[3]);
			if (health !== null) state[who.side].hp[species] = health;
			state[who.side].status[species] = /\b(brn|par|slp|frz|psn|tox)\b/.test(String(parts[3] || '')) ?
				String(parts[3]).split(' ')[1] : 'none';
			state[who.side].switchedLastTurn = true;

			if (!pending || !turn) continue;                 // the lead, before turn 1
			if (kind === 'drag') { pending[who.side].action = pending[who.side].action || 'dragged'; continue; }
			if (pending[who.side].fainted) continue;          // a replacement, not a choice
			if (pending[who.side].action === 'move') {
				// A move and then a switch is one decision: a pivot.
				pending[who.side].action = 'pivot';
				pending[who.side].to = species;
				continue;
			}
			if (!pending[who.side].action) {
				pending[who.side].action = 'switch';
				pending[who.side].to = species;
				pending[who.side].from = before;
			}
			continue;
		}

		if (kind === 'faint') {
			const who = parseSlot(parts[1]);
			if (!who) continue;
			if (state[who.side].active) state[who.side].hp[state[who.side].active] = 0;
			if (pending && pending[who.side]) pending[who.side].fainted = true;
			continue;
		}

		if (kind === '-damage' || kind === '-heal') {
			const who = parseSlot(parts[1]);
			if (!who) continue;
			const health = parseHealth(parts[2]);
			if (health !== null && state[who.side].active) state[who.side].hp[state[who.side].active] = health;
			continue;
		}

		if (kind === '-status') {
			const who = parseSlot(parts[1]);
			if (who && state[who.side].active) state[who.side].status[state[who.side].active] = parts[2] || 'none';
			continue;
		}

		if (kind === '-sidestart') {
			const who = parseSlot(parts[1] + ': x') || { side: String(parts[1] || '').slice(0, 2) };
			const side = /^p[12]/.test(String(parts[1])) ? String(parts[1]).slice(0, 2) : null;
			if (side && state[side]) state[side].hazards++;
			void who;
			continue;
		}
		if (kind === '-sideend') {
			const side = /^p[12]/.test(String(parts[1])) ? String(parts[1]).slice(0, 2) : null;
			if (side && state[side]) state[side].hazards = Math.max(0, state[side].hazards - 1);
			continue;
		}
	}
	flush();

	return { decisions: out, teamPreview, winner, sides, turns: turn, meta };
}

/* ---------------------------------------------------------------- counting */

function newTally() {
	return {
		decisions: 0,
		byAction: {},
		// The conditional questions worth asking, each as its own small table.
		whenFoeJustCameIn: {},
		whenJustCameIn: {},
		byOwnHp: {},
		byFoeHp: {},
		firstTurn: {},
		doubleSwitches: 0,
		turnsSeen: 0,
		replays: 0,
		ratings: [],
	};
}

const bump = (table, key, action) => {
	const row = table[key] = table[key] || {};
	row[action] = (row[action] || 0) + 1;
};

function tally(into, parsed, keepPlayer) {
	into.replays++;
	into.turnsSeen += parsed.turns;
	for (const side of ['p1', 'p2']) {
		if (parsed.sides[side] && parsed.sides[side].rating) into.ratings.push(parsed.sides[side].rating);
	}
	for (const decision of parsed.decisions) {
		// When a particular player is being studied, only their half of the game
		// counts - the other side is whoever they happened to meet.
		if (keepPlayer && toId(decision.player) !== keepPlayer) continue;
		const action = decision.action;
		into.decisions++;
		into.byAction[action] = (into.byAction[action] || 0) + 1;
		if (decision.doubleSwitch && decision.side === 'p1') into.doubleSwitches++;
		if (decision.foeJustCameIn) bump(into.whenFoeJustCameIn, 'foe just came in', action);
		else bump(into.whenFoeJustCameIn, 'foe stayed in', action);
		if (decision.justCameIn) bump(into.whenJustCameIn, 'we just came in', action);
		bump(into.byOwnHp, decision.hp, action);
		bump(into.byFoeHp, decision.foeHp, action);
		if (decision.turn === 1) bump(into.firstTurn, 'turn 1', action);
	}
}

const toId = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Counts are hard to read; rates are the thing. */
function rates(table) {
	const out = {};
	for (const [key, row] of Object.entries(table)) {
		const total = Object.values(row).reduce((a, b) => a + b, 0);
		if (!total) continue;
		out[key] = { n: total };
		for (const [action, count] of Object.entries(row)) {
			out[key][action] = Math.round(count / total * 1000) / 10;
		}
	}
	return out;
}

function finish(tallies) {
	const out = {};
	for (const [name, t] of Object.entries(tallies)) {
		if (!t.decisions) continue;
		const total = t.decisions;
		const share = {};
		for (const [action, count] of Object.entries(t.byAction)) {
			share[action] = Math.round(count / total * 1000) / 10;
		}
		const ratings = t.ratings.filter(Boolean).sort((a, b) => a - b);
		out[name] = {
			replays: t.replays,
			decisions: total,
			averageTurns: Math.round(t.turnsSeen / Math.max(1, t.replays) * 10) / 10,
			rating: ratings.length ? {
				median: ratings[Math.floor(ratings.length / 2)],
				low: ratings[0], high: ratings[ratings.length - 1],
			} : null,
			share,
			doubleSwitchesPerGame: Math.round(t.doubleSwitches / Math.max(1, t.replays) * 100) / 100,
			whenFoeJustCameIn: rates(t.whenFoeJustCameIn),
			whenJustCameIn: rates(t.whenJustCameIn),
			byOwnHp: rates(t.byOwnHp),
			byFoeHp: rates(t.byFoeHp),
			firstTurn: rates(t.firstTurn),
		};
	}
	return out;
}

/* -------------------------------------------------------------------- main */

function pools() {
	if (!fs.existsSync(MINED)) return [];
	// One flat folder per pool. The miner strips the slash out of "players/gen8ou"
	// when it makes the path, so those arrive as `playersgen8ou` - which is fine,
	// and is why nothing here goes looking for a nested layout that is not there.
	return fs.readdirSync(MINED, { withFileTypes: true })
		.filter(entry => entry.isDirectory())
		.map(entry => ({ name: entry.name, dir: path.join(MINED, entry.name) }));
}

const tallies = {};
let files = 0;

for (const pool of pools()) {
	if (ONLY && !pool.name.includes(ONLY)) continue;
	let names = fs.readdirSync(pool.dir).filter(f => f.endsWith('.log.gz'));
	if (SAMPLE) names = names.slice(0, SAMPLE);
	if (!names.length) continue;

	tallies[pool.name] = tallies[pool.name] || newTally();
	for (const name of names) {
		let log;
		try {
			log = zlib.gunzipSync(fs.readFileSync(path.join(pool.dir, name))).toString('utf8');
		} catch (e) {
			continue;
		}
		const parsed = decisions(log, { id: name });
		tally(tallies[pool.name], parsed, null);
		files++;
	}
	process.stdout.write(`\r  read ${files} replays   `);
}
process.stdout.write('\n');

// And the named players, whose own decisions are pulled out of every pool their
// games appear in - including the ladder pools, where they turn up anyway.
const PLAYERS = ['stormzone', 'shikuleo', 'relicstone'];
for (const pool of pools()) {
	if (ONLY && !pool.name.includes(ONLY)) continue;
	let names = fs.readdirSync(pool.dir).filter(f => f.endsWith('.log.gz'));
	if (SAMPLE) names = names.slice(0, SAMPLE);
	for (const name of names) {
		let log;
		try {
			log = zlib.gunzipSync(fs.readFileSync(path.join(pool.dir, name))).toString('utf8');
		} catch (e) { continue; }
		const parsed = decisions(log, { id: name });
		for (const player of PLAYERS) {
			const theirs = Object.values(parsed.sides).some(s => toId(s.name) === player);
			if (!theirs) continue;
			const key = `player:${player}`;
			tallies[key] = tallies[key] || newTally();
			tally(tallies[key], parsed, player);
		}
	}
}

const playbook = {
	builtAt: new Date().toISOString(),
	source: 'public replays from replay.pokemonshowdown.com, highest-rated first',
	pools: finish(tallies),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(playbook, null, 1));

const rows = Object.entries(playbook.pools);
console.log(`\n${rows.length} pools, ${files} replays read -> ${OUT}\n`);
console.log('pool                          replays  decisions  median  move%  switch%  pivot%  dbl/game');
for (const [name, row] of rows.sort((a, b) => b[1].decisions - a[1].decisions)) {
	console.log(
		name.padEnd(30) +
		String(row.replays).padStart(7) +
		String(row.decisions).padStart(11) +
		String(row.rating ? row.rating.median : '-').padStart(8) +
		String(row.share.move || 0).padStart(7) +
		String(row.share.switch || 0).padStart(9) +
		String(row.share.pivot || 0).padStart(8) +
		String(row.doubleSwitchesPerGame).padStart(10)
	);
}
