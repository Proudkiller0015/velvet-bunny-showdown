'use strict';
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

	for (const side of battle.sides) {
		// Everything Dynamax needs - the volatile, the Max moves, the base power
		// tables - is still in the ninth-generation data, marked as belonging to
		// the past. Only the two refusals are in the way.
		side.dynamaxUsed = false;
		side.canDynamaxNow = function () { return !this.dynamaxUsed; };

		for (const pokemon of side.pokemon) {
			// A Mega Stone rules out the other two before a battle even starts:
			// Terastallization is refused to anyone holding one, and the Dynamax
			// request checks the same thing. Neither is a rule anybody chose, so
			// both are undone and the Pokemon decides for itself.
			if (pokemon.canMegaEvo && !pokemon.canTerastallize) {
				pokemon.canTerastallize = pokemon.teraType;
			}

			const dynamaxRequest = pokemon.getDynamaxRequest.bind(pokemon);
			pokemon.getDynamaxRequest = function (skipChecks) {
				if (this.m.rpGimmickUsed) return undefined;
				const stone = this.canMegaEvo;
				this.canMegaEvo = null;
				try {
					return dynamaxRequest(skipChecks);
				} finally {
					this.canMegaEvo = stone;
				}
			};
		}
	}

	const actions = battle.actions;
	const runMegaEvo = actions.runMegaEvo.bind(actions);
	actions.runMegaEvo = function (pokemon) {
		const evolved = runMegaEvo(pokemon);
		if (evolved) spend(pokemon);
		return evolved;
	};

	const terastallize = actions.terastallize.bind(actions);
	actions.terastallize = function (pokemon) {
		const result = terastallize(pokemon);
		spend(pokemon);
		return result;
	};

	// Dynamax has no method of its own - the battle applies it inline - so it is
	// caught where the action is run rather than where it is written.
	const runAction = battle.runAction.bind(battle);
	battle.runAction = function (action) {
		const result = runAction(action);
		if (action.choice === 'runDynamax') spend(action.pokemon);
		return result;
	};
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
 * `!Terastal Clause` undoes National Dex's ban on Terastallization, because RP
 * offers all three gimmicks rather than none.
 */
const RP_RULES = ['!Obtainable Misc', '!Terastal Clause'];

/** One RP tier, standing on the National Dex tier of the same shape. */
function rpTier(name, base, extra = {}) {
	return {
		name: `[Gen 9] RP ${name}`,
		mod: 'gen9',
		ruleset: [base, ...RP_RULES],
		checkCanLearn: levelFreeMoves,
		onBegin: allGimmicks,
		searchShow: true,
		challengeShow: true,
		tournamentShow: true,
		rated: true,
		...extra,
	};
}

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
	rpTier('Ubers', '[Gen 9] National Dex Ubers'),
	rpTier('OU', '[Gen 9] National Dex'),
	rpTier('UU', '[Gen 9] National Dex UU'),
	rpTier('RU', '[Gen 9] National Dex RU'),
];
