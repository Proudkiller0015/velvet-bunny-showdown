'use strict';
/**
 * Type Gems, back in RP (the owner, 29 Sep 2026: "unban gems").
 *
 * Scarlet and Violet kept only the Normal Gem; the other seventeen are 'Past', which
 * National Dex reads as "does not exist in Gen 9". Clearing the flag is all it
 * takes - their handlers are still in the dex: a one-use boost to the first move of
 * their type. The builder is told through scripts/build-buffs.js (`unlocked.items`),
 * or it would go on calling them illegal.
 *
 * The boost is Gen 5's 1.5x, not Gen 6's 1.3x (the owner, 14 Oct 2026: they were
 * announced as Gen 5 Gems). It lives on the shared "gem" condition, so every Gem gets it.
 */

const GEMS = ['bug', 'dark', 'dragon', 'electric', 'fairy', 'fighting', 'fire', 'flying', 'ghost', 'grass', 'ground', 'ice', 'poison', 'psychic', 'rock', 'steel', 'water'].map(t => t + 'gem');

exports.items = (data) => {
	for (const id of GEMS) {
		if (data[id]) data[id] = { ...data[id], isNonstandard: null };
	}
	return data;
};
exports.conditions = (data) => {
	if (data.gem) {
		data.gem = {
			...data.gem,
			onBasePower(basePower, user, target, move) {
				this.debug('Gem Boost');
				return this.chainModify(1.5);
			},
		};
	}
	return data;
};
exports.GEMS = GEMS;
