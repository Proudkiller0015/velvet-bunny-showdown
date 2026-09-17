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

/**
 * Explain an effect the log cannot show, once.
 *
 * A move that ignores type charts, crits without saying so and resolves before
 * the turn starts looks like a bug to the player on the other end - the log
 * prints a number with no line above it explaining where the number came from.
 * `-hint` is the channel the game itself uses for exactly this (Pursuit, the
 * Sleep Clause, a failed Encore); it renders as a small italic note rather than
 * as battle text, so it reads as an explanation instead of as flavour.
 *
 * Keyed per turn per Pokemon, because the handlers that want to speak fire once
 * per hit - and Queen Wrath makes every one of her moves hit twice.
 */
function explain(battle, pokemon, key, hint) {
	if (!pokemon) return;
	const said = pokemon.m.velvetHinted || (pokemon.m.velvetHinted = {});
	if (said[key] === battle.turn) return;
	said[key] = battle.turn;
	battle.add('-hint', hint);
}

/**
 * The same thing, but said once in the whole battle.
 *
 * A rule only needs explaining the first time it comes up; a paragraph printed
 * every turn stops being an explanation and becomes the thing being scrolled
 * past. Used for the long ones.
 */
/**
 * Give her back the item she walked in with.
 *
 * Knock Off, Thief, Covet, Trick, Switcheroo, Magician, Pickpocket, an eaten
 * Berry: seven different ways to separate her from her item, and until now one
 * of them was enough to keep it off her for the rest of the battle. Recycle only
 * answers the last of those - `lastItem` is set when an item is consumed, not
 * when it is taken - so the item she is owed is read off her team sheet instead,
 * which nothing in a battle can change.
 *
 * Whatever she is holding instead is dropped. That matters exactly once, and in
 * her favour: a foe who Tricked a Choice Scarf onto her gets no lock out of it.
 * It also does not go looking for the thief - the item is restored, not stolen
 * back, so somebody who Knocked it off is left holding their own.
 */
function restoreHerItem(battle, pokemon) {
	const set = pokemon.set;
	if (!set || !set.item) return false;
	const home = battle.dex.items.get(set.item);
	if (!home.exists || pokemon.item === home.id) return false;
	if (!pokemon.setItem(home.id)) return false;
	pokemon.lastItem = '';
	battle.add('-item', pokemon, home.name, "[from] move: Queen's Heal");
	return true;
}

function explainOnce(battle, pokemon, key, hint) {
	if (!pokemon) return;
	const said = pokemon.m.velvetHinted || (pokemon.m.velvetHinted = {});
	if (said[key]) return;
	said[key] = true;
	battle.add('-hint', hint);
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
	/**
	 * Queen's Blitz - the one that does not wait.
	 *
	 * Dark, 200, always the same 200: it is neutral on everything, so nothing
	 * resists it, nothing is immune to it, and no amount of typing helps. It
	 * always gets its same-type bonus, whoever is holding it.
	 *
	 * And it goes first. Not "first among moves" - first, full stop, ahead of
	 * switching out and ahead of Mega Evolving.
	 *
	 * That last part needs more than priority. The queue sorts on `order` before
	 * it ever looks at priority, and a move's order is 200 against a switch's 103
	 * and a Mega's 104, so the highest priority in the game still goes after
	 * somebody running away. What does run early is `beforeTurnCallback`, at
	 * order 4 - the hook Pursuit uses to catch a Pokemon on its way out - and
	 * from there the action is still sitting in the queue waiting to be sorted.
	 * So it reaches in and moves itself in front of them.
	 */
	/**
	 * Nuzleaf's signature: the sale, called in.
	 *
	 * Final Gambit with priority - the user's remaining HP dealt as damage, and
	 * the user faints for it. On its own that is a trade. Held with a Broken
	 * Pact it is not a trade at all: the faint is the *point*, because the item
	 * answers a faint by bringing the Nuzleaf back as Nuzleaf-SOLD with 190
	 * Attack, 190 Special Attack and 190 Speed. Full HP spent as damage, then a
	 * full bar back on a body built entirely out of revenge.
	 *
	 * Nothing here reaches for the item. The move faints the user the way Final
	 * Gambit does, and the item is listening for exactly that - which is also
	 * why being knocked out by an attack works identically. One hook, both
	 * roads.
	 *
	 * Dark rather than Fighting, so nothing is immune to it: fixed damage still
	 * checks type immunity, and a Ghost walking off Final Gambit untouched would
	 * be a hole in a move whose whole function is to be paid in full.
	 */
	merchantscall: {
		num: -9,
		gen: 9,
		name: "Merchant's Call",
		type: "Dark",
		category: "Special",
		basePower: 0,
		accuracy: 100,
		pp: 5,
		// Ahead of the ordinary bracket, so the trade happens on her terms.
		priority: 1,

		damageCallback(pokemon) {
			const damage = pokemon.hp;
			pokemon.faint();
			return damage;
		},
		selfdestruct: "ifHit",

		/*
		 * Nobody else's move, enforced rather than implied.
		 *
		 * Samantha learns every move in the game, so "only Nuzleaf" has to be a
		 * check rather than a learnset - and the SOLD forme passes it too, since
		 * `baseSpecies` is still Nuzleaf, which is the correct and funnier answer:
		 * it can sell itself again, for nothing, because the pact is already
		 * spent.
		 */
		onTry(source) {
			if (source.baseSpecies.baseSpecies === 'Nuzleaf') return;
			this.add('-fail', source);
			this.hint("Merchant's Call only works for Nuzleaf.");
			return null;
		},

		flags: { protect: 1, mirror: 1, metronome: 1, noparentalbond: 1 },
		secondary: null,
		target: "normal",
		contestType: "Tough",
		shortDesc: "Usually goes first (+1). Deals damage equal to the user's HP. The user faints. Nuzleaf only.",
		desc: "Deals damage to the target equal to the user's current HP, and the user faints. Fails unless the user is Nuzleaf. If the user is holding a Broken Pact, fainting this way returns it to the field as Nuzleaf-SOLD at full HP and uses the item up.",
	},

	queensblitz: {
		num: -8,
		gen: 9,   // negative `num` leaves this 0, and gen 0 is "does not exist yet"
		name: "Queen's Blitz",
		type: "Dark",
		category: "Physical",
		basePower: 200,
		accuracy: true,
		pp: 10,
		// Highest bracket as well, so that among things that also jump the queue
		// it still goes first.
		priority: 6,

		/**
		 * Say what it is doing, because none of it shows up in the log.
		 *
		 * Four separate surprises land in one line of battle text: the turn order
		 * was rearranged before the turn began, a Dark move hit a Fairy for
		 * neutral, the critical hit was not luck, and the number doubled because
		 * the target had Terastallized. Every one of those reads as the server
		 * being broken if nobody says otherwise, which is the whole reason this is
		 * here rather than only in the move's description.
		 *
		 * onTry runs once per use, so it survives Parental Bond doubling the hits.
		 */
		onTry(source, target) {
			this.add('-message', `${source.name} strikes first by right.`);
			explainOnce(this, source, 'blitz', "Queen's Blitz resolves before every other action in the turn, including switching out and Mega Evolution. It always gets STAB, always lands a critical hit, and is neutral on every type - nothing resists it and nothing is immune.");
		},

		// Same-type bonus regardless of who is using it.
		forceSTAB: true,

		// And whichever attacking stat is better, like the rest of her kit.
		onModifyMove(move, pokemon) {
			betterAttackingStat(move, pokemon);
		},

		// Neutral on everything: no immunity, no resistance, no weakness.
		ignoreImmunity: true,
		onEffectiveness() {
			return 0;
		},

		// And it always crits.
		willCrit: true,

		/**
		 * Double against anything wearing a gimmick.
		 *
		 * Mega Evolution, Primal Reversion, Ultra Burst, Dynamax and
		 * Terastallization - the four ways a Pokemon stops being the Pokemon it
		 * was in order to survive her. This is the answer to all of them, and the
		 * reason to keep one in reserve: the turn they reach for the transformation
		 * is the turn this hurts most.
		 */
		basePowerCallback(pokemon, target, move) {
			if (!target) return move.basePower;
			const species = target.species || {};
			const transformed = species.isMega || species.isPrimal || species.forme === 'Ultra';
			const maxed = !!(target.volatiles && target.volatiles['dynamax']);
			const tera = !!target.terastallized;
			if (transformed || maxed || tera) {
				this.debug("Queen's Blitz: the gimmick is the target");
				const what = maxed ? 'Dynamaxed' : tera ? 'Terastallized' : 'transformed';
				explain(this, pokemon, 'blitzgimmick',
					`${target.name} is ${what}, so Queen's Blitz hits for double power.`);
				return move.basePower * 2;
			}
			return move.basePower;
		},

		/**
		 * Move this turn's action in front of the switches and the Megas.
		 *
		 * 102 sits below switch (103) and Mega Evolution (104) and above the
		 * handful of things that genuinely must come first - the team order, the
		 * start of the battle, an instant switch forced by a move that already
		 * resolved.
		 */
		beforeTurnCallback(pokemon) {
			for (const action of this.queue.list) {
				if (action.choice !== 'move' || action.pokemon !== pokemon) continue;
				if (!action.move || action.move.id !== 'queensblitz') continue;
				action.order = 102;
			}
			this.queue.sort();
		},

		flags: { protect: 1, mirror: 1, metronome: 1 },
		secondary: null,
		target: "normal",
		contestType: "Cool",
		shortDesc: "Goes before switches and Megas. Always STAB, always crits, neutral on every type. Double vs Mega/Dynamax/Tera.",
		desc: "Acts before every other action in the turn, including switching out and Mega Evolution. Always receives the same-type attack bonus, and is always neutrally effective - no type resists it, is immune to it, or is weak to it. It always results in a critical hit, uses whichever of the user's attacking stats is higher, and deals double damage to a target that has Mega Evolved, undergone Primal Reversion or Ultra Burst, Dynamaxed, or Terastallized.",
	},

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
			const regained = restoreHerItem(this, target);
			return healed || cured || regained || null;
		},
		flags: { snatch: 1, heal: 1, metronome: 1 },
		secondary: null,
		target: "self",
		contestType: "Beautiful",
		shortDesc: "Heals the user fully, cures its status, and takes back its held item.",
		desc: "The user is restored to full HP, any non-volatile status condition is cured, and the item it entered the battle holding is returned to it - whether that item was knocked off, stolen, traded away by Trick or Switcheroo, or used up. Anything else it happens to be holding at the time is discarded.",
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
			if (queenProtected(attacker)) {
				explain(this, attacker, 'imprison', "Imprison cannot take a queen's own moves from her.");
				return;
			}
			return before.call(this, attacker, defender, move);
		};
	}
}

/**
 * Max Hailstorm summons snow, not hail.
 *
 * Hail is the ninth generation's leftover: it chips everything that is not Ice
 * and nothing else uses it, so a Dynamaxed Ice move set a weather no ability or
 * move on this server is written for. Snow is what Snowscape, Snow Warning and
 * Diamond Dust set, so the Max Move now joins them (owner's request).
 */
function patchMaxHailstorm(Moves) {
	const max = Moves && Moves.maxhailstorm;
	if (!max || !max.self || max.velvetSnow) return;
	max.velvetSnow = true;
	max.self = {
		onHit(source) {
			if (!source.volatiles['dynamax']) return;
			this.field.setWeather('snowscape');
		},
	};
}

function patchMoves(Moves) {
	patchImprison(Moves);
	patchMaxHailstorm(Moves);

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

// Balance Patch 1's moves live with the rest of that patch, and join the table here.
Object.assign(exports.Moves, require('./balance-patch-1.js').MOVES);
