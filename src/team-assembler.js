'use strict';
/**
 * Six Pokemon that make a team, from whatever pool there is to choose from.
 *
 * Every automated team on this server goes through here: a character's box for
 * the RP bot's !preset, a trainer's line-up in RP encounters, and the ladder and
 * lobby bots. Each gives its own pool and rules; the thinking is shared.
 *
 *   1. Every candidate gets a set per role it can play (src/role-sets.js):
 *      Garchomp as a Stealth Rock lead or a Swords Dance sweeper.
 *   2. A local search picks which candidates, in which roles, score best on the
 *      teambuilding checklist (src/team-logic.js) plus raw strength - so a much
 *      weaker Pokemon is not taken just to patch a weakness, and six strong
 *      Pokemon that all lose to one Fire move are not taken either.
 *   3. Then the checklist's fixed slots: exactly one Stealth Rock, hazard
 *      removal when the team takes heavy rock damage, taught to whoever learns
 *      it and loses the least by it.
 *   4. Items by role, from a bag when there is one, defensive members first.
 *
 * How strict the checklist is comes from the caller: `stage` 'movesets' (only
 * good sets), 'basics' (no pile of shared weaknesses, both attacking sides) or
 * 'full'. RP trainers scale it by badges.
 */

const RS = require('./role-sets');
const TL = require('./team-logic');

const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** How much a move is worth keeping on a set, for choosing which one to replace. */
function keepValue(dex, set, index) {
	const species = dex.species.get(set.species);
	const move = dex.moves.get(set.moves[index]);
	const role = set.role || '';
	if (move.category !== 'Status') {
		const sameType = set.moves.filter(n => dex.moves.get(n).category !== 'Status' && dex.moves.get(n).type === move.type).length;
		const attacks = set.moves.filter(n => dex.moves.get(n).category !== 'Status').length;
		if (attacks <= 1) return 1000;
		return RS.attackValue(species, move) * (sameType > 1 ? 0.5 : 1) + (move.num < 0 ? 60 : 0);
	}
	if (RS.RECOVERY.includes(move.id) && (RS.BULKY_ROLES.includes(role) || RS.SUPPORT_ROLES.includes(role))) return 500;
	if (RS.SETUP.includes(move.id) && RS.SETUP_ROLES.includes(role)) return 500;
	if (move.num < 0) return 400;
	return 90;
}

/** Give a set one of `moveIds` if it can learn one, replacing what it misses least. */
function teach(dex, set, moveIds, legal) {
	if (set.moves.some(m => moveIds.includes(toID(m)))) return true;
	const pool = legal ? new Set([...legal].map(toID)) : RS.learnable(dex, dex.species.get(set.species));
	const id = moveIds.find(m => pool.has(m));
	if (!id) return false;
	const name = dex.moves.get(id).name;
	if (set.moves.length < 4) { set.moves.push(name); return true; }
	let worst = 0;
	for (let i = 1; i < set.moves.length; i++) if (keepValue(dex, set, i) < keepValue(dex, set, worst)) worst = i;
	if (keepValue(dex, set, worst) >= 500) return false;
	set.moves[worst] = name;
	return true;
}

/** Take `moveIds` off a set, putting back the best move of its role pool it lacks. */
function untrain(dex, set, moveIds, legal) {
	const index = set.moves.findIndex(m => moveIds.includes(toID(m)));
	if (index < 0) return;
	const species = dex.species.get(set.species);
	const roles = RS.roleSets(dex, set.species, legal);
	const pool = ((roles.find(r => r.role === set.role) || roles[0] || {}).movepool || [])
		.map(n => dex.moves.get(n))
		.filter(m => !moveIds.includes(m.id) && !set.moves.some(x => toID(x) === m.id))
		.sort((a, b) => RS.attackValue(species, b) - RS.attackValue(species, a));
	if (pool.length) set.moves[index] = pool[0].name; else set.moves.splice(index, 1);
}

/**
 * candidates: [{ species, level?, strength? (any scale, higher is better), legal? (Set of move ids), ref? }]
 * options:
 *   size       how many to pick (6)
 *   stage      'movesets' | 'basics' | 'full' (the checklist's strictness)
 *   themed     a type specialist: shared weaknesses are the point, not a flaw
 *   rng        for variety between builds
 *   items      false (none), true (any, by role), or { bag: { itemid: count } }
 *   strengthWeight   how much raw strength counts against the checklist (25)
 *   roles      at most this many roles tried per candidate (3)
 *   fixed      candidates that must be on the team (a trainer's ace)
 *
 * Returns [{ ...set, ref, level }]: species, role, ability, item, moves, nature, evs, teraType.
 */
function assemble(dex, candidates, options = {}) {
	const {
		size = 6, stage = 'full', themed = false, rng = Math.random, items = true,
		strengthWeight = 25, roles = 3, fixed = [], maxEvaluations = 4000,
	} = options;
	const usable = candidates.filter(c => dex.species.get(c.species).exists);
	if (!usable.length) return [];
	const strongest = Math.max(...usable.map(c => c.strength || 1)) || 1;

	// Every (candidate, role) option, built once.
	const options_ = new Map();
	for (const c of usable) {
		const found = RS.roleSets(dex, c.species, c.legal || null).slice(0, roles);
		const built = [];
		for (const r of found) {
			const set = RS.buildSet(dex, c.species, { role: r.role, rng, level: c.level || 100, items: false, legal: c.legal || null });
			if (set && !built.some(b => b.moves.slice().sort().join() === set.moves.slice().sort().join())) built.push(set);
		}
		if (built.length) options_.set(c, built);
	}
	const pool = usable.filter(c => options_.has(c));
	if (!pool.length) return [];

	const value = picks => {
		const sets = picks.map(([c, i]) => options_.get(c)[i]);
		const logic = stage === 'movesets' ? 0 : TL.score(dex, sets, { stage, themed }).score;
		const power = picks.reduce((n, [c]) => n + (c.strength || 1) / strongest, 0) / Math.max(1, picks.length);
		// Two of the same role is fine; four setup sweepers and no support is not a team.
		const roleCounts = {};
		for (const s of sets) roleCounts[s.role] = (roleCounts[s.role] || 0) + 1;
		const crowding = Object.values(roleCounts).reduce((n, k) => n + Math.max(0, k - 2) * 2, 0);
		return logic + strengthWeight * power - crowding + rng() * 0.01;
	};

	// Start from the strongest, fixed members first, each in a random role of theirs.
	const byStrength = pool.slice().sort((a, b) => (b.strength || 1) - (a.strength || 1));
	const start = [...fixed.filter(c => pool.includes(c)), ...byStrength.filter(c => !fixed.includes(c))].slice(0, size);
	let picks = start.map(c => [c, Math.floor(rng() * options_.get(c).length)]);
	let best = value(picks);
	let evaluations = 1;

	for (let pass = 0, improved = true; improved && pass < 8 && evaluations < maxEvaluations; pass++) {
		improved = false;
		for (let slot = 0; slot < picks.length && evaluations < maxEvaluations; slot++) {
			const [current] = picks[slot];
			const locked = fixed.includes(current);
			for (const c of locked ? [current] : pool) {
				if (c !== current && picks.some(([p]) => p === c)) continue;
				const count = options_.get(c).length;
				for (let i = 0; i < count; i++) {
					if (c === current && i === picks[slot][1]) continue;
					const trial = picks.slice();
					trial[slot] = [c, i];
					const v = value(trial);
					evaluations++;
					if (v > best + 0.5) { best = v; picks = trial; improved = true; }
				}
			}
		}
	}

	const team = picks.map(([c, i]) => ({ ...options_.get(c)[i], moves: options_.get(c)[i].moves.slice(), ref: c.ref, level: c.level || 100, legal: c.legal || null }));

	// One Stealth Rock is all a team uses, at any strictness.
	if (stage !== 'movesets') {
		const report = TL.analyze(dex, team);
		for (const set of team.filter(s => report.stealthRock.includes(s.species)).slice(1)) untrain(dex, set, TL.MOVES.stealthRock, set.legal);
	}
	if (stage === 'full' && team.length >= 3) {
		let report = TL.analyze(dex, team);
		if (!report.stealthRock.length) {
			// The bulkiest, supportive members set rocks best.
			const setters = team.slice().sort((a, b) => supportRank(b) - supportRank(a));
			for (const set of setters) if (teach(dex, set, TL.MOVES.stealthRock, set.legal)) break;
		} else {
			for (const set of team.filter(s => report.stealthRock.includes(s.species)).slice(1)) untrain(dex, set, TL.MOVES.stealthRock, set.legal);
		}
		report = TL.analyze(dex, team);
		if (report.rockWeak.length >= 2 && !report.removal.length && report.style !== 'hyper offense') {
			const helpers = team.filter(s => !report.stealthRock.includes(s.species)).sort((a, b) => supportRank(b) - supportRank(a));
			for (const set of helpers) if (teach(dex, set, TL.MOVES.removal, set.legal)) break;
		}
	}

	if (items) assignItems(dex, team, items === true ? null : items.bag || {});
	return team.map(({ legal, ...set }) => set);
}

function supportRank(set) {
	return RS.SUPPORT_ROLES.includes(set.role) ? 3 : RS.BULKY_ROLES.includes(set.role) ? 2 : set.role === 'Fast Attacker' ? 1 : 0;
}

/** Items by role; with a bag, only what is in it, as many as there are. */
function assignItems(dex, team, bag) {
	const report = TL.analyze(dex, team);
	const left = bag ? { ...bag } : null;
	const order = team.slice().sort((a, b) => report.defensive.includes(b.species) - report.defensive.includes(a.species) || supportRank(b) - supportRank(a));
	for (const set of order) {
		const species = dex.species.get(set.species);
		const side = TL.attackSide(dex, set) === 'special' ? 'Special' : 'Physical';
		const role = { role: set.role };
		let allowed = null;
		if (left) {
			allowed = new Set(Object.entries(left).filter(([, n]) => n > 0).map(([id]) => id).filter(id => dex.items.get(id).exists));
			if (!allowed.size) { set.item = ''; continue; }
		}
		set.item = RS.itemFor(dex, species, role, set.moves, side, allowed ? new Set(heldOnly(dex, allowed)) : null);
		if (left && set.item) left[toID(set.item)]--;
	}
}

/** Only items worth holding in battle (no balls, no evolution stones). */
function heldOnly(dex, ids) {
	return [...ids].filter(id => {
		const item = dex.items.get(id);
		return item.exists && !item.isPokeball && !item.megaStone && !item.zMove && !/stone$/.test(id) && !item.isGem;
	});
}

module.exports = { assemble, teach, untrain, assignItems, keepValue };
