'use strict';
/* eslint-disable no-empty */
try {
	// RP Random Battle needs the random team generator taught about the Pokemon
	// this server buffs. Done here because this file is loaded inside the
	// simulator process, which is the process that builds the teams - patching
	// it from the server's own entry point would never reach them.
	require('../data/velvet/random-sets.js').installRandomSets();
} catch (e) {
	console.log('[velvet] RP Random Battle sets unavailable: ' + e.message);
}
/**
 * Formats this server adds, on top of Showdown's own.
 *
 * Copied into the package's dist/config before boot, which is where the
 * simulator looks - sim/dex-formats.js resolves `config/custom-formats`
 * relative to dist/sim, which is a different directory to the one the server
 * config lives in. Being a supported hook rather than an edit to the package's
 * own format list, it survives upgrades.
 *
 * They all live in one section, RP, which the server lifts to the top of the
 * format list on boot (see rpSectionFirst() in showdown-config.js).
 *
 * The section is declared once, as its own entry. A format must NOT carry a
 * `section` of its own: the merge that joins this list to Showdown's reads any
 * entry with one as a section marker, so a tagged format is silently dropped -
 * which is exactly what happened, and it took every RP format with it.
 */

/**
 * Mega Evolution, Dynamax and Terastallization: all three, one each per side,
 * and one per Pokemon.
 *
 * Each belongs to a different generation and the engine only offers the one
 * that matches. Dynamax is refused twice over outside generation 8 - a side
 * begins with its one use already spent, and the check that reads that flag
 * refuses anyway - while a Pokemon holding a Mega Stone is quietly barred from
 * the other two, because no format has ever had to think about a Pokemon that
 * could do all three.
 *
 * "Once per side" needs no help: the engine already clears the option from
 * every team-mate as soon as one of them uses it. What is added here is the
 * crossover, and it is patched onto the battle in hand rather than onto the
 * classes, so no other format on this server sees any of it.
 */
function allGimmicks() {
	const battle = this;

	/** One gimmick to a Pokemon: using any of them uses up the others. */
	const spend = pokemon => {
		if (!pokemon) return;
		pokemon.m.rpGimmickUsed = true;
		pokemon.canMegaEvo = null;
		pokemon.canMegaEvoX = null;
		pokemon.canMegaEvoY = null;
		pokemon.canTerastallize = null;
	};

	/*
	 * Each gimmick only exists from the generation that invented it.
	 *
	 * RP runs in eight generations now, and handing a Gen 4 battle the
	 * Terastallization code is not "all three gimmicks", it is a crash waiting
	 * for somebody to click something. Mega Evolution starts in 6, Dynamax in 8,
	 * Terastallization in 9, and each block below is gated on its own.
	 */
	const hasMega = battle.gen >= 6;
	const hasDynamax = battle.gen >= 8;
	const hasTera = battle.gen >= 9;
	const hasZMove = battle.gen >= 7;

	for (const side of battle.sides) {
		// Everything Dynamax needs - the volatile, the Max moves, the base power
		// tables - is still in the ninth-generation data, marked as belonging to
		// the past. Only the two refusals are in the way.
		if (hasDynamax) {
			side.dynamaxUsed = false;
			side.canDynamaxNow = function () { return !this.dynamaxUsed; };
		}

		for (const pokemon of side.pokemon) {
			// Terastallization is taken away from two kinds of Pokemon before a
			// battle starts: anyone holding a Mega Stone (the engine keeping two
			// mechanics apart) and everyone at all under National Dex's Terastal
			// Clause. RP offers all three, so it is handed back here - at the start
			// of the battle, where the tier's own rules have already been applied and
			// undoing one cannot take the format list down with it.
			if (hasTera && !pokemon.canTerastallize && pokemon.teraType) {
				pokemon.canTerastallize = pokemon.teraType;
			}

			if (hasDynamax) {
				const dynamaxRequest = pokemon.getDynamaxRequest.bind(pokemon);
				pokemon.getDynamaxRequest = function (skipChecks) {
					if (this.m.rpGimmickUsed) return undefined;
					// The engine refuses Dynamax to anyone holding a Mega Stone or a
					// Z-crystal - two rules about not mixing generations rather than
					// about balance, which is the one thing this format is for. Both
					// are hidden for the length of the question and put straight back.
					const stone = this.canMegaEvo;
					const item = this.item;
					this.canMegaEvo = null;
					if (this.getItem().zMove) this.item = '';
					try {
						return dynamaxRequest(skipChecks);
					} finally {
						this.canMegaEvo = stone;
						this.item = item;
					}
				};
			}
		}
	}

	const actions = battle.actions;
	if (hasMega && actions.runMegaEvo) {
		const runMegaEvo = actions.runMegaEvo.bind(actions);
		actions.runMegaEvo = function (pokemon) {
			const evolved = runMegaEvo(pokemon);
			if (evolved) spend(pokemon);
			return evolved;
		};
	}

	if (hasTera && actions.terastallize) {
		const terastallize = actions.terastallize.bind(actions);
		actions.terastallize = function (pokemon) {
			const result = terastallize(pokemon);
			spend(pokemon);
			return result;
		};
	}

	// Dynamax has no method of its own - the battle applies it inline - so it is
	// caught where the action is run rather than where it is written.
	/*
	 * Z-moves are the fourth gimmick, and they play by the same rule.
	 *
	 * A Z-crystal holder can Mega Evolve, Dynamax or Terastallize instead - the
	 * engine forbids all three, for the same not-mixing-generations reason it
	 * forbids everything else here - and doing so costs them the Z-move.
	 * Firing the Z-move first costs them the other three. One per Pokemon,
	 * whichever they reach for.
	 */
	if (hasZMove && actions.canZMove) {
		const canZMove = actions.canZMove.bind(actions);
		actions.canZMove = function (pokemon) {
			if (pokemon.m.rpGimmickUsed) return undefined;
			return canZMove(pokemon);
		};

		// Where a Z-move is actually fired: the engine sets `side.zMoveUsed` here
		// and nowhere else, so this is the one place that knows it happened.
		const runMove = actions.runMove.bind(actions);
		actions.runMove = function (moveOrMoveName, pokemon, targetLoc, options) {
			const result = runMove(moveOrMoveName, pokemon, targetLoc, options);
			if (options && options.zMove) spend(pokemon);
			return result;
		};
	}

	if (hasDynamax) {
		const runAction = battle.runAction.bind(battle);
		battle.runAction = function (action) {
			const result = runAction(action);
			if (action.choice === 'runDynamax') spend(action.pokemon);
			return result;
		};
	}
}

/**
 * Moves without the level they are learned at.
 *
 * A level 5 Charizard that knows Flamethrower is the point of an RP tier: the
 * character is who they are, and the number beside the name is a detail of the
 * story rather than a record of how much grinding happened.
 *
 * Only the level is lifted. The move still has to be one that Pokemon can
 * actually learn - Blissey cannot have Flamethrower here any more than
 * anywhere else - because a tier where movepools are free is a different tier,
 * and that one is RP Battle.
 *
 * `this` is the validator, so calling its own checkCanLearn runs the real
 * check, with the level briefly set to the highest anything is learned at.
 */
function levelFreeMoves(move, species, setSources, set) {
	const level = set.level;
	set.level = 100;
	try {
		return this.checkCanLearn(move, species, setSources, set);
	} finally {
		set.level = level;
	}
}

/**
 * What every tiered RP format shares.
 *
 * `!Obtainable Misc` is where the evolution level lives: under that rule the
 * validator refuses a Charizard below level 36, and nothing else governs it.
 *
 * Terastallization is *not* switched back on here, and this is the sharp edge:
 * removing a rule that a format does not have is an error, not a no-op, and it
 * is thrown while building the format list that every connecting client asks
 * for - so one `!Terastal Clause` too many took the whole server down, not just
 * the format. National Dex bans Terastal; its sub-tiers do not all inherit that
 * ban; and there is no way to ask from here. allGimmicks() hands Terastal back
 * at the start of the battle instead, where the question can actually be asked.
 */
const RP_RULES = ['!Obtainable Misc'];

/**
 * One RP tier, standing on the Smogon tier of the same shape.
 *
 * `gen` picks which generation it is played in, and with it which list it
 * stands on: the ninth and eighth have National Dex, so those are what RP uses
 * there; nothing before the eighth has a National Dex at all, so those stand on
 * the ordinary tier of that generation.
 *
 * `rules` is for a base that has to be argued with - see the Terastal note at
 * the call sites, which is the only thing that uses it and the only thing that
 * has ever taken this server down.
 */
function rpTier(name, base, { gen = 9, rules = [], ...extra } = {}) {
	return {
		name: `[Gen ${gen}] RP ${name}`,
		mod: `gen${gen}`,
		ruleset: [base, ...RP_RULES, ...rules],
		checkCanLearn: levelFreeMoves,
		onBegin: allGimmicks,
		searchShow: true,
		challengeShow: true,
		tournamentShow: true,
		rated: true,
		...extra,
	};
}

/**
 * Terastallization, handed back where the tier took it away.
 *
 * RP offers all three gimmicks, and this is the one that needs help: National
 * Dex bans Terastallization outright, and its clause is not a validator rule
 * but an `onBegin` that walks every Pokemon and sets `canTerastallize = null`.
 * That runs after the format's own onBegin, so allGimmicks handing it back was
 * being undone a moment later - which is why Tera could be used in RP Ubers,
 * whose base has no clause, and not in RP OU, whose base does.
 *
 * The rule is therefore removed rather than worked around. Removing a rule a
 * format does not have is an error, not a no-op, and it is thrown while
 * building the format list that every connecting client asks for - one
 * `!Terastal Clause` too many took the whole server down once. So this is
 * applied only to the three bases that actually carry it, which was measured
 * rather than assumed:
 *
 *   National Dex, National Dex UU, National Dex RU   carry it
 *   National Dex Ubers, National Dex AG, NU, PU, ZU  do not
 *
 * The check that every format builds its rule table runs before each deploy and
 * is what would catch this changing upstream.
 */
const UNBAN_TERA = ['!Terastal Clause'];

/**
 * And the same argument for Dynamax, in the eighth generation.
 *
 * National Dex bans Dynamax there exactly as it bans Terastallization in the
 * ninth, and for the same reason: it is the tier's defining decision. RP's
 * defining decision is the opposite one, so the clause comes off.
 *
 * Measured as well: both Gen 8 National Dex and Gen 8 National Dex Ubers carry
 * it, so both Gen 8 RP tiers remove it and nothing else does.
 */
const UNBAN_DYNAMAX = ['!Dynamax Clause'];

/**
 * The Broken Pact, kept where it belongs.
 *
 * A Nuzleaf is an RU Pokemon holding a nine-hundred-point base stat total: the
 * first knockout turns it into 190 / 190 / 190, and Merchant's Call means the
 * knockout is on a five-PP timer the other player does not get a vote on. That
 * is an Ubers item on a Pokemon nobody prepares for, which is funny exactly once
 * per tier and then stops being funny.
 *
 * So it is banned by name everywhere below Ubers, and legal in Ubers, AG and RP
 * Battle. Only the ninth generation needs saying: the item is `gen: 9`, and the
 * validator refuses an item from a later generation than the format's on its
 * own, so the past-gen RP tiers are already covered.
 */
const UBERS_ONLY_ITEM = { banlist: ['Broken Pact'] };

exports.Formats = [
	{
		section: "RP",
		column: 1,
	},
	{
		name: "[Gen 9] RP Battle",

		/**
		 * The one with no rules at all.
		 *
		 * Custom Game under a name people can find, and the only tier Samantha is
		 * legal in: no clauses, no bans, nothing checked, teams of up to 24, moves
		 * that need not be learnable, levels up to 9999. The tiers below are for
		 * battles that are meant to be fair; this one is for whatever the story
		 * needs.
		 */
		ruleset: [
			'Team Preview',
			'Cancel Mod',
			'Max Team Size = 24',
			'Max Move Count = 24',
			'Max Level = 9999',
			'Default Level = 100',
		],

		/**
		 * The stat overflow the cartridge has, which Custom Game turns off.
		 *
		 * Nature multipliers are applied as `trunc(trunc(stat * 110, 16) / 100)` -
		 * truncated to sixteen bits, the way the games do it. A stat above 595 with
		 * a boosting nature overflows: Samantha's 599 Speed becomes 65890, which
		 * wraps to 354, which divides to 3. She was outrun by everything.
		 *
		 * Custom Game sidesteps it by replacing the battle's `trunc` with one that
		 * ignores the bit width, which is what a format allowing level 9999 and 250
		 * base stats needs. This format allows the same things.
		 */
		battle: { trunc: Math.trunc },

		onBegin: allGimmicks,

		// Challengeable and usable in the builder, but kept off the ladder:
		// nothing with no rules at all belongs on a rating.
		searchShow: false,
		challengeShow: true,
		rated: false,
	},

	/**
	 * The ladder: our own National Dex, tier by tier.
	 *
	 * Every Pokemon that ever existed, tiered by how it actually performs rather
	 * than by which generation it came from. These four stand on Smogon's own
	 * National Dex lists, which is the part nobody should invent from scratch:
	 * they are built from real usage and they update when Smogon updates.
	 *
	 * National Dex tiering stops at RU - everything below is pooled there - so
	 * NU, PU and ZU need a list that does not exist yet and are missing rather
	 * than present and wrong. See scripts/build-rp-tiers.js when they arrive.
	 */
	{
		name: "[Gen 9] RP Random Battle",
		desc: "Random teams on this server's own dex - buffs, un-nerfs and all.",

		/**
		 * Random Battle, but played on our data.
		 *
		 * Every change this server makes lives in the base dex, so a random
		 * battle here already hands out the un-nerfed Protean, the Battle Bond
		 * that still transforms, and Dark Void at the accuracy it used to have.
		 * What it could not do was roll a buffed Pokemon: Showdown's set table
		 * has no entry for a Simisage, so the one format meant to show this
		 * server off was the one that never showed any of it.
		 *
		 * data/velvet/random-sets.js fills that in, for this format only.
		 */
		mod: 'gen9',
		team: 'random',
		ruleset: ['Obtainable', 'Species Clause', 'HP Percentage Mod', 'Cancel Mod', 'Sleep Clause Mod', 'Illusion Level Mod'],

		searchShow: true,
		challengeShow: true,
		tournamentShow: true,
		rated: true,
	},

	// Above Ubers: the tier with nothing taken out of it.
	rpTier('AG', '[Gen 9] National Dex AG'),
	rpTier('Ubers', '[Gen 9] National Dex Ubers'),
	rpTier('OU', '[Gen 9] National Dex', { rules: UNBAN_TERA, ...UBERS_ONLY_ITEM }),
	rpTier('UU', '[Gen 9] National Dex UU', { rules: UNBAN_TERA, ...UBERS_ONLY_ITEM }),
	rpTier('RU', '[Gen 9] National Dex RU', { rules: UNBAN_TERA, ...UBERS_ONLY_ITEM }),

	/**
	 * Below RU, where National Dex stops.
	 *
	 * National Dex tiers everything weaker than RU *as* RU - one pool of nearly
	 * six hundred Pokemon - so there is no ND list to stand on down here. These
	 * three stand on the ninth generation's own NU, PU and ZU instead, which are
	 * real lists maintained from real usage.
	 *
	 * The trade is that a Pokemon with no ninth-generation tier - anything that
	 * did not make it into Scarlet and Violet - is not in them, so these are the
	 * three RP tiers that are not full National Dex. Fixing that means tiering
	 * several hundred Pokemon from usage statistics, which is a job of its own
	 * and a list that has to be maintained; until then, being narrower than
	 * promised beats being wrong about who belongs.
	 */
	rpTier('NU', '[Gen 9] NU', UBERS_ONLY_ITEM),
	rpTier('PU', '[Gen 9] PU', UBERS_ONLY_ITEM),
	rpTier('ZU', '[Gen 9] ZU', UBERS_ONLY_ITEM),

	/**
	 * The same idea, in the generations that came before.
	 *
	 * OU and Ubers only. Those are the two tiers every generation has had for
	 * its whole life, they are the two anybody asks for, and a past generation
	 * with nine RP tiers in it would be nine empty queues.
	 *
	 * What each stands on differs, and has to: the eighth generation has a
	 * National Dex and uses it, so RP there is the same "everything that ever
	 * existed" idea as the ninth. Nothing earlier has a National Dex at all -
	 * the concept did not exist - so those stand on that generation's own OU and
	 * Ubers, which is what those words mean there.
	 *
	 * Gimmicks follow the generation rather than the tier. allGimmicks hands out
	 * Mega Evolution from the sixth, Dynamax from the eighth and
	 * Terastallization from the ninth, so a Gen 8 RP battle has Megas and
	 * Dynamax and no Tera, and a Gen 3 RP battle has none of the three - which
	 * is the point of playing Gen 3.
	 */
	{
		section: "RP Past Gens",
		column: 1,
	},
	rpTier('Ubers', '[Gen 8] National Dex Ubers', { gen: 8, rules: UNBAN_DYNAMAX }),
	rpTier('OU', '[Gen 8] National Dex', { gen: 8, rules: UNBAN_DYNAMAX }),
	rpTier('Ubers', '[Gen 7] Ubers', { gen: 7 }),
	rpTier('OU', '[Gen 7] OU', { gen: 7 }),
	rpTier('Ubers', '[Gen 6] Ubers', { gen: 6 }),
	rpTier('OU', '[Gen 6] OU', { gen: 6 }),
	rpTier('Ubers', '[Gen 5] Ubers', { gen: 5 }),
	rpTier('OU', '[Gen 5] OU', { gen: 5 }),
	rpTier('Ubers', '[Gen 4] Ubers', { gen: 4 }),
	rpTier('OU', '[Gen 4] OU', { gen: 4 }),
	rpTier('Ubers', '[Gen 3] Ubers', { gen: 3 }),
	rpTier('OU', '[Gen 3] OU', { gen: 3 }),
	rpTier('Ubers', '[Gen 2] Ubers', { gen: 2 }),
	rpTier('OU', '[Gen 2] OU', { gen: 2 }),
	rpTier('Ubers', '[Gen 1] Ubers', { gen: 1 }),
	rpTier('OU', '[Gen 1] OU', { gen: 1 }),
];
