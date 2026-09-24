'use strict';
/**
 * The tiering format, defined in this process only.
 *
 * The question the tier sim asks is "how good is this Pokemon", so the format
 * has to take away everything that is not the Pokemon. Terastallization is the
 * big one: with it, a mediocre Pokemon with a good Tera type looks strong and a
 * strong one with a bad matchup looks weak, and the RP ladders hand it back on
 * purpose (allGimmicks in config/custom-formats.js). Dynamax and Z-Moves do not
 * exist in the ninth generation's battles unless a format revives them, and the
 * drafts never hold a Z-Crystal. Megas stay, because a Mega is scored as its
 * own entry - "Garchomp-Mega" - and that is a Pokemon worth tiering.
 *
 * It is registered in Showdown's format cache rather than written to config/:
 * config/ is what the live server boots from, and scripts/setup-config.js
 * copies it into node_modules (which here is a junction to the main checkout's).
 * A format that exists only while the tier sim runs cannot leak into either.
 *
 * The clauses that only the validator enforces (Species, Evasion, OHKO) are
 * listed for the record but enforced by the drafter instead: BattleStream does
 * not validate teams, so src/tier-sim/draft.js keeps one of each species and
 * strips OHKO and evasion moves itself. The ones that act inside the battle -
 * Sleep Clause, Terastal Clause, the endless battle check - are real here.
 */

const FORMAT_NAME = '[Gen 9] Velvet Tier Sim';
const FORMAT_ID = 'gen9velvettiersim';

let registered = false;

function registerFormat() {
	if (registered) return FORMAT_ID;
	const { Dex } = require('pokemon-showdown');
	const { Format } = require('pokemon-showdown/dist/sim/dex-formats');
	Dex.formats.load();
	if (!Dex.formats.rulesetCache.has(FORMAT_ID)) {
		const def = {
			name: FORMAT_NAME,
			// gen9rp: the ninth generation with data/velvet laid over it - the buffs, the
			// Balance Patch, our Megas and forms. It is what every RP format plays on.
			mod: 'gen9rp',
			ruleset: [
				'Team Preview', 'Species Clause', 'Sleep Clause Mod', 'Evasion Moves Clause', 'OHKO Clause',
				'HP Percentage Mod', 'Cancel Mod', 'Endless Battle Clause', 'Terastal Clause',
			],
			effectType: 'Format',
			section: 'Tier Sim',
			column: 1,
			searchShow: false,
			challengeShow: false,
			tournamentShow: false,
			rated: false,
		};
		def.baseRuleset = def.ruleset.slice();
		Dex.formats.rulesetCache.set(FORMAT_ID, new Format(def));
	}
	registered = true;
	return FORMAT_ID;
}

module.exports = { registerFormat, FORMAT_ID, FORMAT_NAME };
