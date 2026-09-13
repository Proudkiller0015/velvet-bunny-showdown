'use strict';
/**
 * Formats this server adds, on top of Showdown's own.
 *
 * Copied into the package's dist/config before boot, which is where the
 * simulator looks - sim/dex-formats.js resolves `config/custom-formats`
 * relative to dist/sim, which is a different directory to the one the server
 * config lives in. Being a supported hook rather than an edit to the package's
 * own format list, it survives upgrades.
 */
exports.Formats = [
	{
		section: "Other Metagames",
	},
	{
		name: "[Gen 9] RP Battle",
		/**
		 * Custom Game under a name people can find.
		 *
		 * Custom Game already allows everything and is already selectable in the
		 * teambuilder - it just sits near the bottom of the S/V section, after BSS
		 * Reg I, where it is easy to scroll straight past. This is the same ruleset
		 * in its own section at the top of the list.
		 *
		 * The rules are Custom Game's, which is to say almost none: no clauses, no
		 * bans, nothing checked for legality, teams of up to 24, moves that do not
		 * have to be learnable, and levels up to 9999. That is what makes Samantha
		 * legal here and nowhere else.
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
		 * ignores the bit width, which is exactly what a format allowing level 9999
		 * and 250 base stats needs. This format allows the same things, so it needs
		 * the same treatment.
		 */
		battle: { trunc: Math.trunc },
		/**
		 * All three gimmicks, one each per side, one per Pokemon.
		 *
		 * Mega Evolution, Dynamax and Terastallization each belong to a different
		 * generation and the engine only offers you the one that matches: Dynamax
		 * is refused outright outside generation 8, and a Pokemon holding a Mega
		 * Stone is quietly barred from the other two. Here all three are on the
		 * table, and choosing one spends the Pokemon's chance at the rest - so a
		 * Charizard can Mega Evolve, or Terastallize, or Dynamax, and then it has
		 * had its moment.
		 *
		 * "Once per side" needs no help: the engine already clears the option from
		 * every team-mate as soon as one of them uses it, which is how these have
		 * always worked in their own formats. What is added here is the crossover -
		 * the engine has never had to think about a Pokemon that could do all
		 * three, because no format has ever offered all three.
		 *
		 * Everything is patched on the battle in front of us rather than on the
		 * classes, so no other format on this server sees any of it.
		 */
		onBegin() {
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
				// Dynamax is switched off in two places outside generation 8: a side
				// begins the battle with its one use already spent, and the check
				// that reads that flag refuses regardless. Everything it needs -
				// the volatile, the Max moves, the base power tables - is still in
				// the ninth-generation data, marked as belonging to the past.
				side.dynamaxUsed = false;
				side.canDynamaxNow = function () { return !this.dynamaxUsed; };
				for (const pokemon of side.pokemon) {
					// A Mega Stone rules out the other two before a battle even
					// starts: Terastallization is refused to anyone holding one, and
					// the Dynamax request checks the same thing. Neither is a rule
					// anybody chose - they are how the engine keeps two mechanics it
					// was never meant to offer together apart - so both are undone,
					// and the Pokemon gets to decide for itself which one to use.
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
			// Dynamax has no method of its own - the battle applies it inline - so
			// it is caught where the action is run rather than where it is written.
			const runAction = battle.runAction.bind(battle);
			battle.runAction = function (action) {
				const result = runAction(action);
				if (action.choice === 'runDynamax') spend(action.pokemon);
				return result;
			};
		},
		// Challengeable and usable in the builder, but kept off the ladder: nothing
		// with no rules at all belongs on a rating.
		searchShow: false,
		challengeShow: true,
		rated: false,
	},
];
