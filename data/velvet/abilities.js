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
	/**
	 * Verdant Surge - Grassy Surge, and then some.
	 *
	 * Grassy Surge sets the terrain; the terrain gives every grounded Pokemon's
	 * Grass moves a 1.3x boost, including the opponent's. This does the same
	 * thing and takes the holder's own share of it from 1.3x to 1.5x - so the
	 * Pokemon that made the field gets more out of it than anyone standing on it.
	 *
	 * The multiplier is the ratio between the two, not 1.5: the terrain has
	 * already applied its own 1.3 by the time this runs, and applying 1.5 on top
	 * would come to 1.95.
	 */
	/**
	 * Sun and rain, under our own names.
	 *
	 * These do exactly what Drought and Drizzle do, and exist only because of
	 * what a name costs. National Dex UU bans weather by ability name, so a
	 * Simisear holding Drought is refused in UU, RU and everything below - the
	 * tiers a 480-stat monkey actually belongs to - while Simisage sailed through
	 * on Verdant Surge purely because that one happens to be ours.
	 *
	 * Naming the other two is the smaller change. Unbanning Drought and Drizzle
	 * in those tiers would have legalised Torkoal, Ninetales, Politoed and
	 * Pelipper alongside them, which is a tiering decision about sun and rain
	 * teams and has nothing to do with these three.
	 *
	 * No bonus attached, unlike Verdant Surge. Sun already multiplies Fire by 1.5
	 * and rain does the same for Water; Grassy Terrain only manages 1.3, which is
	 * the whole reason that one has a clause and these two do not.
	 */
	solarsurge: {
		name: "Solar Surge",
		onStart(source) {
			this.field.setWeather('sunnyday');
		},
		flags: {},
		rating: 4,
		num: -4,
		gen: 9,   // negative `num` leaves this 0, and gen 0 is "does not exist yet"
		shortDesc: "On switch-in, this Pokemon summons harsh sunlight.",
		desc: "On switch-in, the weather becomes harsh sunlight, which lasts until the weather is changed or five turns have passed. Held Heat Rock extends it to eight.",
	},
	tidalsurge: {
		name: "Tidal Surge",
		onStart(source) {
			this.field.setWeather('raindance');
		},
		flags: {},
		rating: 4,
		num: -5,
		gen: 9,   // negative `num` leaves this 0, and gen 0 is "does not exist yet"
		shortDesc: "On switch-in, this Pokemon summons rain.",
		desc: "On switch-in, the weather becomes rain, which lasts until the weather is changed or five turns have passed. Held Damp Rock extends it to eight.",
	},
	verdantsurge: {
		name: "Verdant Surge",
		onStart(source) {
			this.field.setTerrain('grassyterrain');
		},
		// After the terrain's own handler, so this multiplies what it produced.
		onBasePowerPriority: 21,
		onBasePower(basePower, attacker, defender, move) {
			if (move.type !== 'Grass') return;
			if (!this.field.isTerrain('grassyterrain') || !attacker.isGrounded()) return;
			// 1.5 / 1.3, in the 4096ths the engine multiplies in.
			this.debug('Verdant Surge boost');
			return this.chainModify([4726, 4096]);
		},
		flags: {},
		rating: 4,
		num: -3,
		gen: 9,   // negative `num` leaves this 0, and gen 0 is "does not exist yet"
		shortDesc: "Sets Grassy Terrain on entry; this Pokemon's Grass moves get 1.5x from it instead of 1.3x.",
		desc: "On switch-in, this Pokemon summons Grassy Terrain. While Grassy Terrain is active and this Pokemon is grounded, its Grass-type moves are boosted to 1.5x rather than the usual 1.3x.",
		// Deliberately standard. A buff belongs to this server's National Dex, so
		// it has to pass the same legality check every RP tier enforces.
		// `isNonstandard: 'Custom'` is what keeps Samantha out of everything, and
		// wearing it here made this illegal in RP OU alongside her.
	},
};
