'use strict';
/**
 * Samantha's two abilities.
 *
 * Each is a stack of several real abilities at once. Where two of them want the
 * same handler - Sturdy and Magic Guard both answer `onDamage` - they are folded
 * into one function rather than listed twice, because the second would simply
 * never run.
 *
 * Both carry `cantsuppress`, the flag that makes an ability survive Neutralizing
 * Gas; it is what Comatose and Multitype use. Without it a Weezing switching in
 * would turn her off.
 */

/**
 * Say what just happened, once a turn at most.
 *
 * Half of what these abilities do is invisible: damage quietly halved, chip
 * damage quietly ignored, an attack quietly doubled. The battle log shows the
 * result and never the reason, which reads as the numbers being wrong rather
 * than as an ability working.
 *
 * Once a turn per kind of event, because the ones worth announcing are exactly
 * the ones that can fire several times in a turn - every hit of a multi-hit
 * move, every source of residual damage - and a line for each would bury the
 * battle.
 */
function announce(battle, pokemon, key, text) {
	if (!pokemon) return;
	const said = pokemon.m.velvetSaid || (pokemon.m.velvetSaid = {});
	if (said[key] === battle.turn) return;
	said[key] = battle.turn;
	battle.add('-message', text);
}

/**
 * Magic Guard and Sturdy, sharing the one handler they both need.
 *
 * Order matters. Magic Guard goes first because it answers a different question:
 * anything that is not a move - poison, a Life Orb, hail, Stealth Rock - does
 * nothing at all, so there is no damage left for Sturdy to consider. Sturdy then
 * catches the case Magic Guard does not cover: a move that would take her from
 * full health to none leaves her on one instead.
 */
function guardAndEndure(name) {
	return function (damage, target, source, effect) {
		if (!effect) return;
		if (effect.effectType !== 'Move') {
			if (effect.effectType === 'Ability') this.add('-activate', source, 'ability: ' + effect.name);
			announce(this, target, 'guard', `${target.name} pays no attention to ${effect.name || 'that'}.`);
			return false;
		}
		if (target.hp === target.maxhp && damage >= target.hp) {
			this.add('-ability', target, name);
			announce(this, target, 'endure', `${target.name} refuses to fall.`);
			return target.hp - 1;
		}
	};
}

/** Sturdy's other half: one-hit knockout moves do not work on her either. */
function ignoreOhko(name) {
	return function (pokemon, target, move) {
		if (move.ohko) {
			this.add('-immune', pokemon, '[from] ability: ' + name);
			return null;
		}
	};
}

/** Shadow Shield: at full health, everything hits for half. */
function shadowShield(label) {
	return function (damage, source, target, move) {
		if (target.hp >= target.maxhp) {
			this.debug(label + ' weaken');
			announce(this, target, 'shield', `${target.name} is unharmed - the blow barely lands.`);
			return this.chainModify(0.5);
		}
	};
}

exports.Abilities = {
	queenwrath: {
		name: "Queen Wrath",
		// Announced on entry the way Mold Breaker is, so the other player knows what
		// they are looking at rather than working it out from the damage.
		onStart(pokemon) {
			this.add('-ability', pokemon, 'Queen Wrath');
			this.add('-message', `${pokemon.name} holds court: doubled power, no abilities in her way, and nothing moves before her.`);
		},

		// Mold Breaker: her moves ignore abilities that would blunt them.
		onModifyMove(move) {
			move.ignoreAbility = true;
		},

		// Huge Power on both halves. Light Ball doubles Attack and Special Attack
		// together, which is the shape asked for here.
		onModifyAtkPriority: 5,
		onModifyAtk(atk) {
			return this.chainModify(2);
		},
		onModifySpAPriority: 5,
		onModifySpA(spa) {
			return this.chainModify(2);
		},

		// Shadow Shield, Sturdy and Magic Guard.
		onSourceModifyDamage: shadowShield('Queen Wrath'),
		onDamage: guardAndEndure('Queen Wrath'),
		onTryHit: ignoreOhko('Queen Wrath'),

		// Queenly Majesty: nothing reaches her or her side first. Copied from the
		// original rather than approximated, including the three spread moves that
		// are exempt because they target the field rather than a Pokemon.
		onFoeTryMove(target, source, move) {
			const targetAllExceptions = ['perishsong', 'flowershield', 'rototiller'];
			if (move.target === 'foeSide' || (move.target === 'all' && !targetAllExceptions.includes(move.id))) {
				return;
			}
			const dazzlingHolder = this.effectState.target;
			if ((source.isAlly(dazzlingHolder) || move.target === 'all') && move.priority > 0.1) {
				this.attrLastMove('[still]');
				this.add('cant', dazzlingHolder, 'ability: Queen Wrath', move, `[of] ${target}`);
				return false;
			}
		},

		flags: {
			// Mold Breaker can still push a move past the priority block, exactly as
			// it can against Queenly Majesty.
			breakable: 1,
			// And Neutralizing Gas cannot switch any of it off.
			cantsuppress: 1,
		},
		rating: 5,
		num: -1,
	},

	queensmorph: {
		name: "Queen's Morph",
		/**
		 * Imposter, and then some.
		 *
		 * Transforming copies the other Pokemon's stats, so she arrives as a mirror
		 * of whatever she is looking at - and then takes the one thing a mirror
		 * cannot give her, which is moving first.
		 */
		onSwitchIn(pokemon) {
			const ability = this.dex.abilities.get('queensmorph');
			const target = pokemon.side.foe.active[pokemon.side.foe.active.length - 1 - pokemon.position];

			// Order matters: copy first, then everything else on top of the copy.
			if (target && pokemon.transformInto(target, ability)) {
				// Transforming replaces her ability with the copied one, so the boost
				// has to happen here, on the way in, or it never happens at all.
				this.boost({ spe: 6 }, pokemon, pokemon, ability);
				this.add('-message', `${pokemon.name} wears ${target.name}'s shape, and wears it faster.`);
			}

			// And the defensive half applies either way - whether she found something
			// to copy or not, and whether the copy replaced her ability or not. It is
			// a volatile because a volatile belongs to the Pokemon rather than to the
			// ability, so being overwritten by whatever she copied cannot remove it.
			//
			// Switching out clears it, as it clears every volatile, and switching back
			// in runs this again: the transform is undone on the way out, so she
			// arrives as herself, copies whatever is in front of her now, and puts the
			// same stack back on top.
			pokemon.addVolatile('queensmorph');
		},

		// Held before she transforms, and by the volatile afterwards.
		onSourceModifyDamage: shadowShield("Queen's Morph"),
		onDamage: guardAndEndure("Queen's Morph"),
		onTryHit: ignoreOhko("Queen's Morph"),

		condition: {
			noCopy: true,   // not something Baton Pass hands on
			onStart(pokemon) {
				this.add('-start', pokemon, "ability: Queen's Morph");
			},
			onSourceModifyDamage: shadowShield("Queen's Morph"),
			onDamage: guardAndEndure("Queen's Morph"),
			onTryHit: ignoreOhko("Queen's Morph"),
		},

		flags: {
			failroleplay: 1,
			noreceiver: 1,
			noentrain: 1,
			notrace: 1,
			cantsuppress: 1,
		},
		rating: 5,
		num: -2,
	},
};
