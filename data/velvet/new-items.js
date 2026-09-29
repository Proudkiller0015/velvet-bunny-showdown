'use strict';
/**
 * New items for every Pokemon (the owner, 29 Sep 2026).
 *
 *   Ultra Shard   one use: the first time the holder knocks out a Pokemon with a
 *                 move, Beast Boost triggers (its highest stat +1) and the shard
 *                 shatters.
 *
 * Positive numbers past the Z-A stones and the trio's items, and no 'Past' flag:
 * National Dex treats a negative or nonstandard item as not existing.
 */

exports.items = (data) => {
	data.ultrashard = {
		num: 3005, gen: 9, name: 'Ultra Shard', spritenum: 687, isNonstandard: null,
		fling: { basePower: 30 },
		// Beast Boost's own handler, then the shard is used up.
		onSourceAfterFaint(length, target, source, effect) {
			if (!effect || effect.effectType !== 'Move' || !source || source.item !== 'ultrashard') return;
			const bestStat = source.getBestStat(true, true);
			if (source.useItem()) {
				this.add('-message', `${source.name}'s Ultra Shard shattered, unleashing its power!`);
				this.boost({ [bestStat]: length }, source, source, this.dex.items.get('ultrashard'));
			}
		},
		desc: "Single use. The first time the holder knocks out a Pokemon with a move, its highest stat is raised by 1 stage (as Beast Boost), then this item is used up.",
		shortDesc: "Single use: after the holder KOs with a move, its highest stat +1 (Beast Boost).",
	};
	return data;
};
exports.ITEM_IDS = ['ultrashard'];
