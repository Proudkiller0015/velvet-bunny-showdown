'use strict';
/**
 * Pokemon this server buffs, and what they get.
 *
 * Some Pokemon were left behind: never given the moves their whole type got in
 * later generations, never given an ability worth the slot, and never revisited
 * since. This is where that is fixed, one Pokemon at a time, deliberately.
 *
 * A buff is additive. Nothing is taken away - the original moves, abilities and
 * stats are all still there - so a buffed Pokemon is the Pokemon you know plus
 * the things it should have had.
 *
 * Buffs apply everywhere the data does, which means every format on this
 * server. They are ours; a Simisage here is not a Simisage on Showdown, and the
 * RP tiers are where that is the point.
 *
 * The client shows each list in its own section in the teambuilder, so it is
 * obvious what is a buff and what came with the Pokemon - see
 * client/js/velvet-buffs.js, which is generated from this file.
 */

/**
 * The elemental monkeys.
 *
 * Three fully evolved Pokemon with 480 base stats, no niche, and movepools that
 * stopped being updated around 2011: no Grassy Glide for the grass one, no
 * Liquidation for the water one, no Temper Flare for the fire one, and between
 * them not a single weather ability despite being the most on-the-nose weather
 * trio in the game.
 *
 * So: each sets its own weather, each gets the standard moves of its type that
 * its whole type received and it did not, and each gets Simian Rush - a move
 * that is fast precisely when their own weather is up, which is the reason to
 * bring one.
 *
 * The moves were not picked by taste. Each list is what at least 45% of that
 * type learns and this Pokemon does not, which is how "everyone got this but
 * them" was measured rather than assumed.
 */
/**
 * What every monkey in the game gets, and these three somehow did not.
 *
 * Measured the same way as everything else here: every status move that at
 * least 45% of the primate Pokemon learn - Mankey through Annihilape, the
 * Chimchar and Grookey lines, Aipom, Oranguru, Passimian - and that at least one
 * of the simi family cannot. Sword Dance and Nasty Plot are on the list by name
 * because they were asked for; both were already half-distributed across the
 * three, which is the exact problem this list exists to fix.
 *
 * All three get all of it. That is the "equalize" part: there was no reason for
 * Simisage to have Swords Dance and Simisear not, or for Simipour alone to know
 * Sunny Day, beyond nobody ever looking. Anything a monkey already learns is
 * skipped rather than duplicated, so this list is safe to grow.
 */
/**
 * Coverage, of the kind a monkey ought to have.
 *
 * These three are primates with fists and nothing to hit anything with. Every
 * other monkey in the game got the punches, the Fighting moves, or both -
 * Infernape, Primeape and Rillaboom are built out of them - while the simi
 * family was left with its own type and Acrobatics.
 *
 * So: the Fighting coverage that makes a monkey a monkey, the three elemental
 * punches, and enough rock to answer the birds that wall them. Shared across all
 * three for the same reason the status list is: there was never a reason for
 * them to differ, only an oversight.
 */
const MONKEY_COVERAGE = [
	'closecombat', 'focusblast', 'drainpunch', 'machpunch',
	'icepunch', 'firepunch', 'thunderpunch',
	'rockslide', 'stoneedge',
	'uturn', 'knockoff',
	// The monkey move. Ambipom, Infernape, Passimian and Rillaboom all have it;
	// these three are the primates who did not, which is the whole pattern here.
	'fakeout',
];

const MONKEY_STATUS = [
	'nastyplot', 'swordsdance', 'bulkup',
	'focusenergy', 'screech', 'scaryface',
	'encore', 'psychup', 'spite', 'curse',
	'quickguard', 'metronome',
	'sunnyday', 'raindance',
	'taunt', 'substitute',
];

/**
 * The elemental monkeys.
 *
 * Three fully evolved Pokemon with 480 base stats, no niche, and movepools that
 * stopped being updated around 2011: no Grassy Glide for the grass one, no
 * Liquidation for the water one, no Temper Flare for the fire one, and between
 * them not a single weather ability despite being the most on-the-nose weather
 * trio in the game.
 *
 * So: each sets its own weather, each gets the standard moves of its type that
 * its whole type received and it did not, each gets the 50 BP Speed-raising move
 * of its own type (Trailblaze, Flame Charge, and Wave Charge, which had to be
 * written because Water never got one), and each gets its own Rush move - Jungle,
 * Cinder and Torrent - which is fast precisely when that monkey's own weather
 * is up, and is the reason to bring one.
 *
 * The attacking moves were not picked by taste. Each list is what at least 45%
 * of that type learns and this Pokemon does not, which is how "everyone got this
 * but them" was measured rather than assumed.
 */
const MONKEYS = {
	simisage: {
		abilities: ['Verdant Surge'],
		moves: [
			'grassyglide', 'grassyterrain', 'trailblaze',
			'growth', 'endure', 'terablast', 'junglerush',
			...MONKEY_STATUS,
			...MONKEY_COVERAGE,
		],
	},
	simisear: {
		abilities: ['Solar Surge'],
		moves: [
			'temperflare', 'burningjealousy', 'flamecharge', 'ember',
			'endure', 'terablast', 'cinderrush',
			...MONKEY_STATUS,
			...MONKEY_COVERAGE,
		],
	},
	simipour: {
		abilities: ['Tidal Surge'],
		moves: [
			'liquidation', 'chillingwater', 'muddywater', 'whirlpool', 'wavecharge',
			'endure', 'terablast', 'torrentrush',
			...MONKEY_STATUS,
			...MONKEY_COVERAGE,
		],
	},
};

/**
 * And the same three, one stage down.
 *
 * The Chandelure line got all three stages on the stated principle that a buff
 * belongs to the family and not to the last form. The monkeys got the last form
 * only, which was an oversight rather than a decision: Pansage, Pansear and
 * Panpour are the same Pokemon with the same problem - the most on-the-nose
 * weather trio in the game, and not a weather ability between them - and they
 * are the stage that is actually played, because Little Cup is where a 316 base
 * stat Pokemon has a game to be in.
 *
 * Identical lists rather than a reduced set. A pre-evolution's moves are
 * inherited by what it becomes, so anything held back here would have to be
 * given back a line later, and the three evolved forms already have every one
 * of these - which is what makes this cost nothing above Little Cup and be the
 * whole point below it.
 */
const PAN = {
	pansage: MONKEYS.simisage,
	pansear: MONKEYS.simisear,
	panpour: MONKEYS.simipour,
};

/**
 * The Chandelure family.
 *
 * A Ghost-type lamp whose Pokedex entries are about drawing spirits in and not
 * letting them leave, carrying Flash Fire, Flame Body and Infiltrator - three
 * abilities about being on fire, one of them about walking through walls, and
 * none about the thing the Pokemon actually is. Shadow Tag is the ability that
 * describes it.
 *
 * All three stages, because a buff belongs to the family and not to the last
 * form, and the Mega with them.
 *
 * Worth knowing what this costs in tiers: Shadow Tag is banned by name in
 * National Dex, so a Chandelure holding it is legal in RP Ubers, RP Battle and
 * RP Random Battle, and refused by RP OU, UU and RU. That is not a mistake to
 * route around - trapping is why those tiers ban it, and a Chandelure that
 * traps is an Ubers Pokemon. If it should be playable further down, the answer
 * is the monkeys' answer: our own name for it, which no tier has banned.
 */
const CHANDELURE = {
	litwick: { abilities: ['Shadow Tag'] },
	lampent: { abilities: ['Shadow Tag'] },
	chandelure: { abilities: ['Shadow Tag'] },
	// `sole`: a Mega has one ability slot, and this is what goes in it, in place
	// of the Infiltrator it was given. Nothing else on a Mega is ever read.
	chandeluremega: { abilities: ['Shadow Tag'], sole: true },
};

/**
 * Nuzleaf, and the one move nobody else has any business with.
 *
 * Merchant's Call is Nuzleaf's alone - the move checks the species itself, so
 * this learnset entry is only about who can *select* it - and it is here rather
 * than in a learnset file because that is where every other addition of ours
 * goes: one table, one record of what changed, one client section listing it.
 *
 * Not Seedot and not Shiftry. The pact was made with the one in the middle.
 */
const NUZLEAF = {
	nuzleaf: { moves: ['merchantscall'] },
};

exports.Buffs = {
	...MONKEYS,
	...PAN,
	...CHANDELURE,
	...NUZLEAF,
};

/*
 * Balance Patch 1: a hundred-odd underdogs, Mew, Regigigas, and the evolution
 * levels. Its table needs the Pokedex to find pre-evolutions, so it is merged in
 * when the buffs are applied - see applyBuffs below and balance-patch-1.js.
 */
const PATCH1 = require('./balance-patch-1.js');

/**
 * Add the abilities to a species, past the three slots it has.
 *
 * A species carries its abilities as slots - 0, 1, H for hidden, S for a one-off
 * event - and there are only ever four. A buff can hand out more than that, so
 * the extras go in under keys of our own. The engine reads the values rather
 * than the keys wherever it matters (the validator checks membership, the
 * client reads the four it knows), so an extra key is invisible to everything
 * that should not see it and available to everything that should.
 */
function addAbilities(species, abilities, sole) {
	if (!abilities.length) return;

	/*
	 * A Mega Evolution has exactly one ability, and the engine reads it from
	 * slot 0 - forme-changing into the Mega sets that slot's ability and nothing
	 * else - so for a Mega this replaces rather than adds. There is no additive
	 * option: an ability in any other slot on a Mega is never reached.
	 */
	if (sole) {
		species.abilities = { 0: abilities[0] };
		return;
	}

	const existing = new Set(Object.values(species.abilities || {}));
	let extra = 0;
	for (const ability of abilities) {
		if (existing.has(ability)) continue;
		if (!species.abilities['1']) {
			species.abilities['1'] = ability;
		} else {
			/*
			 * Slots of our own, and deliberately not 'H' or 'S'.
			 *
			 * Both of those mean something. 'H' is the Hidden Ability, which drags
			 * in rules of its own - gender locks, unreleased checks, a different
			 * legality path - and 'S' is the event-only slot, the wrong home for
			 * something we want people to pick freely. The validator only ever asks
			 * whether the ability is one of the species' values, so a key it has
			 * never seen works perfectly and carries none of that baggage.
			 */
			while (species.abilities[`V${extra}`]) extra++;
			species.abilities[`V${extra++}`] = ability;
		}
		existing.add(ability);
	}
}

/**
 * Does this Pokemon already get this move, counting what it learned as a baby?
 *
 * A learnset entry only lists what that stage learns itself; everything from
 * earlier stages comes along implicitly, and the validator knows it. So asking
 * `Learnsets.simisage.learnset.nastyplot` gets "no" for a move Simisage has
 * always had, because it is Pansage who learns it.
 *
 * Getting this wrong does nothing to the game - adding a move twice is harmless
 * - but it would have the client announcing Nasty Plot, Sunny Day and Flame
 * Charge as things this server handed out, which is the one thing the buff
 * display exists not to do.
 */
function alreadyKnows(Pokedex, Learnsets, id, move) {
	const seen = new Set();
	let current = id;
	while (current && !seen.has(current)) {
		seen.add(current);
		if (Learnsets[current] && Learnsets[current].learnset && Learnsets[current].learnset[move]) return true;
		const species = Pokedex[current];
		const prevo = species && species.prevo;
		current = prevo ? String(prevo).toLowerCase().replace(/[^a-z0-9]+/g, '') : null;
	}
	return false;
}

/**
 * Moves handed to a whole type rather than to one Pokemon.
 *
 * Wave Charge was written because Water had no answer to Flame Charge, and it
 * was never meant to stay the monkeys'. This is where it goes out.
 *
 * The shape of the distribution is copied rather than invented. Flame Charge is
 * on 92% of Fire-types - 71 of 77 - and it does not care whether they attack
 * physically or specially; Ogerpon-Hearthflame and Torkoal get it alike. The
 * six it misses are almost all alternate formes of a Pokemon that is not really
 * Fire: Rotom-Heat, Arceus-Fire, Ogerpon-Hearthflame. Trailblaze is the same
 * story at 74% of Grass. So the honest mirror is "every Water-type", with the
 * same kind of exception carved out, not a shortlist of the ones that would
 * enjoy it most.
 *
 * `also` is the part no data field can answer: Pokemon that are plainly marine
 * and happen not to be Water-typed. Eels, a sea urchin, two lots of coral, an
 * anchor wrapped in seaweed, two whales and a penguin.
 */
const DISTRIBUTED = {
	wavecharge: {
		types: ['Water'],
		also: [
			'tynamo', 'eelektrik', 'eelektross',   // eels
			'pincurchin',                          // sea urchin
			'corsolagalar', 'cursola',             // coral
			'dhelmise',                            // anchor and seaweed
			'cetoddle', 'cetitan',                 // whales
			'eiscue',                              // penguin

			/*
			 * And the two that learn things for reasons of their own.
			 *
			 * Both are Normal-typed, so the sweep above never reaches them, and
			 * both have a claim that has nothing to do with being Water. Arceus
			 * made the place; Mew learns every machine move there is - it already
			 * has 234 of the 242 in the data, and this is one it did not have.
			 *
			 * They get this one and not the three Rush moves, and that is not an
			 * oversight. Wave Charge was written to be handed out and is marked
			 * `velvetShared` so the signature table skips it. The Rush moves are
			 * the opposite: one per monkey, each the only thing that family has.
			 * Handing one to Arceus makes it a move two families know, which is
			 * precisely what stops a move being a signature - Simisage would lose
			 * the only signature move it has ever had so that a god could have a
			 * fourth way to go first.
			 */
			'arceus',
			'mew',
		],
		// Formes of a Pokemon that is not really of this type - the same ones
		// Flame Charge skips on the Fire side. Arceus-Water is not here: its base
		// forme is on the list above, and every plate inherits from it.
		except: ['rotomwash', 'ogerponwellspring', 'ogerponwellspringtera'],
	},
};

/**
 * Work out who a distributed move actually goes to.
 *
 * Mega Evolutions, Gigantamax formes and Totem Pokemon are left out: none of
 * them is a Pokemon you build, they inherit what their base form knows, and
 * listing them would triple the table for nothing.
 */
function distributionFor(Pokedex, rule) {
	const skip = new Set(rule.except || []);
	const out = [];
	for (const [id, species] of Object.entries(Pokedex)) {
		if (skip.has(id)) continue;
		if (!species.types || !species.num || species.num < 0) continue;
		if (/-(Mega|Gmax|Totem)/.test(species.name || '')) continue;
		if (/-Tera$/.test(species.name || '')) continue;
		if (rule.types.some(type => species.types.includes(type))) out.push(id);
	}
	for (const id of rule.also || []) {
		if (Pokedex[id] && !out.includes(id)) out.push(id);
	}
	return out;
}

/**
 * What the buffs actually changed, filled in as they are applied.
 *
 * Not the same thing as the lists above. A buff names everything a Pokemon
 * should have, including moves it already had - Substitute and Taunt are on the
 * monkey list because two of the three were missing them - and showing those to
 * a player as "new" would be a lie. This records only what was really added, so
 * the client can label a move as ours because it is.
 *
 * Read by scripts/build-buffs.js, which turns it into client/js/velvet-buffs.js.
 */
exports.applied = {};

/** Put the buffs into the dex the server is about to use. */
exports.applyBuffs = (Pokedex, Learnsets) => {
	/*
	 * Balance Patch 1 first joins the table (once), then its evolution levels go
	 * onto the species that evolve - Showdown keeps evoLevel on the evolved form.
	 */
	if (!exports.Buffs.__patch1) {
		Object.defineProperty(exports.Buffs, '__patch1', { value: true, enumerable: false });
		Object.assign(exports.Buffs, PATCH1.buildBuffs(Pokedex));
	}
	for (const [id, change] of Object.entries(PATCH1.EVOLUTIONS)) {
		const species = Pokedex[id];
		if (!species) continue;
		if (species.evoLevel === change.from) species.evoLevel = change.to;
		/*
		 * `from` naming an item adds a level evolution beside it: the stone still
		 * works any time, and the level is the other way. The dex keeps the item
		 * (so the validator does not start demanding that level); the extra level
		 * rides along as data for the RP bot, the doc and the patch notes.
		 */
		else if (typeof change.from === 'string' && species.evoItem === change.from) {
			species.velvetLevelToo = change.to;
		}
	}

	/*
	 * The type-wide moves first, so a Pokemon that also has a buff of its own
	 * ends up with both and is recorded once for each.
	 */
	for (const [move, rule] of Object.entries(DISTRIBUTED)) {
		for (const id of distributionFor(Pokedex, rule)) {
			/*
			 * No inheritance check here, unlike a per-Pokemon buff.
			 *
			 * The usual check walks back through the pre-evolutions, because a
			 * move Pansage learns is a move Simisage has and announcing it twice
			 * would be a lie. For a move that did not exist until this server
			 * wrote it, that check only ever fires against our own distribution -
			 * so Squirtle got Wave Charge and Blastoise was told it already knew
			 * it, which left the evolution without an entry of its own and
			 * without a line in the buff table the client reads.
			 */
			const entry = Learnsets[id] || (Learnsets[id] = { learnset: {} });
			entry.learnset = entry.learnset || {};
			if (!entry.learnset[move]) entry.learnset[move] = ['9M'];

			// Recorded for every species that gets it, not just the first stage.
			// The server lets an evolution inherit its baby's moves; the client's
			// buff section reads this table per Pokemon, and a Blastoise whose
			// section is empty because Squirtle was written first looks like a bug.
			const record = exports.applied[id] || (exports.applied[id] = { moves: [], abilities: [] });
			if (!record.moves.includes(move)) record.moves.push(move);
		}
	}

	for (const [id, buff] of Object.entries(exports.Buffs)) {
		const species = Pokedex[id];
		if (!species) continue;   // a Pokemon that no longer exists is not an error

		const record = exports.applied[id] || (exports.applied[id] = { moves: [], abilities: [] });
		const hadAbilities = new Set(Object.values(species.abilities || {}));

		if (buff.abilities?.length) addAbilities(species, buff.abilities, buff.sole);
		for (const ability of Object.values(species.abilities || {})) {
			if (!hadAbilities.has(ability) && !record.abilities.includes(ability)) {
				record.abilities.push(ability);
			}
		}

		if (buff.moves?.length && Learnsets) {
			const entry = Learnsets[id] || (Learnsets[id] = { learnset: {} });
			entry.learnset = entry.learnset || {};
			for (const move of buff.moves) {
				// '9M' is "taught by machine, generation 9". The letter is not
				// decoration: the validator dispatches on it and only knows L, M, T,
				// R, E, S, D and V, so a source it does not recognise is walked
				// straight past and the move comes back unlearnable. '9a' belongs to
				// the client's teambuilder table, which is a different file in a
				// different format - see installBuffs() in client/js/velvet-data.js.
				if (alreadyKnows(Pokedex, Learnsets, id, move)) continue;
				entry.learnset[move] = ['9M'];
				if (!record.moves.includes(move)) record.moves.push(move);
			}
		}
	}
};
