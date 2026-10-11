'use strict';
/**
 * The creation trio's buff (the owner, 10 Oct 2026).
 *
 *   Shadow Force   Giratina's signature hunts like Pursuit: a Pokemon that switches out
 *                  while Giratina is vanished takes the hit on its way out. It attacks
 *                  from whichever of Attack and Sp. Atk is higher.
 *   Abilities      The normal forms each gain a thematic ability,
 *                  keeping Pressure and Telepathy:
 *                    Dialga    Timeless          no charge turns, never recharges
 *                    Palkia    Rending Space     +1 crit, Spacial Rend always crits, crits 2x
 *                    Giratina  Distortion World  inverse type chart while out; Dragons immune to Fairy
 *                  All three take no recoil. Giratina-Origin gets Renegade Drift (Levitate +
 *                  Fairy immunity); Dialga-Origin and Palkia-Origin share the normal forms'.
 */

exports.moves = (data) => {
	const shadowForce = data.shadowforce;
	if (shadowForce) {
		data.shadowforce = {
			...shadowForce,
			// The better attacking stat, boosts counted, as Photon Geyser reads it.
			onModifyMove(move, pokemon, target) {
				if (pokemon.getStat('spa', false, true) > pokemon.getStat('atk', false, true)) move.category = 'Special';
				// Through screens as well as Protect (the owner). infiltrates is the only flag the
				// screens check, so it passes a Substitute too.
				move.infiltrates = true;
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
			shortDesc: "Vanishes, then hits through Protect/screens/Sub. Catches switches. Best stat.",
			desc: "If this move is successful, it breaks through the target's protection and the effects of Max Guard, Detect, King's Shield, Protect, or Spiky Shield end for the target's side. This attack charges on the first turn and executes on the second, during which the user is semi-invulnerable. If an adjacent foe switches out while the user is semi-invulnerable, this move hits it before it leaves, never missing. It ignores Reflect, Light Screen, Aurora Veil and Substitute. This move is special if the user's Special Attack is higher than its Attack, including stat stage changes.",
		};
	}
	return data;
};

exports.abilities = (data) => {
	Object.assign(data, ABILITIES);
	return data;
};


/*
 * Shared by the trio's abilities (the owner, 10 Oct 2026: "cancel move recoils for itself;
 * steel beam", "doesnt work on explosion tho since its suicide"): no recoil from its own
 * moves - Brave Bird, Head Smash, Chloroblast, and Steel Beam / Mind Blown's half HP, hit
 * or miss. Struggle still costs HP, and Explosion still makes the user faint.
 */
function noRecoil(damage, target, source, effect) {
	if (!effect || source !== target) return;
	if (effect.id === 'recoil' && this.activeMove && this.activeMove.id !== 'struggle') return null;
	if (['steelbeam', 'mindblown'].includes(effect.id)) return null;
}

const ABILITIES = {
	/*
	 * Dialga's: time does not stop for it (the owner, 10 Oct 2026: "use ALL 2 turn moves in 1
	 * turn", "doesnt recharge"). No recharge turn after Roar of Time or Hyper Beam, and every
	 * charge move fires at once, as with a Power Herb that is never used up.
	 */
	timeless: {
		onDamage: noRecoil,
		name: "Timeless",
		onChargeMove(pokemon, target, move) {
			this.debug('Timeless - no charge turn for ' + move.id);
			this.attrLastMove('[still]');
			this.addMove('-anim', pokemon, move.name, target);
			return false;
		},
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
		shortDesc: "Two-turn moves take one turn. Never recharges. No recoil.",
		desc: "This Pokemon's two-turn moves, such as Solar Beam, Meteor Beam or Shadow Force, skip their charging turn and are used immediately, as with a Power Herb that is never consumed. It never has to spend a turn recharging after using a move such as Roar of Time or Hyper Beam. It takes no recoil damage from its own moves, including Steel Beam and Mind Blown; Struggle and Explosion are unaffected.",
	},
	/*
	 * Palkia's: space tears where it aims (the owner, 10 Oct 2026: "increased crit chance
	 * overall... like Sniper, so that Spacial Rend crit guaranteed for x2"). Every move is a
	 * stage likelier to crit, a high-crit move always does, and its crits deal 2x, not 1.5x.
	 */
	rendingspace: {
		onDamage: noRecoil,
		name: "Rending Space",
		onModifyCritRatio(critRatio) {
			return critRatio + 1;
		},
		onModifyMove(move) {
			if (move.critRatio >= 2) move.willCrit = true;
		},
		onModifyDamage(damage, source, target, move) {
			if (target.getMoveHitData(move).crit) {
				this.debug('Rending Space boost');
				return this.chainModify([5461, 4096]);   // 1.5x -> 2x
			}
		},
		flags: {},
		rating: 4,
		num: -64,
		gen: 9,
		flavor: "Palkia cuts space itself apart, and nothing behind the cut is spared.",
		shortDesc: "Crit ratio +1; high-crit moves always crit; crits deal 2x. No recoil.",
		desc: "This Pokemon's critical hit ratio is raised by 1 stage, its moves with a high critical hit ratio, such as Spacial Rend, always result in a critical hit, and its critical hits deal 2x damage instead of 1.5x. It takes no recoil damage from its own moves, including Steel Beam and Mind Blown; Struggle and Explosion are unaffected.",
	},
	/*
	 * Giratina's: it drags the battle into the world behind ours (the owner, 10 Oct 2026:
	 * "fully invert the chart in play and grant dragon types fairy immunity"). While it is
	 * out, type matchups are an Inverse Battle's for everyone - weaknesses resist, resistances
	 * and immunities are weaknesses (Ghost hits Normal super-effectively) - and Dragon types
	 * are immune to Fairy moves. Two of them do not flip it back: only the first counts.
	 */
	distortionworld: {
		onDamage: noRecoil,
		name: "Distortion World",
		onStart(pokemon) {
			if (isDistorter(this, pokemon)) this.add('-ability', pokemon, 'Distortion World');
			if (isDistorter(this, pokemon)) this.add('-message', 'The battlefield turned inside out! Type matchups are reversed!');
		},
		onEnd(pokemon) {
			if (isDistorter(this, pokemon)) this.add('-message', 'The battlefield returned to normal.');
		},
		onAnyNegateImmunity(pokemon, type) {
			if (!isDistorter(this, this.effectState.target)) return;
			// Type immunities only (Ghost vs Normal, Ground vs Flying); weather and status keep theirs.
			if (typeof type === 'string' && this.dex.types.isName(type)) return false;
		},
		onAnyEffectivenessPriority: 1,
		onAnyEffectiveness(typeMod, target, type, move) {
			if (!isDistorter(this, this.effectState.target) || !move) return;
			if (move.id === 'freezedry' && type === 'Water') return;
			if (!this.dex.getImmunity(move, type)) return 1;
			if (typeMod) return -typeMod;
		},
		onAnyTryHit(target, source, move) {
			if (!isDistorter(this, this.effectState.target)) return;
			if (target !== source && move.type === 'Fairy' && target.hasType('Dragon')) {
				this.add('-immune', target, '[from] ability: Distortion World');
				return null;
			}
		},
		flags: {},
		rating: 4,
		num: -65,
		gen: 9,
		flavor: "Where Giratina goes, the world turns inside out.",
		shortDesc: "While active: types inverted; Dragons immune to Fairy. No recoil.",
		desc: "While this Pokemon is active, type effectiveness is inverted for every Pokemon, as in an Inverse Battle: weaknesses become resistances, while resistances and immunities become weaknesses. Dragon-type Pokemon are immune to Fairy-type moves during this time. A second Pokemon with this Ability does not invert it back. This Pokemon takes no recoil damage from its own moves, including Steel Beam and Mind Blown; Struggle and Explosion are unaffected.",
	},
	/*
	 * Giratina-Origin's (the owner, 10 Oct 2026): "a levitate that grant fairy immunity too
	 * without the type inversion". Ground and Fairy moves miss it, and it is ungrounded for
	 * hazards and terrain as Levitate is (isGrounded below). No recoil, as the trio's.
	 */
	renegadedrift: {
		onDamage: noRecoil,
		name: "Renegade Drift",
		onTryHit(target, source, move) {
			if (target !== source && move.type === 'Fairy') {
				this.add('-immune', target, '[from] ability: Renegade Drift');
				return null;
			}
		},
		flags: { breakable: 1 },
		rating: 4,
		num: -66,
		gen: 9,
		flavor: "Giratina drifts free of the ground, and of any light that would judge it.",
		shortDesc: "Immune to Ground and Fairy moves and Ground hazards. Takes no recoil.",
		desc: "This Pokemon is immune to Ground-type and Fairy-type moves, and is not grounded, as with Levitate: Spikes, Toxic Spikes, Sticky Web and terrain do not affect it. It takes no recoil damage from its own moves, including Steel Beam and Mind Blown; Struggle and Explosion are unaffected.",
	},
};
exports.ABILITIES = ABILITIES;

// The active Pokemon whose Distortion World is in force: the first one, so two don't cancel out.
function isDistorter(battle, pokemon) {
	if (!pokemon || !pokemon.isActive || pokemon.fainted) return false;
	const first = battle.getAllActive().find(p => p && !p.fainted && p.hasAbility('distortionworld'));
	return first === pokemon;
}

exports.GRANTS = {
	// Meteor Beam for Dialga (the owner): with Timeless it is a one-turn 120 that raises Sp. Atk. Shift Gear too.
	// Explosion and Recover for all three (the owner: "wheres giratina palkia and dialga recovery").
	// The Origin forms learn what the normal ones do.
	dialga: { ability: 'Timeless', moves: ['meteorbeam', 'explosion', 'shiftgear', 'recover'] },
	palkia: { ability: 'Rending Space', moves: ['explosion', 'recover'] },
	giratina: { ability: 'Distortion World', moves: ['explosion', 'recover'] },
	// Dialga-Origin and Palkia-Origin share their normal forms' (the owner: "the other 2
	// origin forms suck so i wont buff em for now... give em the same abilities").
	dialgaorigin: { ability: 'Timeless', moves: [] },
	palkiaorigin: { ability: 'Rending Space', moves: [] },
	giratinaorigin: { ability: 'Renegade Drift', moves: [] },
};

// Renegade Drift is a Levitate, and Levitate is read by name inside isGrounded: teach it ours.
(() => {
	let Pokemon;
	try { ({ Pokemon } = require('../../sim/pokemon.js')); } catch (e) { return; }
	if (!Pokemon || Pokemon.prototype.isGrounded.__renegadeDrift) return;
	const grounded = Pokemon.prototype.isGrounded;
	const patched = function (negateImmunity = false) {
		const out = grounded.call(this, negateImmunity);
		if (out !== true || !this.hasAbility('renegadedrift') || this.battle.suppressingAbility(this)) return out;
		if ('gravity' in this.battle.field.pseudoWeather || 'ingrain' in this.volatiles || 'smackdown' in this.volatiles) return out;
		if (!this.ignoringItem() && this.item === 'ironball') return out;
		return null;
	};
	patched.__renegadeDrift = true;
	Pokemon.prototype.isGrounded = patched;
})();

// For the client's move descriptions (scripts/build-buffs.js).
exports.CHANGED_MOVES = ['shadowforce'];
