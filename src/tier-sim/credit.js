'use strict';
/**
 * What each Pokemon did in a game, read off the battle log.
 *
 * The owner's rule for this tier list is that a Pokemon is credited for what it
 * does for the team, not for its knockouts alone: a Clefable that sets rocks,
 * spreads Knock Offs and Wishes a teammate back to health wins games without
 * ever topping a damage chart. So every appearance gets a line of numbers, and
 * the rating code learns from the games themselves which of them actually go
 * with winning (src/tier-sim/rating.js, utility weights) instead of trusting a
 * weight somebody made up here.
 *
 * Attribution is the hard part, and the rules are deliberately simple and
 * written down so the numbers can be argued with:
 *
 *   - Damage with no [from] belongs to whoever last used a move from the other
 *     side (the attack that caused it).
 *   - Hazard damage belongs to the Pokemon that laid that hazard on that side;
 *     poison and burn damage to whoever inflicted the status; Rocky Helmet,
 *     Rough Skin and anything else with an [of] on the other side to that [of].
 *   - Weather, recoil, Life Orb, confusion: nobody. Credit for those would be
 *     noise at best and a reward for a teammate's self-damage at worst.
 *   - A knockout goes to whoever dealt the damage that fainted it; a Pokemon
 *     that faints to its own recoil gives nobody a KO.
 *   - "Absorbed" is the switch-in job: came in during a turn (not to replace a
 *     fainted teammate), was hit by the other side that same turn, and was
 *     still standing at the end of it.
 *
 * HP is read from the omniscient stream's exact "cur/max" values: a |split|
 * is followed by the exact line and then the rounded public one, and only the
 * exact one is used.
 */

const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** The per-appearance record, in this order. Kept as an array so a game's JSONL line stays short. */
const FIELDS = [
	'dmg',       // % of a foe's HP bar removed, summed (300 = three full bars)
	'kos',
	'hazTurns',  // turns a hazard it laid stayed up on the other side, per kind
	'hazRem',    // hazards it removed from its own side
	'status',    // non-volatile statuses it inflicted
	'pivots',    // times it pivoted out with U-turn, Volt Switch, Parting Shot...
	'support',   // screens, Heal Bell, Wish-healing a teammate (%/25), Tailwind...
	'taken',     // % of its own HP it lost to the other side
	'absorb',    // switch-ins that took a hit and survived the turn
	'turns',     // turns it spent on the field
	'fainted',
	'healed',    // % of its own HP it recovered
	'seen',      // 1 if it ever came onto the field
];

const HAZARDS = { stealthrock: 1, spikes: 1, toxicspikes: 1, stickyweb: 1, gmaxsteelsurge: 1 };
const PIVOT_MOVES = new Set(['uturn', 'voltswitch', 'flipturn', 'teleport', 'partingshot', 'chillyreception', 'shedtail', 'batonpass']);
const SUPPORT_SIDE = new Set(['reflect', 'lightscreen', 'auroraveil', 'tailwind', 'safeguard', 'mist', 'luckychant']);

function hpOf(text) {
	const s = String(text || '').split(' ')[0];
	if (s === '0' || /fnt/.test(text)) return 0;
	const m = /^(\d+)\/(\d+)/.exec(s);
	return m ? Number(m[1]) / Math.max(1, Number(m[2])) : null;
}

/** "p1a: Type: Null" -> { side: 'p1', name: 'Type: Null' } */
function identOf(text) {
	const m = /^(p[12])[a-z]?: (.*)$/.exec(String(text || '').trim());
	return m ? { side: m[1], name: m[2] } : null;
}

function kwargs(parts) {
	const out = {};
	for (const p of parts) {
		const m = /^\[(\w+)\]\s?(.*)$/.exec(p);
		if (m) out[m[1]] = m[2];
	}
	return out;
}

/**
 * lines: the omniscient log. names: { p1: [nick x6], p2: [nick x6] } in team order.
 * Returns { p1: [record x6], p2: [record x6], winner: 'p1'|'p2'|'tie'|null, turns }.
 */
function creditLog(lines, names, playerNames = { p1: 'P1', p2: 'P2' }) {
	const rec = { p1: names.p1.map(() => FIELDS.map(() => 0)), p2: names.p2.map(() => FIELDS.map(() => 0)) };
	const F = Object.fromEntries(FIELDS.map((f, i) => [f, i]));
	const slot = (side, name) => {
		const i = names[side].indexOf(name);
		return i >= 0 ? rec[side][i] : null;
	};
	const foe = side => (side === 'p1' ? 'p2' : 'p1');
	const hp = { p1: {}, p2: {} };                 // name -> fraction
	const active = { p1: null, p2: null };
	const hazards = { p1: {}, p2: {} };            // side it is ON -> kind -> setter { side, name }
	const statusBy = { p1: {}, p2: {} };           // name -> inflicter
	const lastHit = { p1: {}, p2: {} };            // name -> credited damager, or null
	let lastMover = null;                          // { side, name, move }
	let pendingPivot = { p1: null, p2: null };
	let switchedIn = { p1: null, p2: null };       // voluntary mid-turn switch-in this turn
	let hitThisTurn = { p1: false, p2: false };
	let justSwitched = null;
	let turn = 0, winner = null;
	const add = (who, field, n) => { if (!who) return; const r = slot(who.side, who.name); if (r) r[F[field]] += n; };

	const closeTurn = () => {
		for (const side of ['p1', 'p2']) {
			const s = switchedIn[side];
			if (s && hitThisTurn[side] && (hp[side][s] || 0) > 0) add({ side, name: s }, 'absorb', 1);
			switchedIn[side] = null;
			hitThisTurn[side] = false;
			pendingPivot[side] = null;
		}
	};

	for (let i = 0; i < lines.length; i++) {
		let line = lines[i];
		if (line.startsWith('|split|')) { line = lines[i + 1] || ''; i += 2; }
		if (!line.startsWith('|')) continue;
		const parts = line.slice(1).split('|');
		const kind = parts[0];
		const kw = kwargs(parts.slice(1));

		if (kind === 'turn') {
			closeTurn();
			turn = Number(parts[1]) || turn;
			for (const side of ['p1', 'p2']) {
				if (active[side]) add({ side, name: active[side] }, 'turns', 1);
				// Hazards on this side, credited to whoever laid them.
				for (const setter of Object.values(hazards[side])) add(setter, 'hazTurns', 1);
			}
			justSwitched = null;
			continue;
		}
		if (kind === 'switch' || kind === 'drag') {
			const who = identOf(parts[1]);
			if (!who) continue;
			const leaving = active[who.side];
			if (leaving && pendingPivot[who.side] === leaving && (hp[who.side][leaving] || 0) > 0) add({ side: who.side, name: leaving }, 'pivots', 1);
			pendingPivot[who.side] = null;
			// Coming in for a teammate still standing, before the turn is over: a switch-in's job.
			if (kind === 'switch' && turn > 0 && leaving && (hp[who.side][leaving] || 0) > 0) switchedIn[who.side] = who.name;
			active[who.side] = who.name;
			const h = hpOf(parts[3]);
			if (h !== null) hp[who.side][who.name] = h;
			const r = slot(who.side, who.name);
			if (r) r[F.seen] = 1;
			justSwitched = who;
			continue;
		}
		if (kind === 'move') {
			const who = identOf(parts[1]);
			if (!who) continue;
			const move = toID(parts[2]);
			lastMover = { side: who.side, name: who.name, move };
			if (PIVOT_MOVES.has(move)) pendingPivot[who.side] = who.name;
			// A switch-in's job is taking what was aimed at the slot - a Toxic or a
			// Will-O-Wisp as much as an attack - so being targeted counts as the hit.
			const target = identOf(parts[3]);
			if (target && target.side !== who.side && switchedIn[target.side] === target.name) hitThisTurn[target.side] = true;
			justSwitched = null;
			continue;
		}
		if (kind === '-damage') {
			const who = identOf(parts[1]);
			if (!who) continue;
			const now = hpOf(parts[2]);
			if (now === null) continue;
			const before = hp[who.side][who.name] ?? 1;
			hp[who.side][who.name] = now;
			const lost = Math.max(0, before - now);
			let source = null;
			const from = String(kw.from || '');
			const fromId = toID(from.replace(/^(move|item|ability):\s*/, ''));
			if (!kw.from) {
				if (lastMover && lastMover.side !== who.side) source = lastMover;
			} else if (HAZARDS[fromId]) {
				source = hazards[who.side][fromId] || null;
			} else if (['psn', 'tox', 'brn'].includes(fromId)) {
				source = statusBy[who.side][who.name] || null;
			} else if (kw.of) {
				const of = identOf(kw.of);
				if (of && of.side !== who.side) source = of;
			}
			if (source) {
				add(source, 'dmg', lost * 100);
				add(who, 'taken', lost * 100);
				hitThisTurn[who.side] = hitThisTurn[who.side] || !kw.from;
			}
			lastHit[who.side][who.name] = source;
			continue;
		}
		if (kind === '-heal') {
			const who = identOf(parts[1]);
			if (!who) continue;
			const now = hpOf(parts[2]);
			if (now === null) continue;
			const before = hp[who.side][who.name] ?? 1;
			hp[who.side][who.name] = now;
			const gained = Math.max(0, now - before) * 100;
			const wisher = kw.wisher ? kw.wisher.trim() : null;
			if (wisher && wisher !== who.name) add({ side: who.side, name: wisher }, 'support', gained / 25);
			else if (/healing wish|lunar dance/i.test(kw.from || '')) add(null, 'support', 0);
			else add(who, 'healed', gained);
			continue;
		}
		if (kind === 'faint') {
			const who = identOf(parts[1]);
			if (!who) continue;
			hp[who.side][who.name] = 0;
			add(who, 'fainted', 1);
			const by = lastHit[who.side][who.name];
			if (by && by.side !== who.side) add(by, 'kos', 1);
			if (active[who.side] === who.name) pendingPivot[who.side] = null;
			continue;
		}
		if (kind === '-status') {
			const who = identOf(parts[1]);
			if (!who) continue;
			let source = null;
			const from = String(kw.from || '');
			if (kw.of) {
				const of = identOf(kw.of);
				if (of && of.side !== who.side) source = of;
			} else if (!kw.from) {
				// Toxic Spikes poison a grounded Pokemon as it lands, with no [from].
				if (justSwitched && justSwitched.name === who.name && hazards[who.side].toxicspikes) source = hazards[who.side].toxicspikes;
				else if (lastMover && lastMover.side !== who.side) source = lastMover;
			} else if (/^move:/.test(from) && lastMover && lastMover.side !== who.side) {
				source = lastMover;
			}
			if (source) { add(source, 'status', 1); statusBy[who.side][who.name] = source; }
			else statusBy[who.side][who.name] = null;
			continue;
		}
		if (kind === '-sidestart') {
			const side = String(parts[1] || '').slice(0, 2);
			const cond = toID(String(parts[2] || '').replace(/^move:\s*/, ''));
			if (HAZARDS[cond]) {
				if (lastMover && lastMover.side !== side && !hazards[side][cond]) hazards[side][cond] = { side: lastMover.side, name: lastMover.name };
			} else if (SUPPORT_SIDE.has(cond) && lastMover && lastMover.side === side) {
				add(lastMover, 'support', 1);
			}
			continue;
		}
		if (kind === '-sideend') {
			const side = String(parts[1] || '').slice(0, 2);
			const cond = toID(String(parts[2] || '').replace(/^move:\s*/, ''));
			if (!HAZARDS[cond]) continue;
			delete hazards[side][cond];
			let by = kw.of ? identOf(kw.of) : null;
			if (!by && lastMover) by = lastMover;
			if (by && by.side === side) add(by, 'hazRem', 1);
			continue;
		}
		if (kind === '-swapsideconditions') {
			// Court Change: whatever was on each side is now on the other, still the setter's.
			const t = hazards.p1; hazards.p1 = hazards.p2; hazards.p2 = t;
			continue;
		}
		if (kind === '-cureteam') {
			const who = identOf(parts[1]);
			if (who) add(who, 'support', 1);
			continue;
		}
		if (kind === 'win') {
			const name = String(parts[1] || '').trim();
			winner = name === playerNames.p1 ? 'p1' : name === playerNames.p2 ? 'p2' : null;
			continue;
		}
		if (kind === 'tie') { winner = 'tie'; continue; }
	}
	closeTurn();
	for (const side of ['p1', 'p2']) for (const r of rec[side]) for (let k = 0; k < r.length; k++) r[k] = Math.round(r[k]);
	return { p1: rec.p1, p2: rec.p2, winner, turns: turn };
}

module.exports = { creditLog, FIELDS, hpOf, identOf };
