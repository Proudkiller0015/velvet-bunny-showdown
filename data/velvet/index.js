'use strict';
/**
 * Everything this server adds to the game, and how it gets in.
 *
 * Showdown loads its dex from compiled files inside its own package, and offers
 * no hook for adding a species to them. A mod would be the tidy answer, except
 * that a Pokemon inside a mod does not exist anywhere else *at all* - she would
 * not be searchable, would not appear in the builder, and could not be looked
 * up. What was wanted is the opposite: findable everywhere, legal almost
 * nowhere, which is how Showdown already treats MissingNo.
 *
 * So the data goes into the base dex and is marked `isNonstandard: 'Custom'`
 * with `tier: 'Illegal'`. Every format that enforces legality refuses her on
 * those grounds; Custom Game enforces none and lets her in.
 *
 * Each function here is handed the live data object from the corresponding file
 * in the package and adds to it. scripts/setup-config.js appends a single line
 * to each of those files calling the matching one, so the package's own contents
 * are never rewritten - only extended, on every boot, and harmlessly again if
 * the package is reinstalled.
 */

const { Pokedex } = require('./pokedex.js');
const { Abilities } = require('./abilities.js');
const { Moves } = require('./moves.js');
const { FormatsData } = require('./formats-data.js');
const { Learnsets } = require('./learnsets.js');
const { patchItems } = require('./items.js');
const { applyBuffs } = require('./buffs.js');
const { unnerfMoves, unnerfAbilities } = require('./unnerfs.js');

// The buffed Pokemon are Showdown's own, so they are changed in place rather
// than added - and the learnsets they need are added when that file is loaded,
// which is a separate hook. Both sides pass the same table, so whichever loads
// second finds the other's work already done.
let buffedPokedex = null;
let buffedLearnsets = null;
function buffWhatWeHave() {
	if (buffedPokedex && buffedLearnsets) applyBuffs(buffedPokedex, buffedLearnsets);
}

exports.pokedex = data => {
	Object.assign(data, Pokedex);
	buffedPokedex = data;
	buffWhatWeHave();
};
exports.abilities = data => unnerfAbilities(Object.assign(data, Abilities));
exports.moves = data => unnerfMoves(Object.assign(data, Moves));
exports.formatsData = data => Object.assign(data, FormatsData);
exports.learnsets = data => {
	Object.assign(data, Learnsets);
	buffedLearnsets = data;
	buffWhatWeHave();
};

// Items is the odd one out: Light Ball already exists and only two of its
// handlers change, so replacing the whole entry would mean copying its number,
// its Fling and its sprite across and keeping them in step forever.
exports.items = data => patchItems(data);
