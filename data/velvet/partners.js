'use strict';
/**
 * Partner Pikachu and Partner Eevee, as starters.
 *
 * In the Kagura RP a character's first Pokemon can be a Pikachu or an Eevee, and
 * the partner formes from Let's Go are what a starter of that kind should be:
 * 45 / 80 / 50 / 75 / 60 / 120 and 65 / 75 / 70 / 65 / 85 / 75. Showdown marks
 * both 'LGPE', which every format that checks legality refuses, and gives them
 * the Let's Go movepool, built around thirteen partner moves that exist nowhere
 * else.
 *
 * So here they become ordinary ninth-generation Pokemon with their real stats
 * and the movepool of the Pikachu or Eevee they are: every move the base line
 * learns in Scarlet and Violet (Pichu's included for Pikachu), plus whatever
 * this server added to it, and none of the partner moves. They hold items like
 * anything else in RP, and they do not evolve - a partner never did.
 *
 * Whether a particular player may bring one is not a question for the dex. The
 * RP team check (src/rp-server.js) allows the forme only for a box Pikachu or
 * Eevee tagged as the character's starter.
 */

const PARTNER_MOVES = [
	'zippyzap', 'floatyfall', 'splishysplash', 'pikapapow', 'bouncybubble', 'buzzybuzz', 'sizzlyslide',
	'glitzyglow', 'baddybad', 'sappyseed', 'freezyfrost', 'sparklyswirl', 'veeveevolley',
];

/*
 * Tiers. 120 Speed and a Light Ball that doubles both attacks puts Partner
 * Pikachu in PU; Partner Eevee has no evolution, so no Eviolite, and sits in ZU.
 * National Dex has nothing below RU.
 */
const PARTNERS = {
	pikachustarter: { base: ['pikachu', 'pichu'], tier: 'PU' },
	eeveestarter: { base: ['eevee'], tier: 'ZU' },
};

function applyPartners(Pokedex, Learnsets, FormatsData) {
	for (const [id, partner] of Object.entries(PARTNERS)) {
		if (!Pokedex[id]) continue;
		const learnset = {};
		for (const base of partner.base) {
			const from = Learnsets[base] && Learnsets[base].learnset;
			if (!from) continue;
			for (const [move, sources] of Object.entries(from)) {
				if (PARTNER_MOVES.includes(move)) continue;
				// Scarlet and Violet's movepool, taught as a machine: an egg or
				// level move needs a breeding or level history this forme has none of.
				if ([].concat(sources).some(s => String(s).startsWith('9'))) learnset[move] = ['9M'];
			}
		}
		Learnsets[id] = Object.assign({}, Learnsets[id], { learnset });

		const row = FormatsData[id] || (FormatsData[id] = {});
		row.isNonstandard = null;
		row.tier = partner.tier;
		row.natDexTier = 'RU';
		row.doublesTier = 'DUU';
	}
}

exports.applyPartners = applyPartners;
exports.PARTNERS = PARTNERS;
exports.PARTNER_MOVES = PARTNER_MOVES;
