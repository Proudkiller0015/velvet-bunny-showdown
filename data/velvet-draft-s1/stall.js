'use strict';
/**
 * Help for stall (the owner, 29 Sep 2026: "stall needs a bit of help still").
 *
 *   Caretaker   the Blissey line's Awakened ability: when it switches out, every
 *               Pokemon on its side is cured of its status - Natural Cure for the
 *               whole team, paid for with a switch.
 *
 * Handed to Happiny, Chansey and Blissey through balance-patch-1.js (CARETAKER).
 */

exports.abilities = (data) => {
	data.caretaker = {
		name: 'Caretaker',
		num: -34,
		gen: 9,
		rating: 3,
		onSwitchOut(pokemon) {
			let cured = false;
			for (const ally of pokemon.side.pokemon) {
				if (!ally.status || ally.fainted) continue;
				ally.cureStatus(true);
				cured = true;
			}
			if (cured) this.add('-cureteam', pokemon, '[from] ability: Caretaker');
		},
		flags: {},
		shortDesc: "On switching out, cures the status of every Pokemon on its side.",
		desc: "When this Pokemon switches out, every Pokemon on its side, in battle or not, is cured of its non-volatile status condition, as Heal Bell does. Its own status is cured too.",
	};
	return data;
};
