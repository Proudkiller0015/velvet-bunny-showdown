'use strict';
/**
 * The RP dex: the ninth generation with everything this server adds or changes
 * (data/velvet, installed as the gen9rp mod by scripts/setup-config.js).
 *
 * The base dex - require('pokemon-showdown').Dex - is Showdown's own and runs
 * the official formats. Anything that serves RP (encounters, trainers, the RP
 * bot's teams, the AI's knowledge of our Pokemon) asks here instead.
 */
let cached = null;
module.exports = function rpDex() {
	if (!cached) cached = require('pokemon-showdown').Dex.mod('gen9rp');
	return cached;
};
