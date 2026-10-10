'use strict';
/**
 * The creation trio's buff (the owner, 10 Oct 2026).
 *
 *   Shadow Force   Giratina's signature hunts like Pursuit: a Pokemon that switches out
 *                  while Giratina is vanished takes the hit on its way out. It attacks
 *                  from whichever of Attack and Sp. Atk is higher.
 *   Abilities      The normal forms (not the Origin ones) each gain a thematic ability,
 *                  keeping Pressure and Telepathy:
 *                    Dialga    Timeless          never has to recharge (Roar of Time)
 *                    Palkia    Rending Space     high-critical moves always crit (Spacial Rend)
 *                    Giratina  Distortion World  Fairy immunity, half damage at full HP
 */

exports.moves = (data) => {
	const shadowForce = data.shadowforce;
	if (shadowForce) {
		data.shadowforce = {
			...shadowForce,
			// The better attacking stat, boosts counted, as Photon Geyser reads it.
			onModifyMove(move, pokemon, target) {
				if (pokemon.getStat('spa', false, true) > pokemon.getStat('atk', false, true)) move.category = 'Special';
				if (target && (target.beingCalledBack || target.switchFlag)) {
					move.accuracy = true;
					move.tracksTarget = true;
				}
			},
			condition: {
				...shadowForce.condition,
				// Giratina is vanished: a foe that switches out is caught first.
				onFoeBeforeSwitchOut(pokemon) {
					const source = this.effectState.target;
					if (!source || !source.hp || !source.isAdjacent(pokemon) || !this.queue.willMove(source)) return;
					if (!this.queue.cancelMove(source)) return;
					if (source.canMegaEvo || source.canUltraBurst || source.canTerastallize) {
						for (const [i, action] of this.queue.entries()) {
							if (action.pokemon !== source) continue;
							if (action.choice === 'megaEvo') this.actions.runMegaEvo(source);
							else if (action.choice === 'terastallize') this.actions.terastallize(source);
							else continue;
							this.queue.list.splice(i, 1);
							break;
						}
					}
					pokemon.removeVolatile('destinybond');
					this.add('-activate', pokemon, 'move: Pursuit');
					this.actions.runMove('shadowforce', source, source.getLocOf(pokemon));
					source.removeVolatile('twoturnmove');
				},
			},
			shortDesc: "Vanishes, then hits. Catches a switching foe. Uses best attack stat.",
			desc: "If this move is successful, it breaks through the target's protection and the effects of Max Guard, Detect, King's Shield, Protect, or Spiky Shield end for the target's side. This attack charges on the first turn and executes on the second, during which the user is semi-invulnerable. If an adjacent foe switches out while the user is semi-invulnerable, this move hits it before it leaves, never missing. This move is special if the user's Special Attack is higher than its Attack, including stat stage changes.",
		};
	}
	return data;
};

exports.abilities = (data) => {
	Object.assign(data, ABILITIES);
	return data;
};

const ABILITIES = {
	// Dialga's: time does not stop for it. No recharge turn after Roar of Time, Hyper Beam...
	timeless: {
		name: "Timeless",
		onTryAddVolatile(status, pokemon) {
			if (status.id !== 'mustrecharge') return;
			this.add('-message', `${pokemon.name} doesn't need to recharge!`);
			return null;
		},
		flags: {},
		rating: 3.5,
		num: -63,
		gen: 9,
		flavor: "Dialga's heart keeps time itself. It never has to wait for it.",
		shortDesc: "This Pokemon never has to recharge after a move.",
		desc: "This Pokemon never has to spend a turn recharging after using a move such as Roar of Time or Hyper Beam.",
	},
	// Palkia's: space tears where it aims. A move with a raised critical ratio always lands one.
	rendingspace: {
		name: "Rending Space",
		onModifyMove(move) {
			if (move.critRatio >= 2) move.willCrit = true;
		},
		flags: {},
		rating: 3.5,
		num: -64,
		gen: 9,
		flavor: "Palkia cuts space itself apart, and nothing behind the cut is spared.",
		shortDesc: "This Pokemon's high critical-hit ratio moves always crit.",
		desc: "This Pokemon's moves with a high critical hit ratio, such as Spacial Rend, always result in a critical hit.",
	},
	// Giratina's: it fights from a world folded behind ours. Shadow Shield, and Fairy
	// light never reaches it (the owner, 10 Oct 2026).
	distortionworld: {
		name: "Distortion World",
		onTryHit(target, source, move) {
			if (target !== source && move.type === 'Fairy') {
				this.add('-immune', target, '[from] ability: Distortion World');
				return null;
			}
		},
		onSourceModifyDamage(damage, source, target, move) {
			if (target.hp >= target.maxhp) {
				this.debug('Distortion World weaken');
				return this.chainModify(0.5);
			}
		},
		flags: {},
		rating: 3.5,
		num: -65,
		gen: 9,
		flavor: "Half of Giratina is always somewhere else. The first blow finds only that half.",
		shortDesc: "Fairy immunity. At full HP, damage taken from attacks is halved.",
		desc: "This Pokemon is immune to Fairy-type moves. If this Pokemon is at full HP, damage taken from attacks is halved. Moldbreaker and its variants cannot ignore this Ability.",
	},
};
exports.ABILITIES = ABILITIES;

// The normal forms only: the Origin forms are left as they were.
exports.GRANTS = { dialga: 'Timeless', palkia: 'Rending Space', giratina: 'Distortion World' };

// For the client's move descriptions (scripts/build-buffs.js).
exports.CHANGED_MOVES = ['shadowforce'];
