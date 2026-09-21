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
	samantha: {
		isNonstandard: "Custom",
		tier: "Illegal",
		doublesTier: "Illegal",
		natDexTier: "Illegal",
	},
};
