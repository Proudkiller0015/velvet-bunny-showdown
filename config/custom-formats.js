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

		// Challengeable and usable in the builder, but kept off the ladder: nothing
		// with no rules at all belongs on a rating.
		searchShow: false,
		challengeShow: true,
		rated: false,
	},
];
