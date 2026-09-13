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
