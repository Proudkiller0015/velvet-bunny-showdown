'use strict';
/**
 * Where Samantha sits: findable, and illegal.
 *
 * The same pair MissingNo. carries. 'Custom' is what every format that checks
 * legality refuses - the message a player gets is that she does not exist in
 * this game - while Custom Game checks nothing and lets her through. Marking
 * her Illegal as well keeps her out of any tier listing.
 */

exports.FormatsData = {
	// Eternamax, legal on this server (the owner's call) and banned down to AG:
	// playable in RP Battle and RP AG, refused by every tier below. It was
	// 'Past'/Illegal in the stock data, which National Dex reads as "does not
	// exist", so both flags are set here rather than only the tier.
	eternatuseternamax: {
		isNonstandard: null,
		tier: "AG",
		doublesTier: "DUber",
		natDexTier: "AG",
	},
	// Mega Gengar, unbanned from AG to Ubers (the owner's call): legal in RP Ubers,
	// still refused in RP OU and below. A Mega keeps its Past flag - National Dex
	// reads the Gengarite as standard there already.
	gengarmega: {
		isNonstandard: "Past",
		tier: "Illegal",
		natDexTier: "Uber",
	},
	samantha: {
		isNonstandard: "Custom",
		tier: "Illegal",
		doublesTier: "Illegal",
		natDexTier: "Illegal",
	},
};
