'use strict';
/**
 * Collab: crossover Pokemon, and the tier that holds them.
 *
 * A collab Pokemon is a guest from another series. It is not banned for being
 * strong - it is banned for being a guest: every RP format refuses it, RP AG
 * included, and the one format that takes it is RP Collab (RP AG's rules plus
 * these). On the ladder that is Collab > AG > Uber > OU > ... The refusal is a
 * banlist entry config/custom-formats.js puts on every other RP format, so the
 * validator, the bot's draft pool and anything else reading the rule table all
 * agree without being told.
 *
 * The guests, one file each, all Abnormalities from Lobotomy Corporation:
 *
 *   collab-funerfly.js     Funerfly     The Funeral of the Dead Butterflies   2004
 *   collab-punibird.js     Punibird     Punishing Bird                        2005
 *   collab-laetitia.js     Laetitia     A Wee Witch                           2006
 *   collab-freischutz.js   Freischutz   Der Freischutz                        2007
 *   collab-hatrequeen.js   Hatrequeen   The Queen of Hatred                   2008
 *
 * Each file holds its Pokemon, formes, abilities and moves; this one puts them in
 * the tier, writes their learnsets and gathers the lists everything else reads.
 */

const MONS = [
	require('./collab-funerfly.js'),
	require('./collab-punibird.js'),
	require('./collab-laetitia.js'),
	require('./collab-freischutz.js'),
	require('./collab-hatrequeen.js'),
];
const TIER = 'Collab';
// What every new Pokemon of ours gets.
const UNIVERSAL = ['terablast', 'rest', 'sleeptalk', 'substitute', 'endure'];

const SPECIES = MONS.map(mon => mon.ID);
const FORMES = MONS.flatMap(mon => mon.FORMES);
const LEARNSETS = {};
for (const mon of MONS) LEARNSETS[mon.ID] = { signature: mon.SIGNATURE, moves: [...mon.MOVES, ...UNIVERSAL] };

exports.pokedex = (data) => {
	for (const mon of MONS) mon.pokedex(data);
	return data;
};

exports.formatsData = (data) => {
	for (const id of [...SPECIES, ...FORMES]) {
		data[id] = { isNonstandard: null, tier: TIER, doublesTier: TIER, natDexTier: TIER };
	}
	return data;
};

exports.abilities = (data) => {
	for (const mon of MONS) mon.abilities(data);
	return data;
};

exports.moves = (data) => {
	for (const mon of MONS) mon.moves(data);
	return data;
};

exports.learnsets = (data) => {
	for (const [id, { signature, moves }] of Object.entries(LEARNSETS)) {
		const learnset = {};
		for (const move of signature) learnset[move] = ['9L1'];
		for (const move of moves) learnset[move] = ['9M'];
		data[id] = { learnset };
	}
	return data;
};

exports.SPECIES = SPECIES;
exports.FORMES = FORMES;
// What config/custom-formats.js bans by name from every RP format but RP Collab.
exports.NAMES = MONS.flatMap(mon => mon.NAMES);
exports.MOVE_IDS = MONS.flatMap(mon => mon.SIGNATURE);
exports.ABILITY_IDS = MONS.flatMap(mon => mon.ABILITY_IDS);
exports.LEARNSETS = LEARNSETS;
// The dex has no field for flavour text: exported for whatever shows one.
exports.DEX_ENTRIES = Object.fromEntries(MONS.map(mon => [mon.ID, mon.DEX_ENTRY]));
exports.TIER = TIER;
// For the builder's search: what it is from finds it too. [alias, species id, where in the id it starts].
exports.SEARCH_ALIASES = MONS.flatMap(mon => mon.SEARCH_ALIASES);
