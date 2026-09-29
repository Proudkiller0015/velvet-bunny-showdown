'use strict';
/**
 * Type Gems, back in RP (the owner, 29 Sep 2026: "unban gems").
 *
 * Scarlet and Violet kept only the Normal Gem; the other seventeen are 'Past', which
 * National Dex reads as "does not exist in Gen 9". Clearing the flag is all it
 * takes - their handlers are still in the dex: a one-use 1.3x boost to the first
 * move of their type (the Gen 6+ number). The builder is told through
 * scripts/build-buffs.js (`unlocked.items`), or it would go on calling them illegal.
 */

const GEMS = ['bug', 'dark', 'dragon', 'electric', 'fairy', 'fighting', 'fire', 'flying', 'ghost', 'grass', 'ground', 'ice', 'poison', 'psychic', 'rock', 'steel', 'water'].map(t => t + 'gem');

exports.items = (data) => {
	for (const id of GEMS) {
		if (data[id]) data[id] = { ...data[id], isNonstandard: null };
	}
	return data;
};
exports.GEMS = GEMS;
