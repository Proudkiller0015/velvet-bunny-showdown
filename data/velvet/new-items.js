'use strict';
/**
 * New items (the owner, 29 Sep 2026).
 *
 *   Ultra Shard   the Ultra Beasts' Booster Energy: consumed when the holder comes
 *                 in, and its Beast Boost goes off at once (highest stat +1) instead
 *                 of waiting for a knockout. Does nothing without Beast Boost, and
 *                 can't be taken from an Ultra Beast.
 *
 * Positive numbers past the Z-A stones and the trio's items, and no 'Past' flag:
 * National Dex treats a negative or nonstandard item as not existing.
 */

exports.items = (data) => {
	data.ultrashard = {
		num: 3005, gen: 9, name: 'Ultra Shard', spritenum: 687, isNonstandard: null,
		fling: { basePower: 30 },
		// Booster Energy's timing: once the holder is in, and not on a transformed copy.
		onSwitchInPriority: -2,
		onStart(pokemon) {
			this.effectState.started = true;
			this.effect.onUpdate.call(this, pokemon);
		},
		onUpdate(pokemon) {
			if (!this.effectState.started || pokemon.transformed || !pokemon.hasAbility('beastboost')) return;
			const bestStat = pokemon.getBestStat(true, true);
			if (pokemon.useItem()) {
				this.add('-activate', pokemon, 'ability: Beast Boost');
				this.boost({ [bestStat]: 1 }, pokemon, pokemon, this.dex.abilities.get('beastboost'));
			}
		},
		// Like Booster Energy on a Paradox Pokemon: it stays with an Ultra Beast.
		onTakeItem(item, source) {
			return !source.baseSpecies.tags.includes('Ultra Beast');
		},
		desc: "If the holder has Beast Boost, this item is used up when it enters the battle, and Beast Boost raises its highest stat by 1 stage right away. Can't be removed from an Ultra Beast. No effect on anything else.",
		shortDesc: "Beast Boost: used on entry, raises the holder's highest stat by 1 at once.",
	};
	return data;
};
exports.ITEM_IDS = ['ultrashard'];
