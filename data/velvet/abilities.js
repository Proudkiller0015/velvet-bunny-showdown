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

/**
 * She moves first, and Trick Room does not change that.
 *
 * Her 250 Speed already makes her first against almost anything - right up
 * until somebody sets Trick Room, which reverses the order and turns the
 * fastest Pokemon in the game into the slowest. "Nothing moves before her" is
 * the thing the ability says on the way in, and an opponent being able to undo
 * it with one move makes it a boast rather than an effect.
 *
 * Fractional priority is the right lever rather than a raw priority boost. The
 * queue adds it to the move's own priority, and the bracket is compared before
 * speed - which is the only thing Trick Room touches. So she goes first in her
 * bracket either way, without every one of her moves becoming a priority move
 * and picking up all the things that interact with those.
 *
 * Quick Draw's shape exactly, minus the dice roll.
 */
const firstAlways = {
	onFractionalPriorityPriority: -1,
	onFractionalPriority() {
		// Every move, status ones included. Quick Draw excludes them because it is
		// a lucky flinch of a thing; "nothing moves before her" is not, and the
		// exclusion showed up immediately in testing - Queen's Morph copies the
		// foe's moves, so hers were whatever they had, and a Transformed queen
		// setting Trick Room was politely waiting her turn.
		return 0.1;
	},
};

/**
 * Run two onTryHit handlers as one.
 *
 * An effect gets a single onTryHit, and both of these need it: one refuses
 * status moves, the other refuses OHKO moves. Whichever answers first wins, and
 * an answer of `undefined` means "no opinion, carry on".
 */
function chainTryHit(...handlers) {
	return function (target, source, move) {
		for (const handler of handlers) {
			const result = handler.call(this, target, source, move);
			if (result !== undefined) return result;
		}
	};
}

/**
 * Good as Gold: no status move from anybody else touches her.
 *
 * Gholdengo's ability, and it does more work here than it looks. Perish Song,
 * Leech Seed, Toxic, Will-O-Wisp, Thunder Wave, Encore, Taunt, Roar, Spore -
 * all of them are status moves, and all of them stop at the door. Perish Song
 * in particular is the reason it is here: it is the other move that kills
 * without dealing damage, and it is a status move, so this is the whole answer
 * to it.
 *
 * Her own status moves still work on herself, which is what `target !== source`
 * is for - Queen's Dance and Queen's Heal are status moves too.
 */
function goodAsGold(name) {
	return function (target, source, move) {
		if (move.category === 'Status' && target !== source) {
			this.add('-immune', target, `[from] ability: ${name}`);
			return null;
		}
	};
}

/**
 * Never trapped, the way a Shed Shell is never trapped.
 *
 * Shadow Tag, Arena Trap, Magnet Pull, Mean Look, Block, Spider Web, Fairy
 * Lock - all of them work by setting a flag on the Pokemon they caught, and all
 * of them are undone by clearing it afterwards. The low priority is what makes
 * that work: it runs after every trapper has had its say, so there is nothing
 * left to add the flag back.
 *
 * `maybeTrapped` is the same answer to the same question asked of the other
 * player, who is not allowed to know whether the trap would have held. Clearing
 * only the first leaves them told she might be stuck when she never is.
 */
const untrappable = {
	onTrapPokemonPriority: -10,
	onTrapPokemon(pokemon) {
		pokemon.trapped = false;
	},
	onMaybeTrapPokemonPriority: -10,
	onMaybeTrapPokemon(pokemon) {
		pokemon.maybeTrapped = false;
	},
};

/**
 * Clear Body, as a handler both queens can share.
 *
 * Nothing another Pokemon does lowers her stats - Intimidate on the way in,
 * Sticky Web, a secondary off a move, King's Shield, any of it. Her own
 * Queen's Dance still works, because that is her doing it to herself.
 *
 * Written once and used in three places: on Queen Wrath, on Queen's Morph, and
 * inside Queen's Morph's volatile, which is what carries her effects after the
 * transform has replaced the ability itself.
 */
function clearBody(name) {
	return function (boost, target, source, effect) {
		if (source && target === source) return;
		let stopped = false;
		for (const stat in boost) {
			if (boost[stat] < 0) {
				delete boost[stat];
				stopped = true;
			}
		}
		// Silent for a move's side effect, the way Clear Body itself is: a message
		// per secondary would drown the log.
		if (stopped && !effect.secondaries && effect.id !== 'octolock') {
			this.add('-fail', target, 'unboost', `[from] ability: ${name}`, `[of] ${target}`);
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

		/*
		 * Mold Breaker and Unseen Fist, in the one handler an effect gets.
		 *
		 * Her moves ignore abilities that would blunt them, and a contact move of
		 * hers goes through Protect and its relatives - which is what Unseen Fist
		 * is: it does not break the shield, it steps around it.
		 */
		onModifyMove(move) {
			move.ignoreAbility = true;
			if (move.flags && move.flags.contact) delete move.flags.protect;
		},

		/*
		 * Parental Bond: every attack hits twice, the second at a quarter.
		 *
		 * The exclusions are the real content here and they are copied from the
		 * ability itself rather than guessed: a status move has nothing to hit
		 * twice, a move that already has its own hit count cannot be given
		 * another, and two-turn, future and spread moves all break in ways that
		 * are somebody else's bug to have found. `noparentalbond` is the flag the
		 * game uses to say "not this one".
		 */
		onPrepareHit(source, target, move) {
			if (move.category === 'Status' || move.multihit) return;
			if (move.flags['noparentalbond'] || move.flags['charge'] || move.flags['futuremove']) return;
			if (move.spreadHit || move.isZ || move.isMax) return;
			move.multihit = 2;
			move.multihitType = 'parentalbond';
		},
		/*
		 * There is no handler for the second hit's damage, and that is correct.
		 *
		 * The quarter is applied by the engine itself, in modifyDamage, off the
		 * `parentalbond` marker set above - the real ability has a comment saying
		 * exactly that and no handler either. Adding one applies the quarter
		 * twice: measured against a Mega Kangaskhan hitting the same Chansey, its
		 * second hit was 16 after 76 and hers was 12 after 183, a sixteenth
		 * instead of a quarter.
		 */

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
		// (onTryHit lives further down, chained with Good as Gold - an object
		// literal keeps only the last of a repeated key, and a second one here
		// silently replaced it.)

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

		// Nothing the other side does lowers her stats.
		onTryBoost: clearBody('Queen Wrath'),
		// And nothing goes before her, Trick Room or no Trick Room.
		...firstAlways,
		// And no status move from anybody else lands at all.
		onTryHit: chainTryHit(goodAsGold('Queen Wrath'), ignoreOhko('Queen Wrath')),
		// And nothing holds her in place.
		...untrappable,

		flags: {
			/*
			 * Not breakable, deliberately.
			 *
			 * `breakable` is the flag Mold Breaker keys on - an ability carrying it
			 * is one that Mold Breaker, Teravolt and Turboblaze are allowed to
			 * ignore, the way they ignore Queenly Majesty. It used to be here on
			 * exactly that reasoning, treating her as a bigger Queenly Majesty.
			 *
			 * She is not. The rest of this ability cannot be broken either - it is
			 * one effect, and half of it being switched off by a common ability is
			 * worse than either answer. So the flag comes off and Mold Breaker goes
			 * through the priority block no more than it goes through the rest.
			 */
			/*
			 * And it cannot be switched off, taken, copied or handed away.
			 *
			 * `cantsuppress` alone already turned away most of it - Gastro Acid,
			 * Core Enforcer, Neutralizing Gas, Worry Seed, Entrainment, Simple
			 * Beam and Role Play all check that flag before they do anything. Skill
			 * Swap does not: it checks `failskillswap`, which was missing, so the
			 * one move that trades abilities rather than removing them walked off
			 * with hers.
			 *
			 * The rest are here so the list is complete rather than nearly
			 * complete: Trace cannot copy it, Receiver and Power of Alchemy cannot
			 * inherit it, Entrainment cannot give it to anybody else.
			 */
			cantsuppress: 1,
			failskillswap: 1,
			failroleplay: 1,
			noentrain: 1,
			noreceiver: 1,
			notrace: 1,
		},
		rating: 5,
		num: -1,
		shortDesc: "Doubles Atk and SpA, hits twice, contact moves ignore Protect. Shadow Shield, Sturdy, Magic Guard, Clear Body, Good as Gold. Untrappable, uncopyable.",
		desc: "Attack and Special Attack are doubled, and its attacks hit twice, the second at a quarter power. Its moves ignore the target's Ability, and its contact moves ignore Protect and its relatives. Priority moves cannot touch this side, and it moves before anything else in its priority bracket, Trick Room included. At full HP, damage taken is halved. Survives a killing blow from full HP and is immune to OHKO moves. Takes no damage from anything that is not a move. Its stats cannot be lowered, and no status move used by another Pokemon affects it. It cannot be trapped, cannot be copied or swapped away by anything - Transform, Imposter and Wandering Spirit included - and Destiny Bond cannot take it down. Mold Breaker, Teravolt and Turboblaze cannot ignore any of it.",
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
		onTryHit: chainTryHit(goodAsGold("Queen's Morph"), ignoreOhko("Queen's Morph")),
		onTryBoost: clearBody("Queen's Morph"),
		...untrappable,
		...firstAlways,

		condition: {
			noCopy: true,   // not something Baton Pass hands on
			onStart(pokemon) {
				this.add('-start', pokemon, "ability: Queen's Morph");
			},
			onSourceModifyDamage: shadowShield("Queen's Morph"),
			onDamage: guardAndEndure("Queen's Morph"),
			onTryHit: chainTryHit(goodAsGold("Queen's Morph"), ignoreOhko("Queen's Morph")),
			onTryBoost: clearBody("Queen's Morph"),
			...untrappable,
			...firstAlways,
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
		shortDesc: "Transforms into the foe on entry, then +6 Speed. Keeps Shadow Shield, Sturdy, Magic Guard, Clear Body and Good as Gold.",
		desc: "On switch-in, this Pokemon Transforms into the opposing Pokemon and then raises its Speed by 6 stages. Afterwards it keeps taking half damage at full HP, surviving a killing blow from full HP, ignoring damage that is not from a move, refusing stat drops and status moves from anything other than itself, moving first in its priority bracket even under Trick Room, being untrappable, being safe from Destiny Bond, and being impossible to copy or swap away with Transform, Imposter or Wandering Spirit - all of which outlive the Transform replacing this Ability with the copied one.",
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

/**
 * Ditto cannot become a queen.
 *
 * Transform the move is a status move, so Good as Gold already turns it away at
 * the door. Imposter is not a move: it fires on switch-in and calls
 * transformInto() on whoever is standing opposite, and there is no event on the
 * target's side to answer it with.
 *
 * transformInto() does refuse some Pokemon - Eternatus-Eternamax, a
 * Terastallized Ogerpon - but it refuses them by name, in the simulator's own
 * code, which our data hooks cannot reach. So this takes the same route used
 * for Destiny Bond: patch the thing doing the copying, rather than invent a
 * mechanism on the side being copied.
 *
 * Patched rather than replaced: Imposter carries a switch-in flag and an
 * onStart that has to run in a particular order, and copying that across to
 * change one condition would mean keeping the copy in step forever.
 */
function patchAbilities(Abilities) {
	const imposter = Abilities && Abilities.imposter;
	if (!imposter || imposter.velvetQueenSafe) return Abilities;

	// It is onSwitchIn, not onStart - Imposter copies the moment it arrives.
	const original = imposter.onSwitchIn;
	if (typeof original !== 'function') return Abilities;
	imposter.velvetQueenSafe = true;

	/*
	 * Wandering Spirit swaps abilities with whoever touches it.
	 *
	 * Queen Wrath is already safe: the swap runs through the engine's skillSwap,
	 * which refuses when either side's ability carries `failskillswap`, and hers
	 * does. Queen's Morph is not, and for a subtle reason - by the time anything
	 * touches her she is holding a copy of the foe's ability, and it is that copy
	 * the swap inspects. Whatever she took from a Pidgey does not carry her flags.
	 *
	 * So the same treatment as Destiny Bond and Imposter: the thing doing the
	 * taking is taught to look at who it is taking from.
	 */
	const wandering = Abilities.wanderingspirit;
	if (wandering && !wandering.velvetQueenSafe && typeof wandering.onDamagingHit === 'function') {
		const swap = wandering.onDamagingHit;
		wandering.velvetQueenSafe = true;
		wandering.onDamagingHit = function (damage, target, source, move) {
			// `source` is whoever landed the hit; `target` holds Wandering Spirit.
			if (queenProtected(source)) return;
			return swap.call(this, damage, target, source, move);
		};
	}

	imposter.onSwitchIn = function (pokemon) {
		const foes = pokemon.side.foe.active;
		const target = foes[foes.length - 1 - pokemon.position];
		if (target && queenProtected(target)) {
			this.add('-fail', pokemon, 'ability: Imposter');
			this.add('-hint', "There is only one of her.");
			return;
		}
		return original.call(this, pokemon);
	};
	return Abilities;
}

/** Shared with data/velvet/moves.js, which patches Destiny Bond the same way. */
const QUEEN_ABILITIES = ['queenwrath', 'queensmorph'];

function queenProtected(pokemon) {
	if (!pokemon) return false;
	if (QUEEN_ABILITIES.includes(pokemon.ability)) return true;
	return !!(pokemon.volatiles && pokemon.volatiles['queensmorph']);
}

exports.patchAbilities = patchAbilities;
