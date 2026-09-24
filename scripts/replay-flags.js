'use strict';
/**
 * Read saved replays and flag the bot's mistakes, so a batch of games can be
 * judged on what actually happened rather than by watching them.
 *
 *   node scripts/replay-flags.js gen9rpou-1-tlirnb gen9rpou-%-tliry4   # ids, % is a wildcard
 *   node scripts/replay-flags.js --since 2026-09-17T17:40 --player Bunny
 *
 * Each flag is one thing the bot did that a good player would not:
 *
 *   immune        attacked something the move cannot touch, which was already out
 *   failed        a move that failed outright (a second Protect, Sucker Punch into status)
 *   maxguard      Max Guard while Dynamaxed, which is what a status move becomes
 *   setup-died    set up and was knocked out on that turn or the next
 *   entry-died    switched something in and it fainted within two turns
 *   locked        used a move that did under 10% three turns running
 *   keystone      a single hit into Keystone Legion, which only gets it cursed
 *   wasted-dmax   Dynamaxed and spent two of its three turns not attacking
 *   no-progress   five turns in which its attacks took less than a quarter in total
 */

const fs = require('fs');
const path = require('path');
const { Dex } = require('pokemon-showdown');

const args = process.argv.slice(2);
// --dir data/tier-sim/logs --player P1: the tier sim's sampled games (--sample-logs).
const DIR = args.includes('--dir') ? path.resolve(args[args.indexOf('--dir') + 1]) : path.join(__dirname, '..', 'data', 'replays');
const since = (args.includes('--since') && Date.parse(args[args.indexOf('--since') + 1])) || 0;
const who = (args.includes('--player') && args[args.indexOf('--player') + 1]) || 'Bunny';
const patterns = args.filter((a, i) => !a.startsWith('--') && a !== String(since) && a !== who && args[i - 1] !== '--dir');
const verbose = args.includes('--verbose');

const matches = id => !patterns.length || patterns.some(p => new RegExp(`^${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`).test(id));

function load() {
	return fs.readdirSync(DIR).filter(f => f.endsWith('.json')).map(f => {
		try { return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { return null; }
	}).filter(r => r && matches(r.id) && (r.uploadtime || 0) * 1000 >= since)
		.sort((a, b) => (a.uploadtime || 0) - (b.uploadtime || 0));
}

/** Which side the bot is, and a per-turn view of the log. */
function sideOf(replay) {
	const players = replay.players || [];
	const i = players.findIndex(p => new RegExp(who, 'i').test(p));
	return i < 0 ? null : `p${i + 1}`;
}

function flagsFor(replay) {
	const side = sideOf(replay);
	if (!side) return [];
	const foeSide = side === 'p1' ? 'p2' : 'p1';
	const lines = replay.log.split('\n');
	const flags = [];
	const add = (turn, kind, text) => flags.push({ turn, kind, text });

	let turn = 0;
	let lastMove = null;              // the bot's last move, and when
	const dmax = { on: false, turn: 0, attacks: 0, guards: 0, mon: '' };
	const cameIn = new Map();         // bot mon -> turn it came in; "foe:<name>" -> the line it arrived on
	let turnStart = -1;               // where the current turn began, for "was it already out?"
	const dealt = [];                 // per turn, per cent the bot's attack took
	let smallHits = 0, smallFrom = 0;
	const active = { [side]: '', [foeSide]: '' };
	const hpNow = { [side]: {}, [foeSide]: {} };

	/*
	 * The turn's attack is judged once the turn is over.
	 *
	 * It used to be judged on the move line itself, where dealt[turn] is still
	 * zero because the damage lines come next - so every attack in the game
	 * looked like it did nothing, and "locked" fired on Pokemon that were
	 * knocking things out. Settled at the next |turn| instead, and at the end.
	 */
	let pending = null;               // the bot's attack this turn, waiting for the damage
	const settle = () => {
		if (!pending) return;
		const took = dealt[pending.turn] || 0;
		if (took < 10) { smallHits++; if (smallHits === 1) smallFrom = pending.turn; } else smallHits = 0;
		if (smallHits === 3) add(smallFrom, 'locked', `${pending.mon} spent turns ${smallFrom}-${pending.turn} doing under 10% a hit`);
		pending = null;
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const parts = line.slice(1).split('|');
		const cmd = parts[0];
		const identSide = (parts[1] || '').slice(0, 2);
		const name = String(parts[1] || '').replace(/^p[12][a-c]?: /, '');
		if (cmd === 'turn') { settle(); turn = Number(parts[1]) || turn; turnStart = i; continue; }
		if (cmd === 'switch' || cmd === 'drag' || cmd === 'replace') {
			active[identSide] = name;
			// A new Pokemon is a new chain of decisions: a streak of weak hits
			// belongs to the one that made them, not to whoever came in after.
			if (identSide === side) { cameIn.set(name, turn); smallHits = 0; }
			else cameIn.set(`foe:${name}`, i);
			const cond = /(\d+)\/(\d+)/.exec(parts[3] || '');
			hpNow[identSide][name] = cond ? (+cond[1] / +cond[2]) * 100 : 100;
			continue;
		}
		if (cmd === '-damage' || cmd === '-heal' || cmd === '-sethp') {
			const cond = /(\d+)\/(\d+)/.exec(parts[2] || '');
			const before = hpNow[identSide][name];
			hpNow[identSide][name] = cond ? (+cond[1] / +cond[2]) * 100 : /fnt/.test(parts[2] || '') ? 0 : hpNow[identSide][name];
			// Damage the bot's own attack did, for the no-progress count.
			if (cmd === '-damage' && identSide === foeSide && lastMove && lastMove.turn === turn && !/\[from\]/.test(line)) {
				dealt[turn] = (dealt[turn] || 0) + Math.max(0, (before || 100) - hpNow[identSide][name]);
			}
			continue;
		}
		if (cmd === '-start' && /Dynamax/.test(parts[2] || '') && identSide === side) {
			dmax.on = true; dmax.turn = turn; dmax.attacks = 0; dmax.guards = 0; dmax.mon = name;
			continue;
		}
		if (cmd === '-end' && /Dynamax/.test(parts[2] || '') && identSide === side) {
			if (dmax.on && dmax.guards >= 2) add(dmax.turn, 'wasted-dmax', `${dmax.mon} Dynamaxed and used Max Guard ${dmax.guards} times`);
			dmax.on = false;
			continue;
		}
		if (cmd === 'faint') {
			const when = cameIn.get(name);
			if (identSide === side && when !== undefined && turn - when <= 1 && turn > 1) {
				add(turn, 'entry-died', `${name} came in on turn ${when} and fainted on turn ${turn}`);
			}
			if (identSide === side && lastMove && lastMove.turn >= turn - 1 && lastMove.setup) {
				add(turn, 'setup-died', `${name} used ${lastMove.name} on turn ${lastMove.turn} and fainted on turn ${turn}`);
			}
			continue;
		}
		if (cmd !== 'move' || identSide !== side || /\[from\]/.test(line)) continue;

		const moveName = parts[2];
		const move = Dex.moves.get(moveName);
		lastMove = {
			name: moveName, turn, mon: name,
			setup: move.exists && move.category === 'Status' && !!(move.boosts && Object.values(move.boosts).some(v => v > 0)),
		};
		if (/^Max /.test(moveName)) { if (moveName === 'Max Guard') dmax.guards++; else dmax.attacks++; }
		// What the next few lines say about this move.
		const after = lines.slice(i + 1, i + 6);
		const target = active[foeSide];
		/*
		 * Immune only counts when the target was already standing there. Clicking a
		 * Dragon move at a Garchomp that is swapped for a Togekiss as the turn
		 * resolves is a read the player won, not a mistake the bot made.
		 */
		const arrivedThisTurn = (cameIn.get(`foe:${target}`) || -1) > turnStart;
		if (after.some(l => l.startsWith(`|-immune|${foeSide}`)) && !arrivedThisTurn) {
			add(turn, 'immune', `${name} used ${moveName} on ${target}, which is immune`);
		}
		/*
		 * Only our own move failing counts. The lines after a move include whatever the
		 * opponent did next, and a Will-O-Wisp of theirs failing was being written down
		 * as our Flamethrower failing - thirteen times in one game.
		 */
		const ourFail = after.findIndex(l => l.startsWith(`|-fail|${side}`));
		const theirMove = after.findIndex(l => l.startsWith('|move|') && !l.startsWith(`|move|${side}`));
		if (ourFail >= 0 && (theirMove < 0 || ourFail < theirMove)) add(turn, 'failed', `${name}'s ${moveName} failed`);
		if (after.some(l => /\|-ability\|/.test(l) && /Keystone Legion/.test(l))) add(turn, 'keystone', `${name}'s ${moveName} hit the keystone: ${target} lived at 1 HP and cursed it`);
		/*
		 * Three turns of chip in a row - but a miss is not a bad click.
		 *
		 * Rotom was flagged for "under 10% a hit" over four turns in which it fired
		 * Hydro Pump at a Simisear it was beating and missed twice. The move was
		 * right and the dice were wrong; counting that as a mistake sends the next
		 * fix at the wrong thing.
		 */
		// Old logs put [miss] on the move line itself; newer ones send |-miss|.
		const missed = /\[miss\]/.test(line) || after.some(l => l.startsWith(`|-miss|${side}`));
		if (move.category !== 'Status' && !missed) pending = { turn, mon: name };
	}
	settle();
	// Five-turn windows where the bot achieved almost nothing.
	for (let t = 1; t + 4 <= turn; t++) {
		let sum = 0;
		for (let k = t; k < t + 5; k++) sum += dealt[k] || 0;
		if (sum < 25) { add(t, 'no-progress', `turns ${t}-${t + 4} took ${Math.round(sum)}% in total`); t += 4; }
	}
	return flags;
}

const replays = load();
const totals = {};
let games = 0;
for (const replay of replays) {
	const flags = flagsFor(replay);
	games++;
	for (const f of flags) totals[f.kind] = (totals[f.kind] || 0) + 1;
	if (flags.length || verbose) {
		const won = new RegExp(who, 'i').test((/\|win\|(.+)/.exec(replay.log) || [])[1] || '');
		console.log(`\n=== ${replay.id} (${won ? 'bot won' : 'bot lost'})`);
		for (const f of flags.sort((a, b) => a.turn - b.turn)) console.log(`  T${String(f.turn).padStart(2)} ${f.kind.padEnd(12)} ${f.text}`);
	}
}
console.log(`\n${games} replay(s); flags:`, Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ') || 'none');
