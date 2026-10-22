'use strict';
/**
 * Laetitia, from Lobotomy Corporation's "A Wee Witch" (O-01-67, HE risk). A little
 * witch who hands everyone a present, and inside every present is her friend. A
 * Collab Pokemon: see collab.js for the tier.
 *
 *   Laetitia   Fairy/Ghost   85 / 105 / 80 / 90 / 95 / 100   555
 *
 *   Wee Witch's Gift   Fairy, status, 100%. The target gets a gift; it fails if the
 *                      target already has one. At the end of the third turn after, the
 *                      gift bursts into her friend: 1/3 of the target's maximum HP. The
 *                      gift goes where the target goes: switched out, it waits, and
 *                      bursts at the end of the first turn back once its time is up.
 *   Dear Friends       her attacks deal 1.3x to a target carrying a gift from her side.
 */

const ID = 'laetitia';
const GIFT = "Wee Witch's Gift";

const DEX_ENTRY = "A little witch who wants nothing more than friends. She has a present for everyone she meets, and something inside each box is very eager to come out and say hello. She means well. Her friend has never learned to be gentle.";

exports.pokedex = (data) => {
	data[ID] = {
		num: 2006,
		gen: 9,
		name: 'Laetitia',
		types: ['Fairy', 'Ghost'],
		gender: 'F',
		baseStats: { hp: 85, atk: 105, def: 80, spa: 90, spd: 95, spe: 100 },
		abilities: { 0: 'Dear Friends' },
		heightm: 1.2,
		weightkg: 26,
		color: 'Pink',
		eggGroups: ['Undiscovered'],
		tags: [],
	};
	return data;
};

/** The gift a Pokemon carries, if any: { turn it bursts on, the side that gave it }. */
const giftOf = pokemon => pokemon.m.weeWitchGift;

exports.abilities = (data) => {
	data.dearfriends = {
		name: 'Dear Friends',
		num: -250,
		gen: 9,
		rating: 2,
		onModifyDamage(damage, source, target, move) {
			const gift = giftOf(target);
			if (gift && gift.side === source.side.id) {
				this.debug('Dear Friends boost');
				return this.chainModify([5325, 4096]);
			}
		},
		flags: {},
		shortDesc: "This Pokemon's attacks deal 1.3x damage to a target carrying a Wee Witch's Gift from its side.",
		desc: "This Pokemon's attacks deal 1.3x damage to a target that carries a gift from Wee Witch's Gift given by a Pokemon on this Pokemon's side.",
	};
	return data;
};

exports.moves = (data) => {
	data.weewitchsgift = {
		num: -302,
		gen: 9,
		accuracy: 100,
		basePower: 0,
		category: 'Status',
		name: GIFT,
		pp: 10,
		priority: 0,
		flags: { protect: 1, reflectable: 1, mirror: 1, metronome: 1 },
		onTryHit(target) {
			if (giftOf(target)) return false;
		},
		onHit(target, source) {
			target.m.weeWitchGift = { turn: this.turn + 3, side: source.side.id };
			this.add('-start', target, `move: ${GIFT}`);
			target.side.addSideCondition('weewitchsgift');
		},
		/*
		 * The gift is kept on the Pokemon (pokemon.m), which a switch never clears - a
		 * volatile would go with the first switch, and a slot condition stays in the slot
		 * while the Pokemon leaves it. What it needs besides is a clock that runs for the
		 * Pokemon wherever it is: this side condition, on the side of whoever carries one,
		 * looks at each of its Pokemon on the field at the end of every turn. It lasts as
		 * long as somebody on that side still carries a gift.
		 */
		condition: {
			onResidualOrder: 4,
			onResidual(pokemon) {
				const gift = giftOf(pokemon);
				if (!gift || this.turn < gift.turn) return;
				delete pokemon.m.weeWitchGift;
				this.add('-end', pokemon, `move: ${GIFT}`);
				this.damage(pokemon.baseMaxhp / 3, pokemon, null, this.dex.conditions.get('weewitchsgift'));
				if (!pokemon.side.pokemon.some(ally => giftOf(ally) && !ally.fainted)) pokemon.side.removeSideCondition('weewitchsgift');
			},
			// Back on the field, it is seen carrying its gift again.
			onSwitchIn(pokemon) {
				if (giftOf(pokemon)) this.add('-start', pokemon, `move: ${GIFT}`, '[silent]');
			},
			// A gift does not outlive its carrier (Revival Blessing brings it back empty-handed).
			onFaint(pokemon) {
				delete pokemon.m.weeWitchGift;
			},
		},
		secondary: null,
		target: 'normal',
		type: 'Fairy',
		shortDesc: 'Gives a gift that bursts for 1/3 max HP 3 turns later. Follows the target. Laetitia.',
		desc: "The target is given a gift; fails if it already carries one. At the end of the third turn after this move is used, the gift bursts and the target loses 1/3 of its maximum HP, rounded down. The gift stays with the target when it switches out: if its time comes while the target is out of play, it bursts at the end of the first turn the target is back. Magic Guard prevents the damage. Laetitia's signature move.",
	};
	return data;
};

exports.ID = ID;
exports.FORMES = [];
exports.NAMES = ['Laetitia'];
exports.ABILITY_IDS = ['dearfriends'];
exports.SIGNATURE = ['weewitchsgift'];
exports.MOVES = [
	'playrough', 'spiritbreak', 'poltergeist', 'shadowclaw', 'shadowsneak', 'moonblast', 'shadowball', 'drainingkiss',
	'mysticalfire', 'hex', 'willowisp', 'trick', 'bestow', 'fling', 'nastyplot', 'charm', 'sweetkiss', 'protect',
];
exports.DEX_ENTRY = DEX_ENTRY;
exports.SEARCH_ALIASES = [['weewitch', ID, 0], ['aweewitch', ID, 0]];
