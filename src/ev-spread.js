'use strict';

/*
 * EV spreads that fit the level (owner, 12 Oct 2026).
 *
 * Below level 100 a stat only goes up every few EVs, so a 252 Atk / 252 Spe set
 * at level 50 gets exactly the same Attack and Speed from 248 of each, and the
 * EVs past that do nothing. fitToLevel keeps every stat the spread was built for,
 * cut down to the fewest EVs that still reach it, and puts what that frees into
 * HP and the defences. The spread it starts from is never changed, so as the
 * Pokemon levels up it goes back toward the full 252 by itself.
 *
 * spreadFor is how a trainer spends its EVs: the stats that matter to the set
 * first, instead of the same handful in all six.
 */

const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const MAX_EV = 252;
const MAX_TOTAL = 508;
const BOMBS = new Set(['explosion', 'selfdestruct', 'mistyexplosion']);

function statAt(base, iv, ev, level, hp) {
	const core = Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100);
	return hp ? core + level + 10 : core + 5;
}

/** The same Pokemon, with its EVs fitted to its level. A new evs object; the set is not touched. */
function fitToLevel(dex, set) {
	if (!set || !set.evs || typeof set.evs !== 'object') return set && set.evs;
	const species = dex.species.get(set.species);
	if (!species.exists) return set.evs;
	const level = Number(set.level) || 100;
	const ivOf = k => (set.ivs && set.ivs[k] != null ? Number(set.ivs[k]) : 31);
	const at = (k, ev) => statAt(species.baseStats[k], ivOf(k), ev, level, k === 'hp');
	const evs = {};
	let total = 0;
	for (const k of STATS) {
		let ev = Math.min(MAX_EV, Math.max(0, Math.floor((Number(set.evs[k]) || 0) / 4) * 4));
		const want = at(k, ev);
		while (ev >= 4 && at(k, ev - 4) === want) ev -= 4;
		evs[k] = ev;
		total += ev;
	}
	const budget = Math.min(MAX_TOTAL, STATS.reduce((sum, k) => sum + Math.min(MAX_EV, Number(set.evs[k]) || 0), 0));
	let free = Math.floor((budget - total) / 4) * 4;
	// Shedinja's HP is 1 whatever it gets.
	const bulk = species.maxHP === 1 ? ['def', 'spd'] : ['hp', 'def', 'spd'];
	while (free > 0) {
		let best = null;
		for (const k of bulk) {
			let step = 4;
			while (evs[k] + step <= MAX_EV && step <= free && at(k, evs[k] + step) === at(k, evs[k])) step += 4;
			if (evs[k] + step > MAX_EV || step > free) continue;
			if (!best || step < best.step) best = { k, step };
		}
		if (!best) break;
		evs[best.k] += best.step;
		free -= best.step;
	}
	return evs;
}

/** Which attacking stat a set uses: its bomb's, or the side most of its attacks are on. */
function attackStat(dex, set) {
	const moves = (set.moves || []).map(m => dex.moves.get(m));
	const bomb = moves.find(m => BOMBS.has(m.id));
	if (bomb) return bomb.category === 'Special' ? 'spa' : 'atk';
	const phys = moves.filter(m => m.category === 'Physical').length;
	const spec = moves.filter(m => m.category === 'Special').length;
	if (phys !== spec) return phys > spec ? 'atk' : 'spa';
	const b = dex.species.get(set.species).baseStats;
	return b.atk >= b.spa ? 'atk' : 'spa';
}

const isBomber = (dex, set) => (set.moves || []).some(m => BOMBS.has(dex.moves.get(m).id));

/**
 * A trainer's EVs: `budget` in all, in the order the set wants them.
 * A bomber maxes the stat its bomb uses; a scarfer then Speed, anyone else HP.
 * A wall goes HP and its walling side; a support set (two or more status moves that
 * are not setup) HP and its better defence; an attacker its attacking stat, then Speed.
 */
function spreadFor(dex, set, budget, { stall = false } = {}) {
	const b = dex.species.get(set.species).baseStats;
	const moves = (set.moves || []).map(m => dex.moves.get(m));
	// Setting up (Swords Dance, Calm Mind) is still attacking; Toxic and Spikes are not.
	const boostsSelf = m => m.target === 'self' && m.boosts && Object.values(m.boosts).some(v => v > 0);
	const status = moves.filter(m => m.category === 'Status' && !BOMBS.has(m.id) && !boostsSelf(m)).length;
	const sturdier = b.def >= b.spd ? 'def' : 'spd';
	const other = sturdier === 'def' ? 'spd' : 'def';
	const hit = attackStat(dex, set);
	let order;
	if (isBomber(dex, set)) order = /scarf/i.test(set.item || '') ? [hit, 'spe', 'hp'] : [hit, 'hp', 'spe'];
	else if (stall) order = ['hp', set.evs && set.evs.def > set.evs.spd ? 'def' : set.evs && set.evs.spd > set.evs.def ? 'spd' : sturdier, other];
	else if (status >= 2) order = ['hp', sturdier, hit];
	else order = [hit, 'spe', 'hp'];
	const evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
	let left = Math.floor(Math.min(MAX_TOTAL, budget) / 4) * 4;
	for (const k of [...order, ...STATS.filter(k => !order.includes(k))]) {
		const give = Math.min(MAX_EV, left);
		evs[k] = give;
		left -= give;
		if (left <= 0) break;
	}
	return evs;
}

/*
 * How many EVs a trainer brings, by badges: something from the start, all of them
 * at eight. A bomber brings twice that, so even the first one hits with a full
 * attacking stat.
 */
const trainerBudget = badges => Math.min(MAX_TOTAL, 128 + 48 * Math.max(0, Number(badges) || 0));
const bomberBudget = badges => Math.min(MAX_TOTAL, 2 * trainerBudget(badges));

module.exports = { fitToLevel, spreadFor, attackStat, isBomber, trainerBudget, bomberBudget, statAt, STATS };
