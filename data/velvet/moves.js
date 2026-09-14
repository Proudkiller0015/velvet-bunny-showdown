'use strict';

const { queenProtected } = require('./queens.js');
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

/**
 * Whichever attacking stat is better, the way Photon Geyser does it.
 *
 * The third argument to getStat asks for the unmodified number, so a Swords
 * Dance cannot silently turn a special attacker physical mid-battle.
 */
function betterAttackingStat(move, pokemon) {
	if (pokemon.getStat('atk', false, true) < pokemon.getStat('spa', false, true)) {
		move.category = 'Special';
	}
}

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

		/**
		 * Struck with whichever of her attacking stats is higher.
		 *
		 * Photon Geyser's trick: the move is written as one category and swaps to
		 * the other when that stat is bigger. Changing the *category* rather than
		 * just the stat matters, because it decides which of the defender's
		 * defences answers it - taking her Attack against a special wall would be
		 * a different move entirely.
		 *
		 * The stats are read unboosted-by-the-other-side and without their own
		 * modifiers cancelling out, which is what the two flags to getStat do.
		 */
		onModifyMove(move, pokemon) {
			if (pokemon.getStat('spa', false, true) > pokemon.getStat('atk', false, true)) {
				move.category = 'Special';
			}
		},

		// The Flying Press mechanic, with Dark in Flying's place.
		onEffectiveness(typeMod, target, type, move) {
			return typeMod + this.dex.getEffectiveness('Dark', type);
		},

		flags: { protect: 1, mirror: 1, metronome: 1 },
		secondary: null,
		target: "normal",
		contestType: "Cool",
		shortDesc: "Uses her better attacking stat. Fairy and Dark effectiveness. Never misses, ignores abilities.",
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

		/*
		 * Usable while asleep, the way Snore and Sleep Talk are.
		 *
		 * The move cures sleep, which made it the one status it could not answer:
		 * being asleep is what stops you moving, so the cure could never be
		 * reached from the position that needed it. Sleeping through the only
		 * thing that wakes you is a joke at her expense rather than a cost.
		 */
		sleepUsable: true,
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
	/**
	 * Simian Rush - the elemental monkeys' reason to exist.
	 *
	 * Grassy Glide is a 60 base power Grass move that moves first in Grassy
	 * Terrain, and it is the whole of Rillaboom. This is that idea handed to the
	 * three Pokemon who set the weather it keys off: 80 base power, the user's
	 * own type, its better attacking stat, and first strike exactly when its own
	 * ability has done its work - sun for the fire one, rain for the water one,
	 * grass underfoot for the grass one.
	 *
	 * Away from that weather it is an ordinary 80 power move, which is the trade:
	 * they have to set the field they want before they get anything for it.
	 */
	/**
	 * The Water Flame Charge, which somehow never existed.
	 *
	 * Fire has Flame Charge and Grass got Trailblaze, both 50 BP with a free
	 * Speed stage on top; Water has nothing of the kind. Aqua Step is the closest
	 * thing and it is Quaquaval's signature, so borrowing it would take a
	 * signature move away from a Pokemon that is defined by it.
	 *
	 * This is not the monkeys' move. It is a hole in the Water type that they
	 * happen to be the first to use, and it goes out to whoever else needs it -
	 * which is also why it never registers as a signature move: that table only
	 * counts a move one evolution family can learn, and three already have this.
	 */
	wavecharge: {
		num: -5,
		gen: 9,   // negative `num` leaves this 0, and gen 0 is "does not exist yet"
		name: "Wave Charge",
		type: "Water",
		category: "Physical",
		basePower: 50,
		accuracy: 100,
		pp: 20,
		priority: 0,
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1 },
		secondary: { chance: 100, self: { boosts: { spe: 1 } } },
		target: "normal",
		contestType: "Cool",
		shortDesc: "100% chance to raise the user's Speed by 1.",
		desc: "Has a 100% chance to raise the user's Speed by 1 stage.",

		// Not a signature move, and not to be treated as one however few Pokemon
		// happen to have it today. It exists to be handed out to whoever needs a
		// Water Flame Charge, and the signature table is told to skip it so that
		// being new does not make it somebody's.
		velvetShared: true,
	},

	/**
	 * One per monkey: the Rush moves.
	 *
	 * These started as a single move that took the user's own type, which made it
	 * three Pokemon's move and therefore nobody's signature - the table only
	 * counts a move one evolution family can learn. Splitting it into three
	 * fixes that, and costs nothing: each monkey only ever used it as its own
	 * type anyway.
	 *
	 * Identical apart from type and the weather each cares about. 80 BP, 100%
	 * accurate, 15 PP - the classic strong-but-not-broken statline - using
	 * whichever attacking stat is better, and +1 priority in that monkey's own
	 * weather, which is the reason to bring one and the reason its ability sets
	 * that weather on entry.
	 *
	 * The type is on the move rather than read off the user, so Terastallizing
	 * cannot move it. Simisear's move is a Fire move whatever it Terastallizes
	 * into; there is one of these per type and it stays that way.
	 */

	junglerush: {
		num: -4,
		gen: 9,   // negative `num` leaves this 0, and gen 0 is "does not exist yet"
		name: "Jungle Rush",
		type: "Grass",
		category: "Physical",
		basePower: 80,
		accuracy: 100,
		pp: 15,
		priority: 0,
		onModifyMove(move, pokemon) { betterAttackingStat(move, pokemon); },
		onModifyPriority(priority, source, target, move) {
			// Grounded, because Grassy Terrain does not reach anything in the air.
			if (this.field.isTerrain('grassyterrain') && source.isGrounded()) return priority + 1;
		},
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1 },
		secondary: null,
		target: "normal",
		contestType: "Cool",
		shortDesc: "Uses the user's better attacking stat. +1 priority on Grassy Terrain.",
		desc: "This move uses whichever of the user's Attack or Special Attack is higher, before any boosts. It gains +1 priority while Grassy Terrain is active and the user is grounded.",
	},

	cinderrush: {
		num: -6,
		gen: 9,
		name: "Cinder Rush",
		type: "Fire",
		category: "Physical",
		basePower: 80,
		accuracy: 100,
		pp: 15,
		priority: 0,
		onModifyMove(move, pokemon) { betterAttackingStat(move, pokemon); },
		onModifyPriority(priority, source, target, move) {
			// effectiveWeather(), not the field's: under Air Lock the sun is still
			// nominally up and doing nothing, and this should be nothing too.
			if (['sunnyday', 'desolateland'].includes(source.effectiveWeather())) return priority + 1;
		},
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1 },
		secondary: null,
		target: "normal",
		contestType: "Cool",
		shortDesc: "Uses the user's better attacking stat. +1 priority in harsh sunlight.",
		desc: "This move uses whichever of the user's Attack or Special Attack is higher, before any boosts. It gains +1 priority in harsh sunlight.",
	},

	torrentrush: {
		num: -7,
		gen: 9,
		name: "Torrent Rush",
		type: "Water",
		category: "Physical",
		basePower: 80,
		accuracy: 100,
		pp: 15,
		priority: 0,
		onModifyMove(move, pokemon) { betterAttackingStat(move, pokemon); },
		onModifyPriority(priority, source, target, move) {
			if (['raindance', 'primordialsea'].includes(source.effectiveWeather())) return priority + 1;
		},
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1 },
		secondary: null,
		target: "normal",
		contestType: "Cool",
		shortDesc: "Uses the user's better attacking stat. +1 priority in rain.",
		desc: "This move uses whichever of the user's Attack or Special Attack is higher, before any boosts. It gains +1 priority in rain.",
	},
};

/**
 * Destiny Bond cannot take a queen with it.
 *
 * Perish Song is a status move, so Good as Gold already refuses it at the door.
 * Destiny Bond is not aimed at her at all - it is used by the other Pokemon on
 * itself, and when it faints it reaches across and calls `faint()` on whoever
 * killed it. There is nothing for an ability on her side to intercept.
 *
 * Showdown has exactly this problem with Dynamax and solves it inside Destiny
 * Bond, which checks the attacker for the dynamax volatile before taking them
 * down. So this does the same thing for the same reason rather than inventing a
 * second mechanism: the move itself is taught to look, and to let her go.
 *
 * Patched rather than replaced - Destiny Bond carries a priority, a condition
 * with four other handlers, and a Z-move effect, and copying all of that across
 * to change one line would mean keeping the copy in step forever.
 */

/**
 * Imprison cannot lock a queen out of her own moves.
 *
 * Imprison is a status move, but Good as Gold never sees it: it is aimed at its
 * own user, who then carries a volatile that reaches across and disables the
 * foe's moves. Nothing is ever targeted at her, so nothing on her side gets a
 * say - which is why she was being imprisoned like anyone else, verified
 * against a control that was refused the same move.
 *
 * Two handlers do the work and both are answered. `onFoeDisableMove` is what
 * greys the moves out, and `onFoeBeforeMove` is what refuses them when used;
 * patching only the first would leave her able to pick a move and then fail.
 */
function patchImprison(Moves) {
	const imprison = Moves && Moves.imprison;
	if (!imprison || !imprison.condition || imprison.condition.velvetQueenSafe) return;
	imprison.condition.velvetQueenSafe = true;

	const disable = imprison.condition.onFoeDisableMove;
	if (typeof disable === 'function') {
		imprison.condition.onFoeDisableMove = function (pokemon) {
			if (queenProtected(pokemon)) return;
			return disable.call(this, pokemon);
		};
	}

	const before = imprison.condition.onFoeBeforeMove;
	if (typeof before === 'function') {
		imprison.condition.onFoeBeforeMove = function (attacker, defender, move) {
			if (queenProtected(attacker)) return;
			return before.call(this, attacker, defender, move);
		};
	}
}

function patchMoves(Moves) {
	patchImprison(Moves);

	const destinyBond = Moves && Moves.destinybond;
	if (!destinyBond || !destinyBond.condition) return Moves;

	const original = destinyBond.condition.onFaint;
	if (!original || destinyBond.condition.velvetQueenSafe) return Moves;
	destinyBond.condition.velvetQueenSafe = true;

	destinyBond.condition.onFaint = function (target, source, effect) {
		if (queenProtected(source)) {
			this.add('-hint', "Destiny Bond cannot take a queen with it.");
			return;
		}
		return original.call(this, target, source, effect);
	};
	return Moves;
}

exports.patchMoves = patchMoves;
