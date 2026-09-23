'use strict';
/**
 * Teach the AI's copy of the Pokemon data about everything this server added.
 *
 * The AI plans with @smogon/calc on top of @pkmn/dex, a separate copy of the
 * game data that has never heard of our moves or abilities. Asked about Pyre
 * Strike, Soul Toll or Oxidize it answered "no such move", so every damage
 * estimate for them was 0 and every lookup of their priority, flags or effects
 * came back empty: a bot carrying our signature attacks believed they did
 * nothing. (Found when Oxidize's Steel special case turned out never to run -
 * the move had already been judged powerless before it got there.)
 *
 * So the patched Showdown dex - the one the battle itself uses - is copied into
 * @pkmn/dex's tables before anything reads them: every move and ability it has
 * that @pkmn/dex does not (ours, and newer ones like Aura Guard), and our changes
 * to existing moves. Must run before the first `Dex.forGen(...)` or
 * `new Generations(...)`, which cache what they see.
 */

const MOVE_FIELDS = [
	'num', 'name', 'type', 'category', 'basePower', 'accuracy', 'pp', 'priority', 'flags', 'target',
	'secondary', 'secondaries', 'self', 'drain', 'recoil', 'mindBlownRecoil', 'multihit', 'status',
	'boosts', 'volatileStatus', 'sideCondition', 'forceSwitch', 'heal', 'ignoreImmunity',
	'breaksProtect', 'selfSwitch', 'willCrit', 'critRatio', 'desc', 'shortDesc',
];

/*
 * The same for Pokemon. A form this server added - the Witching Hour Mega
 * Banette and whatever comes after it - is not in @pkmn/dex either, and the
 * calculator cannot even build a Pokemon it has no base stats for: it threw on
 * `baseStats.hp` and the AI fell back to "this move does nothing", for every
 * move, on both sides. So our species are copied in the same way.
 */
const SPECIES_FIELDS = [
	'num', 'name', 'types', 'baseStats', 'abilities', 'weightkg', 'heightm', 'baseSpecies', 'forme',
	'prevo', 'evos', 'evoLevel', 'evoType', 'evoItem', 'evoCondition', 'eggGroups', 'gender', 'genderRatio',
	'requiredItem', 'requiredMove', 'requiredAbility', 'changesFrom', 'otherFormes', 'formeOrder',
	'canGigantamax', 'baseForme', 'cosmeticFormes', 'maxHP',
];

let patched = false;

function patchPkmnData() {
	if (patched) return;
	patched = true;
	let Showdown;
	try {
		Showdown = require('./rp-dex')();
	} catch (e) {
		return;   // no server data here (a stripped-down test): nothing to copy
	}
	const Pkmn = require('@pkmn/dex').Dex;
	const moves = Pkmn.data.Moves;
	const abilities = Pkmn.data.Abilities;
	const species = Pkmn.data.Species;

	let changedMoves = [];
	try {
		changedMoves = (require('pokemon-showdown/dist/data/velvet/unnerfs.js').CHANGED || {}).moves || [];
	} catch (e) { /* the package was not set up with our data */ }

	for (const move of Showdown.moves.all()) {
		if (!move.exists) continue;
		const ours = move.num < 0;
		if (!ours && moves[move.id] && !changedMoves.includes(move.id)) continue;
		const row = { gen: 9 };
		for (const field of MOVE_FIELDS) if (move[field] !== undefined) row[field] = move[field];
		moves[move.id] = Object.assign({}, moves[move.id] || {}, row);
		delete moves[move.id].isNonstandard;
	}
	for (const ability of Showdown.abilities.all()) {
		if (!ability.exists || abilities[ability.id]) continue;
		abilities[ability.id] = { num: ability.num, name: ability.name, rating: ability.rating || 0, shortDesc: ability.shortDesc, gen: 9 };
	}
	/*
	 * Only the forms @pkmn/dex has never heard of. A Pokemon it already knows is
	 * left alone even when this server changed its stats or types, because those
	 * changes belong to the RP formats and the AI plays official ones too; a form
	 * that exists nowhere else is ours by definition.
	 */
	for (const mon of Showdown.species.all()) {
		if (!mon.exists || species[mon.id]) continue;
		const row = { gen: 9 };
		for (const field of SPECIES_FIELDS) if (mon[field] !== undefined) row[field] = mon[field];
		species[mon.id] = row;
		// The base form has to own it, or the calculator cannot reach the form at all.
		const base = mon.baseSpecies && mon.baseSpecies !== mon.name ? Pkmn.species.get(mon.baseSpecies) : null;
		const baseRow = base && base.exists ? species[base.id] : null;
		if (baseRow) {
			if (!(baseRow.otherFormes || []).includes(mon.name)) baseRow.otherFormes = [...(baseRow.otherFormes || []), mon.name];
			if (!(baseRow.formeOrder || []).includes(mon.name)) baseRow.formeOrder = [...(baseRow.formeOrder || [base.name]), mon.name];
		}
	}
}

module.exports = { patchPkmnData };
