'use strict';
/**
 * Corrosive Gas (the owner, 13 Nov 2026).
 *
 *   Poison    every Pokemon it hits is poisoned (regular poison), as well as losing its item.
 *             The gas eats through Steel types' immunity to poison; Poison types stay immune,
 *             and so does anything already statused or protected by Safeguard, Misty Terrain,
 *             Immunity and the like (those run on the SetStatus event, which still runs).
 *   No fail   it no longer fails on a Pokemon holding no item: that one is still poisoned.
 *   Legal     Scarlet and Violet made it unobtainable. Every RP tier unbans it
 *             ('+Corrosive Gas', config/custom-formats.js); native formats keep the official
 *             rules and the draft stays frozen for the season.
 *   Learners  its Generation 8 tutor learners keep it (Gengar's line, both Weezing, Salazzle,
 *             Toxicroak, Garbodor, Tentacruel, Skuntank, Vileplume, Mew, Nihilego, Guzzlord);
 *             balance-patch-1.js NEWER_MOVES adds their pre-evolutions, the gas-themed Pokemon
 *             and the Poison types it suits.
 */

exports.moves = (data) => {
	if (!data.corrosivegas) return data;
	data.corrosivegas = {
		...data.corrosivegas,
		onHit(target, source) {
			const item = target.takeItem(source);
			if (item) {
				this.add('-enditem', target, item.name, '[from] move: Corrosive Gas', `[of] ${source}`);
			}
			// setStatus would replace a status the target already has, so a statused target is left alone.
			if (target.status) return;
			// Steel types too: their immunity is skipped. Poison types keep theirs (checked as usual).
			target.setStatus('psn', source, this.effect, !target.hasType('Poison'));
		},
		shortDesc: "Removes adjacent Pokemon's items and poisons them, Steel types too.",
		desc: "Each adjacent Pokemon loses its held item and is poisoned. Steel-type Pokemon can be poisoned by this move; Poison-type Pokemon cannot. The move does not fail when a target holds no item.",
	};
	return data;
};

exports.CHANGED_MOVES = ['corrosivegas'];
