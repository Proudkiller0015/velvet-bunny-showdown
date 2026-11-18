'use strict';
/**
 * Pokemon Champions' first balance update (announced 17-18 Nov 2026, live in the game on 2 Dec 2026),
 * brought to RP by the owner on 18 Nov 2026: "add the new regulation update buffs without the
 * nerfs/downsides". The official Champions formats get it from Showdown when Showdown does.
 *
 *   Moves      Screech, Steel Wing, Metal Sound and Frost Breath: 100% accuracy.
 *              Rock Slide: 95% accuracy. Champions also cut its flinch chance to 20%; RP keeps 30%
 *              (the owner: "like rockslide 95 accuracy without nerfing flinch").
 *   Abilities  Flash Fire: the Fire boost lasts through Mega Evolution.
 *              Stalwart: also hits through Substitute (it already ignored redirection).
 *   Learners   LEARNS below, exactly the update's list; balance-patch-1.js buildBuffs hands them out.
 *
 * The RP Draft stays on its frozen season data (velvet-draft-s1).
 */

const ACCURACY = { screech: 100, steelwing: 100, metalsound: 100, frostbreath: 100, rockslide: 95 };

exports.moves = (data) => {
	for (const [id, accuracy] of Object.entries(ACCURACY)) {
		if (data[id]) data[id] = { ...data[id], accuracy };
	}
	return data;
};

exports.abilities = (data) => {
	if (data.flashfire) {
		const flashfire = data.flashfire;
		const boost = function (/** @type {number} */ stat, /** @type {any} */ attacker, /** @type {any} */ defender, /** @type {any} */ move) {
			// The boost an earlier form kept (onEnd below) counts as well as the ability itself.
			if (move.type === 'Fire' && (attacker.hasAbility('flashfire') || this.effectState.carried)) {
				this.debug('Flash Fire boost');
				return this.chainModify(1.5);
			}
		};
		data.flashfire = {
			...flashfire,
			onEnd(pokemon) {
				// Mega Evolution: formeChange has already made the species the Mega and is replacing the ability
				// (the base ability is still Flash Fire). The boost stays, as in Champions.
				if (pokemon.species.isMega && pokemon.baseAbility === 'flashfire' && pokemon.volatiles['flashfire']) {
					pokemon.volatiles['flashfire'].carried = true;
					return;
				}
				pokemon.removeVolatile('flashfire');
			},
			condition: {
				...flashfire.condition,
				onModifyAtk: boost,
				onModifySpA: boost,
			},
			shortDesc: "This Pokemon's Fire attacks do 1.5x damage if hit by one Fire move; Fire immunity. Kept after Mega Evolution.",
			desc: "This Pokemon is immune to Fire-type moves. The first time it is hit by a Fire-type move, its attacking stat is multiplied by 1.5 while using a Fire-type attack as long as it remains active and has this Ability. If this Pokemon Mega Evolves, the boost stays. If this Pokemon is frozen, it cannot be defrosted by Fire-type attacks.",
		};
	}
	if (data.stalwart) {
		const stalwart = data.stalwart;
		data.stalwart = {
			...stalwart,
			onModifyMove(move, pokemon, target) {
				if (stalwart.onModifyMove) stalwart.onModifyMove.call(this, move, pokemon, target);
				// Through Substitute only: not through screens, as Infiltrator would be.
				move.flags = { ...move.flags, bypasssub: 1 };
			},
			shortDesc: "This Pokemon's moves ignore redirection and the target's Substitute.",
			desc: "This Pokemon's moves cannot be redirected to a different target by any effect, and they hit the target through its Substitute.",
		};
	}
	return data;
};

/** Who learns what, exactly as the update lists it. */
exports.LEARNS = {
	psychup: [
		'alakazam', 'starmie', 'mrmime', 'mawile', 'altaria', 'castform', 'absol', 'roserade', 'weavile',
		'rotom', 'rotomheat', 'rotomwash', 'rotomfrost', 'rotomfan', 'rotommow',
		'liepard', 'musharna', 'audino', 'cofagrigus', 'slurpuff', 'drampa', 'annihilape',
	],
	slackoff: ['emboar'],
	roost: ['beedrill', 'hydreigon'],
	tailwind: ['emolga'],
	wonderroom: ['umbreon'],
	playrough: ['vaporeon', 'jolteon', 'flareon', 'espeon', 'umbreon', 'leafeon', 'glaceon'],
};

exports.CHANGED_MOVES = Object.keys(ACCURACY);
exports.CHANGED_ABILITIES = ['flashfire', 'stalwart'];
