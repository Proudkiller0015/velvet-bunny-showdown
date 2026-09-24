'use strict';
/**
 * A team built around the Pokemon under test, out of its peers.
 *
 * The owner's rule: no "one sweeper and five ZU Pokemon carrying it". A result
 * only means something if the tested Pokemon played on a team a person would
 * actually build, so the six come from the same assembler every automated team
 * on this server uses (src/team-assembler.js: role sets, the teambuilding
 * checklist, one Stealth Rock, hazard removal, items by role), with the tested
 * Pokemon fixed on it.
 *
 * Who the other five may be is the coordinator's choice (scripts/tier-sim.js,
 * pickCandidates): Pokemon from the same band of strength - its current tier,
 * one either side - with Smogon's teammate data and this server's own usage
 * weighting the draw, so a Pokemon meets its usual partners (Gliscor with
 * Toxapex-style walls, Kingambit with Great Tusk) and is judged among peers.
 * This file only turns a candidate list into six legal sets.
 *
 * What the validator would normally enforce is enforced here, because
 * BattleStream never validates a team:
 *
 *   - one of each species (Species Clause: by dex number, so Rotom-Wash and
 *     Rotom-Heat cannot share a team);
 *   - at most one Mega or Primal, since only one can transform anyway;
 *   - no OHKO moves and no evasion moves (OHKO Clause, Evasion Moves Clause);
 *   - an entry that needs an item has it: a Mega its stone, Ogerpon its mask,
 *     and a Mega keeps an ability of its base forme, which is what it has
 *     until it evolves.
 */

const TA = require('../team-assembler');
const RS = require('../role-sets');

const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const BANNED_MOVES = new Set(['fissure', 'guillotine', 'horndrill', 'sheercold', 'doubleteam', 'minimize', 'acupressure']);

/**
 * Keep one per dex number and one Mega, the focus winning every tie.
 * `entries` are pool entries (src/tier-sim/pool.js), focus first.
 */
function legalCandidates(entries) {
	const out = [];
	const nums = new Set();
	let megas = 0;
	for (const e of entries) {
		if (!e || nums.has(e.num)) continue;
		if (e.mega && megas >= 1) continue;
		nums.add(e.num);
		if (e.mega) megas++;
		out.push(e);
	}
	return out;
}

/**
 * entries: [focus, ...candidates] (pool entries). strengthOf(entry) -> positive number.
 * Returns { names: [entry names x6], sets: [PS sets x6] } or null.
 */
function draftTeam(dex, entries, { rng = Math.random, strengthOf = e => e.bst, maxEvaluations = 1500, archetype = null } = {}) {
	const usable = legalCandidates(entries);
	if (usable.length < 6) return null;
	const byName = new Map();
	const candidates = usable.map(e => {
		// The Mega's own name, so the checklist sees its Mega typing and stats; turned
		// back into "base Pokemon holding the stone" below.
		const c = { species: e.name, level: 100, strength: Math.max(1, strengthOf(e)), ref: e.name };
		byName.set(e.name, e);
		return c;
	});
	const focus = candidates[0];
	let built;
	try {
		built = TA.assemble(dex, candidates, { size: 6, stage: 'full', rng, items: true, fixed: [focus], maxEvaluations, archetype });
	} catch (e) {
		return null;
	}
	if (!built || built.length < 6) return null;
	const names = [];
	const sets = [];
	for (let i = 0; i < built.length; i++) {
		const set = built[i];
		const entry = byName.get(set.ref) || byName.get(set.species);
		if (!entry) return null;
		const species = dex.species.get(entry.species);
		let ability = set.ability;
		if (entry.mega || !Object.values(species.abilities).includes(ability)) {
			const roles = RS.roleSets(dex, species.name);
			const own = Object.values(species.abilities).filter(Boolean);
			ability = ((roles[0] && roles[0].abilities) || []).find(a => own.includes(a)) || own[0] || '';
		}
		let item = entry.item || set.item || '';
		if (dex.items.get(item).zMove) item = 'Leftovers';
		const moves = set.moves.filter(m => !BANNED_MOVES.has(toID(m)));
		if (!moves.length) return null;
		names.push(entry.name);
		sets.push({
			// A short nickname: Showdown cuts names at 18 characters, and "Tatsugiri-Stretchy-Mega" is not.
			name: `M${i + 1}`,
			species: species.name,
			item,
			ability,
			moves,
			nature: set.nature || 'Serious',
			evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...(set.evs || {}) },
			ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31, ...(set.ivs || {}) },
			level: 100,
			gender: '',
		});
	}
	// Lead first, the way the ladder bot sends its teams (TA.leadOrder); names follow the sets.
	const order = TA.leadOrder(dex, sets);
	return { names: order.map(s => names[sets.indexOf(s)]), sets: order.map((s, i) => ({ ...s, name: `M${i + 1}` })) };
}

module.exports = { draftTeam, legalCandidates, BANNED_MOVES };
