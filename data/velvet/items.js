'use strict';
/**
 * Light Ball, held by someone other than Pikachu.
 *
 * The item is hard-coded to one species - both handlers check `baseSpecies` and
 * do nothing for anybody else - so letting Samantha hold it means changing the
 * item rather than adding anything to her.
 *
 * Changed in place rather than replaced: the entry carries a number, a sprite, a
 * Fling effect and a generation, and copying all of that across to override two
 * functions would mean keeping the copy in step with the package forever.
 *
 * Stacked with Queen Wrath this is a second doubling on top of the ability's, so
 * she attacks at four times a stat that is already 250. That is the intent.
 */

const HOLDERS = ['Pikachu', 'Samantha'];

function patchItems(Items) {
	const lightBall = Items && Items.lightball;
	if (!lightBall) return Items;

	lightBall.onModifyAtkPriority = 1;
	lightBall.onModifyAtk = function (atk, pokemon) {
		if (HOLDERS.includes(pokemon.baseSpecies.baseSpecies)) {
			return this.chainModify(2);
		}
	};
	lightBall.onModifySpAPriority = 1;
	lightBall.onModifySpA = function (spa, pokemon) {
		if (HOLDERS.includes(pokemon.baseSpecies.baseSpecies)) {
			return this.chainModify(2);
		}
	};
	// What the client lists under "held by", so she shows up there too.
	lightBall.itemUser = HOLDERS.slice();
	return Items;
}

exports.patchItems = patchItems;
exports.HOLDERS = HOLDERS;
