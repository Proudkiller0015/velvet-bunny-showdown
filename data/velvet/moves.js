'use strict';
/**
 * Queen Beam, Samantha's signature move.
 *
 * Fairy on paper and Dark as well in practice. That is the Flying Press trick:
 * the move has one type for everything that reads a type - STAB, immunities,
 * what resists it - and `onEffectiveness` folds a second type chart lookup in on
 * top, so the multipliers of both are applied together. Fairy plus Dark is
 * brutal into exactly the things that wall Fairy: Steel resists Fairy and is
 * neutral to Dark, and Dark itself resists Fairy while being weak to nothing
 * here, so almost nothing takes it well.
 *
 * `accuracy: true` is Showdown's way of saying the move does not roll to hit at
 * all - not 100%, which can still be dodged past by evasion. It cannot miss.
 */

exports.Moves = {
	queenbeam: {
		num: -1,
		name: "Queen Beam",
		type: "Fairy",
		category: "Physical",
		basePower: 250,
		accuracy: true,
		pp: 30,
		priority: 0,

		// Abilities do not get a say: not the immunities, not the damage cuts.
		ignoreAbility: true,

		// The Flying Press mechanic, with Dark in Flying's place.
		onEffectiveness(typeMod, target, type, move) {
			return typeMod + this.dex.getEffectiveness('Dark', type);
		},

		flags: { protect: 1, mirror: 1, metronome: 1 },
		secondary: null,
		target: "normal",
		contestType: "Cool",
		shortDesc: "Fairy and Dark effectiveness together. Never misses. Ignores abilities.",
		desc:
			"Deals damage with both Fairy and Dark type effectiveness applied, the way Flying Press " +
			"combines Fighting and Flying. This move does not check accuracy and ignores the target's Ability.",
	},

	/**
	 * Queen's Dance: everything at once, all the way up.
	 *
	 * Boosting by twelve rather than six is how Belly Drum does it - the engine
	 * clamps at +6, so asking for twice that guarantees the maximum whatever the
	 * stat was sitting at beforehand, including after a Sticky Web or an Intimidate.
	 *
	 * A dance, so Dancer copies it and Sheer Force does not care.
	 */
	queensdance: {
		num: -2,
		name: "Queen's Dance",
		type: "Fairy",
		category: "Status",
		basePower: 0,
		accuracy: true,
		pp: 30,
		priority: 0,
		onHit(target, source, move) {
			this.boost({ atk: 12, def: 12, spa: 12, spd: 12, spe: 12 }, source, source, move);
		},
		flags: { snatch: 1, dance: 1, metronome: 1 },
		secondary: null,
		target: "self",
		contestType: "Beautiful",
		shortDesc: "Raises all of the user's stats to the maximum.",
		desc: "Raises the user's Attack, Defense, Special Attack, Special Defense and Speed to +6 each.",
	},

	/**
	 * Queen's Heal: back to full, and nothing left on her.
	 *
	 * Recover and Refresh in one move - the healing is unconditional rather than
	 * weather-dependent like Moonlight, and the status is cleared whether or not
	 * there was any healing left to do, so it is never a wasted turn against
	 * Toxic.
	 */
	queensheal: {
		num: -3,
		name: "Queen's Heal",
		type: "Fairy",
		category: "Status",
		basePower: 0,
		accuracy: true,
		pp: 30,
		priority: 0,
		onHit(target) {
			// heal() reports the amount; cureStatus clears burn, poison, paralysis,
			// sleep and freeze alike.
			const healed = this.heal(target.maxhp - target.hp, target, target);
			const cured = target.cureStatus();
			return healed || cured || null;
		},
		flags: { snatch: 1, heal: 1, metronome: 1 },
		secondary: null,
		target: "self",
		contestType: "Beautiful",
		shortDesc: "Heals the user fully and cures its status.",
		desc: "The user is restored to full HP and any non-volatile status condition is cured.",
	},
};
