'use strict';
/**
 * Items this server changes, and the one it adds.
 *
 * Two different jobs live here. Light Ball is Showdown's, patched in place;
 * the Elemental Banana is ours, added whole. Both go in through the same hook
 * (see index.js), so the package's own item file is extended rather than
 * rewritten and survives a reinstall.
 */

/**
 * Light Ball, held by someone other than Pikachu.
 *
 * The item is hard-coded to one species - both handlers check `baseSpecies` and
 * do nothing for anybody else - so letting Samantha hold it means changing the
 * item rather than adding anything to her.
 *
 * Changed in place rather than replaced: the entry carries a number, a sprite, a
 * Fling effect and a generation, and copying all of that across to override two
 * functions would mean keeping the copy in step with the package forever.
 *
 * Stacked with Queen Wrath this is a second doubling on top of the ability's, so
 * she attacks at four times a stat that is already 250. That is the intent.
 */
const HOLDERS = ['Pikachu', 'Samantha'];

/**
 * The elemental monkeys, and the three they evolve from.
 *
 * The pre-evolutions are in deliberately. A Pansear carrying this is the point:
 * the item is the family's, not the final stage's, so a low-level character in
 * a story holds the same thing their evolved self will.
 */
const SIMI_FAMILY = ['Pansage', 'Simisage', 'Pansear', 'Simisear', 'Panpour', 'Simipour'];

/**
 * Abilities that put something on the field the moment they switch in.
 *
 * The banana re-triggers whichever of these its holder has, so the list is the
 * general one rather than just the monkeys' three: a later buff that hands out
 * Sand Stream should not have to remember to come back and edit this.
 */
const FIELD_SETTERS = [
	'drought', 'drizzle', 'sandstream', 'snowwarning',
	'desolateland', 'primordialsea', 'deltastream',
	'orichalcumpulse', 'hadronengine',
	'grassysurge', 'electricsurge', 'psychicsurge', 'mistysurge',
	'verdantsurge', 'solarsurge', 'tidalsurge',
];

/** Whose item this is. Anyone else holding it is holding a banana. */
function itsTheirs(pokemon) {
	return SIMI_FAMILY.includes(pokemon.baseSpecies.baseSpecies);
}

/**
 * 1.3x normally, 1.5x once they have Terastallized or Dynamaxed.
 *
 * Written as fractions over 4096 because that is how the games chain damage
 * modifiers and how the rest of the engine is written: 5324/4096 is 1.3 and
 * 6144/4096 is 1.5, and going through chainModify keeps the rounding identical
 * to every other item's.
 */
function ripeness(pokemon) {
	const unleashed = pokemon.terastallized || pokemon.volatiles['dynamax'];
	return unleashed ? [6144, 4096] : [5324, 4096];
}

/**
 * Bring a Nuzleaf back as the thing its trainer made of it.
 *
 * The whole item is one event, and picking the right one is the entire trick.
 *
 * `BeforeFaint` is the last moment a Pokemon is still alive. The engine queues
 * a faint the instant HP reaches zero and settles them all later in
 * `faintMessages`, which asks this question first: `if (!pokemon.fainted &&
 * this.runEvent('BeforeFaint', ...))`. Answer `false` and the faint is called
 * off before the `|faint|` line is written, before the side loses a Pokemon,
 * and before anything that feeds on a knockout - Moxie, Destiny Bond, Grim
 * Neigh - is told there was one. Which is correct: it did not die.
 *
 * It is also the only hook that catches *both* ways this is meant to happen.
 * An `onDamage` guard the way Sturdy does it would catch an attack and miss
 * Merchant's Call entirely, because that move calls `pokemon.faint()` directly
 * and never goes near the damage path. Every road to a knockout ends in the
 * faint queue, so that is where this waits.
 *
 * Nothing in the package uses the event - `onBeforeFaint` appears nowhere in
 * the dex - but the event system resolves handler names generically off the
 * holder's item, ability and volatiles, so an item that defines one is found
 * like any other.
 */
function brokenPactReturn(battle, pokemon) {
	const item = pokemon.getItem();

	/*
	 * Spend it by hand. `useItem()` opens with `if (!this.hp) return false`, and
	 * zero HP is the only state this is ever called in.
	 */
	pokemon.item = '';
	pokemon.itemState = { id: '', target: pokemon };
	pokemon.lastItem = item.id;
	pokemon.usedItemThisTurn = true;
	battle.add('-enditem', pokemon, item.name);

	/*
	 * Call the faint off properly.
	 *
	 * `faintQueued` is set by `faint()` and checked on the way in - a Pokemon
	 * already queued is never queued again. `faintMessages` has taken this entry
	 * off the queue but has no idea the flag exists, so leaving it set does not
	 * merely undo one knockout: it makes the Nuzleaf immortal for the rest of
	 * the battle.
	 */
	pokemon.faintQueued = false;

	/*
	 * Order matters for the next three lines.
	 *
	 * `clearVolatile` ends with `setSpecies(this.baseSpecies)` and resets the
	 * ability to the base one, so it has to happen before the forme change
	 * rather than after, or it puts the Nuzleaf straight back. It is here at all
	 * because this is a fresh Pokemon arriving: no Leech Seed, no Substitute, no
	 * boosts carried over from the body it left behind.
	 *
	 * `formeChange` with a null source is deliberate. Passing the item as the
	 * source sends the client a `-mega` line - the permanent branch treats any
	 * Item source as a Mega Stone unless it is a Z-crystal or a Primal Orb - and
	 * a null source instead leaves `formeRegression` set, which is what makes
	 * the Nuzleaf go back to being a Nuzleaf at the end of the battle. It also
	 * hands over the new forme's ability, which is how No Refunds arrives.
	 *
	 * And the healing comes first, which is the part that is easy to get wrong.
	 * `formeChange` hands over the new ability through `setAbility`, which opens
	 * with `if (!this.hp) return false` - so a Nuzleaf revived after the forme
	 * change kept Chlorophyll while its `baseAbility` quietly said No Refunds.
	 * Filling the bar first also lets `updateMaxHp` do the arithmetic: it scales
	 * the new maximum by the damage taken, and there is none.
	 */
	pokemon.clearVolatile(false);
	pokemon.hp = pokemon.maxhp;
	pokemon.cureStatus(true);
	pokemon.formeChange('Nuzleaf-SOLD', null, true);
	battle.add('-heal', pokemon, pokemon.getHealth);

	battle.add('-message', `${pokemon.name} was sold. It came back anyway.`);
	battle.add('-hint', "Broken Pact: a Nuzleaf that would faint while holding it returns at once as Nuzleaf-SOLD, at full HP, with the item used up. It never faints, so nothing that keys off a knockout - Moxie, Destiny Bond, Grim Neigh - triggers.");
	return false;
}

const Items = {
	/**
	 * A reminder of a Trainer who abandoned their partner when it mattered most.
	 */
	brokenpact: {
		name: "Broken Pact",
		num: -2,
		gen: 9,
		// Ours, so there is nothing to cut out of Showdown's item sheet - the
		// client draws it from our sprites folder, like the Elemental Banana.
		spritenum: 0,
		itemUser: ["Nuzleaf"],
		fling: { basePower: 10 },

		onBeforeFaint(pokemon) {
			// Only a Nuzleaf, and only the first time: the SOLD forme has nothing
			// left to be sold as, and a Ditto wearing its face was never anybody's
			// partner.
			if (pokemon.baseSpecies.baseSpecies !== 'Nuzleaf') return;
			if (pokemon.species.id === 'nuzleafsold' || pokemon.transformed) return;
			return brokenPactReturn(this, pokemon);
		},

		shortDesc: "If Nuzleaf would faint while holding this, it returns at full HP as Nuzleaf-SOLD.",
		desc: "A reminder of a Trainer who abandoned their partner when it mattered most. If Nuzleaf is knocked out while holding this item - by an attack, by an ally, or by its own Merchant's Call - it does not faint. It returns at once as Nuzleaf-SOLD, restored to full HP and cured of status, and this item is used up.",
	},

	elementalbanana: {
		name: "Elemental Banana",
		num: -1,
		gen: 9,
		// No entry on Showdown's item sheet, so the client draws it from our own
		// sprites folder instead - see installItemIcon() in client/js/velvet-data.js.
		spritenum: 0,
		itemUser: SIMI_FAMILY.slice(),
		fling: { basePower: 30 },

		onModifyAtkPriority: 1,
		onModifyAtk(atk, pokemon) {
			if (itsTheirs(pokemon)) return this.chainModify(ripeness(pokemon));
		},
		onModifySpAPriority: 1,
		onModifySpA(spa, pokemon) {
			if (itsTheirs(pokemon)) return this.chainModify(ripeness(pokemon));
		},
		onModifySpe(spe, pokemon) {
			if (itsTheirs(pokemon)) return this.chainModify(ripeness(pokemon));
		},

		/**
		 * Theirs, and not going anywhere.
		 *
		 * Refusing TakeItem is how the species-locked items already work (a Mega
		 * Stone on its own Pokemon, the Griseous Orb on Giratina), and it covers
		 * more than Knock Off for free: Trick, Thief, Covet, Switcheroo and
		 * Bestow all ask the same question. It also takes Knock Off's damage
		 * bonus away, because that move only gets its 1.5x when the item it is
		 * hitting could actually have been removed.
		 *
		 * Only for the family. Anyone else who somehow ends up holding one can
		 * have it knocked off like any other berry.
		 */
		onTakeItem(item, pokemon, source) {
			return !itsTheirs(pokemon);
		},

		/**
		 * Terastallizing or Dynamaxing ripens it.
		 *
		 * Two things happen at that moment: the boost goes from 1.3x to 1.5x,
		 * which ripeness() handles wherever a stat is read, and the holder's
		 * weather goes back up. The second one is the reason to bring it - four
		 * turns of sun is most of a Simisear, and by the time the fight is worth
		 * Terastallizing for, that sun is usually long gone.
		 *
		 * Once per Pokemon, tracked in `m` so it survives switching out: this
		 * fires on the turn they transform, not every time a Terastallized
		 * Pokemon comes back in (their ability already does that by itself).
		 */
		onUpdate(pokemon) {
			if (!itsTheirs(pokemon)) return;
			if (!pokemon.terastallized && !pokemon.volatiles['dynamax']) return;
			if (pokemon.m.bananaRipened) return;
			pokemon.m.bananaRipened = true;

			const ability = pokemon.getAbility();
			if (!FIELD_SETTERS.includes(ability.id)) return;
			this.add('-activate', pokemon, 'item: Elemental Banana');
			this.singleEvent('Start', ability, pokemon.abilityState, pokemon);
		},

		// Deliberately standard. A buff belongs to this server's National Dex, so
		// it has to pass the same legality check every RP tier enforces.
		// `isNonstandard: 'Custom'` is what keeps Samantha out of everything, and
		// wearing it here made this illegal in RP OU alongside her.
		shortDesc: "Simi family: 1.3x Atk, SpA and Speed, and cannot be removed. 1.5x after Tera/Dynamax, which also re-sets their weather.",
		desc: "If held by a Pansage, Pansear, Panpour, Simisage, Simisear or Simipour, that Pokemon's Attack, Special Attack and Speed are multiplied by 1.3, and the item cannot be removed by Knock Off, Trick, Thief or anything else. Once that Pokemon Terastallizes or Dynamaxes the multiplier becomes 1.5, and its weather- or terrain-setting Ability activates again.",
	},
};

function patchItems(Items_) {
	const lightBall = Items_ && Items_.lightball;
	if (lightBall) {
		lightBall.onModifyAtkPriority = 1;
		lightBall.onModifyAtk = function (atk, pokemon) {
			if (HOLDERS.includes(pokemon.baseSpecies.baseSpecies)) {
				return this.chainModify(2);
			}
		};
		lightBall.onModifySpAPriority = 1;
		lightBall.onModifySpA = function (spa, pokemon) {
			if (HOLDERS.includes(pokemon.baseSpecies.baseSpecies)) {
				return this.chainModify(2);
			}
		};
		// What the client lists under "held by", so she shows up there too.
		lightBall.itemUser = HOLDERS.slice();
	}

	for (const id in Items) {
		if (!Items_[id]) Items_[id] = Items[id];
	}
	return Items_;
}

exports.patchItems = patchItems;
exports.Items = Items;
exports.HOLDERS = HOLDERS;
exports.SIMI_FAMILY = SIMI_FAMILY;
