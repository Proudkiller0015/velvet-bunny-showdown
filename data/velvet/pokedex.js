'use strict';
/**
 * Samantha.
 *
 * 250 in every stat, which is roughly twice what the strongest legendary in the
 * game manages and is the point - she is not balanced against anything and is
 * not meant to be. She exists only inside this mod, so the only place she can be
 * brought is the format that uses it.
 *
 * The negative `num` is the convention for a Pokemon that is not in the games:
 * it cannot collide with a real species number, and the client falls back to a
 * substitute sprite rather than fetching somebody else's artwork.
 */

exports.Pokedex = {
	/**
	 * Nuzleaf, after the sale went through.
	 *
	 * 10 / 190 / 10 / 190 / 10 / 190 is the joke and the design at once: it comes
	 * back with no interest whatsoever in surviving, only in getting even. Six
	 * hundred to a base total, every point of it spent on hitting first and
	 * hardest, and 10 HP behind 10 defences means anything that lands at all
	 * takes it straight back out.
	 *
	 * `battleOnly` is what keeps it off the teambuilder. A battle-only forme is
	 * refused by the validator with "Nuzleaf-SOLD is a battle-only forme", which
	 * is exactly right: this is not a Pokemon anybody brings, it is a Pokemon
	 * that happens to somebody. The only way in is a Nuzleaf fainting with a
	 * Broken Pact - see data/velvet/items.js.
	 */
	nuzleafsold: {
		num: -2,
		gen: 9,
		name: "Nuzleaf-SOLD",
		baseSpecies: "Nuzleaf",
		forme: "SOLD",
		types: ["Grass", "Dark"],
		baseStats: { hp: 10, atk: 190, def: 10, spa: 190, spd: 10, spe: 190 },
		abilities: { 0: "No Refunds" },
		// Nuzleaf's own, unchanged: it is the same Pokemon, wearing a sign.
		heightm: 1,
		weightkg: 28,
		color: "Brown",
		eggGroups: ["Field", "Grass"],
		// No prevo, no evos, the way a Mega carries none: this is a state a
		// Nuzleaf is in, not a step in the line, and the builder should not be
		// offering it as one.
		//
		// And not `battleOnly` either, which is the marker this obviously wants.
		// A battle-only forme with no required ability, item or move is quietly
		// rewritten to its base species by the validator - so picking
		// Nuzleaf-SOLD in the builder handed back a plain Nuzleaf and said
		// nothing. `isNonstandard` refuses it out loud instead, which is the same
		// marker Samantha carries, and the forme change in battle does not care
		// about either: nothing validates a formeChange.
		isNonstandard: "Custom",
		tier: "Illegal",
	},

	samantha: {
		num: -1,
		name: "Samantha",
		types: ["Dark", "Fairy"],
		// She.
		genderRatio: { M: 0, F: 1 },
		baseStats: { hp: 250, atk: 250, def: 250, spa: 250, spd: 250, spe: 250 },
		abilities: { 0: "Queen Wrath", 1: "Queen's Morph" },
		heightm: 1.7,
		weightkg: 54,
		color: "Black",
		// Nothing to breed with and nothing to evolve from or into.
		eggGroups: ["Undiscovered"],
	},
};
