'use strict';
/**
 * Old-generation mechanics brought back into RP (the owner, 29 Sep 2026).
 *
 *   Belly Drum    Gen 2's: at half HP or less it doesn't fail - it raises Attack by
 *                 2 and costs nothing. Above half HP it is the usual half HP for +6.
 *   Recharging    Gen 1's: Hyper Beam and every other recharge move skips the
 *                 recharge turn when it knocks the target out.
 */

exports.moves = (data) => {
	const belly = data.bellydrum;
	if (belly) {
		data.bellydrum = {
			...belly,
			onHit(target) {
				if (target.boosts.atk >= 6 || target.maxhp === 1) return false;
				if (target.hp <= target.maxhp / 2) {
					this.boost({ atk: 2 }, target);
					return;
				}
				this.directDamage(target.maxhp / 2);
				this.boost({ atk: 12 }, target);
			},
			shortDesc: "User loses 50% max HP. Maximizes Attack. At 50% HP or less: +2 Atk, no HP cost.",
			desc: "Raises the user's Attack by 12 stages in exchange for the user losing 1/2 of its maximum HP, rounded down. If the user has 1/2 of its maximum HP or less, it instead raises its Attack by 2 stages and loses no HP, as in Generation 2. Fails if the user's Attack is already +6.",
		};
	}
	for (const [id, move] of Object.entries(data)) {
		if (!move || !move.flags || !move.flags.recharge) continue;
		const own = move.onAfterMove;
		data[id] = {
			...move,
			shortDesc: "User cannot move next turn, unless this knocks the target out.",
			desc: "If this move is successful, the user must recharge on the following turn and cannot select a move - unless it knocked the target out, as in Generation 1, in which case there is no recharge turn.",
			// Gen 1: a knockout means no recharge turn.
			onAfterMove(pokemon, target, activeMove) {
				if (own) own.call(this, pokemon, target, activeMove);
				if (target && (target.fainted || !target.hp) && pokemon.volatiles['mustrecharge']) {
					pokemon.removeVolatile('mustrecharge');
					this.add('-message', `${pokemon.name} doesn't need to recharge after the knockout!`);
				}
			},
		};
	}
	return data;
};

// For the client's move descriptions (scripts/build-buffs.js): every move this file changes.
exports.CHANGED_MOVES = ['bellydrum', 'hyperbeam', 'gigaimpact', 'blastburn', 'frenzyplant', 'hydrocannon', 'rockwrecker', 'roaroftime', 'prismaticlaser', 'eternabeam', 'meteorassault'];
