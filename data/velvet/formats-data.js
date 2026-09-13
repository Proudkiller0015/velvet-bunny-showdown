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
	samantha: {
		isNonstandard: "Custom",
		tier: "Illegal",
		doublesTier: "Illegal",
		natDexTier: "Illegal",
	},
};
