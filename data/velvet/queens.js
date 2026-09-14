'use strict';
/**
 * Who counts as a queen, for everything that tries to take her apart.
 *
 * This lives on its own because two different files ask the question and they
 * must not drift. data/velvet/moves.js patches Destiny Bond and Imprison;
 * data/velvet/abilities.js patches Imposter and Wandering Spirit. All four are
 * the same idea - something that reaches across and does a thing to her without
 * ever aiming a move at her, so nothing on her side gets a say - and all four
 * need the same answer to "is this her?".
 *
 * The volatile is the half that is easy to forget. Queen's Morph replaces its
 * own ability the moment it Transforms, so after the first turn she is holding
 * a copy of whatever she is looking at; the volatile is the only thing still
 * saying who she is. Checking the ability alone protects her for exactly one
 * switch-in, which is the bug this has already caused twice.
 */

const QUEEN_ABILITIES = ['queenwrath', 'queensmorph'];

function queenProtected(pokemon) {
	if (!pokemon) return false;
	if (QUEEN_ABILITIES.includes(pokemon.ability)) return true;
	return !!(pokemon.volatiles && pokemon.volatiles['queensmorph']);
}

exports.QUEEN_ABILITIES = QUEEN_ABILITIES;
exports.queenProtected = queenProtected;
