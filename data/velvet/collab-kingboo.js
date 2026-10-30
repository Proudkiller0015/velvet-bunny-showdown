'use strict';
/**
 * King Boo, from Nintendo's Mario series and Luigi's Mansion. The crowned king of the
 * Boos: shy while you look at him, bold the moment your back is turned, and fond of
 * sealing his guests inside paintings. A Collab Pokemon: see collab.js for the tier.
 * The owner's Halloween board, 2 days every 30 and 31 October (rp-bot gacha.js).
 *
 *   King Boo   Ghost/Fairy   95 / 60 / 90 / 125 / 110 / 80   560
 *
 *   Bashful King      a Boo's shyness: hit by a faster Pokemon (it is facing him) he
 *                     covers his face and takes 2/3 damage; attacking a slower one
 *                     (he gives chase) his attacks do 1.3x.
 *   Painting Prison   Ghost, special, 80, 100%. Traps the target for 4 or 5 turns, while
 *                     King Boo stays in.
 */

const ID = 'kingboo';
const ABILITY = 'Bashful King';
const MOVE = 'Painting Prison';

const DEX_ENTRY = "The crowned king of the Boos. Look straight at it and it hides its face in shame; turn your back and it is upon you. Guests who wander into its mansion are sealed inside paintings, and its gallery is said to have no end.";

exports.pokedex = (data) => {
	data[ID] = {
		num: 2009,
		gen: 9,
		name: 'King Boo',
		types: ['Ghost', 'Fairy'],
		gender: 'N',
		baseStats: { hp: 95, atk: 60, def: 90, spa: 125, spd: 110, spe: 80 },
		abilities: { 0: ABILITY },
		heightm: 1.5,
		weightkg: 0.1,
		color: 'White',
		eggGroups: ['Undiscovered'],
		tags: [],
	};
	return data;
};

exports.abilities = (data) => {
	data.bashfulking = {
		name: ABILITY,
		num: -309,
		gen: 9,
		rating: 3.5,
		// Plain Speed stats, as Analytic and the like see them: Trick Room does not change who is faster.
		onSourceModifyDamage(damage, source, target, move) {
			if (source && source !== target && source.getStat('spe') > target.getStat('spe')) {
				this.debug('Bashful King hides its face');
				return this.chainModify([2732, 4096]);
			}
		},
		onModifyDamage(damage, source, target, move) {
			if (target && target !== source && source.getStat('spe') > target.getStat('spe')) {
				this.debug('Bashful King gives chase');
				return this.chainModify([5325, 4096]);
			}
		},
		flags: { breakable: 1 },
		shortDesc: 'Takes 2/3 damage from faster attackers. Its attacks do 1.3x to slower targets.',
		desc: "If the attacker's Speed stat is higher than this Pokemon's, this Pokemon takes 2/3 damage from its attacks. If this Pokemon's Speed stat is higher than the target's, its attacks do 1.3x damage. Speed stats are compared as they are, whatever Trick Room says. Moves and abilities that ignore abilities ignore the damage reduction.",
	};
	return data;
};

exports.moves = (data) => {
	data.paintingprison = {
		num: -309,
		gen: 9,
		accuracy: 100,
		basePower: 80,
		category: 'Special',
		name: MOVE,
		pp: 10,
		priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		secondary: {
			chance: 100,
			onHit(target, source) {
				if (source.isActive) target.addVolatile('paintingprison', source);
			},
		},
		// Wrap's trap without Wrap's chip damage: the painting holds, it does not squeeze.
		condition: {
			duration: 5,
			durationCallback() {
				return this.random(4, 6);
			},
			onStart(pokemon) {
				this.add('-message', `${pokemon.name} was sealed inside a painting!`);
			},
			onResidualOrder: 13,
			onResidual(pokemon) {
				const source = this.effectState.source;
				if (source && (!source.isActive || source.hp <= 0)) {
					pokemon.removeVolatile('paintingprison');
				}
			},
			onEnd(pokemon) {
				this.add('-message', `${pokemon.name} broke free of the painting!`);
			},
			onTrapPokemon(pokemon) {
				if (this.effectState.source?.isActive) pokemon.tryTrap();
			},
		},
		target: 'normal',
		type: 'Ghost',
		shortDesc: 'Traps the target for 4-5 turns while the user stays in. King Boo.',
		desc: "Prevents the target from switching out for 4 or 5 turns, as long as the user stays in. Ghost types can still switch out. King Boo's signature move.",
	};
	return data;
};

exports.ID = ID;
exports.FORMES = [];
exports.NAMES = ['King Boo'];
exports.ABILITY_IDS = ['bashfulking'];
exports.SIGNATURE = ['paintingprison'];
exports.MOVES = [
	'shadowball', 'moonblast', 'willowisp', 'nastyplot', 'trickroom', 'painsplit', 'hex', 'taunt',
	'dazzlinggleam', 'drainingkiss', 'mysticalfire', 'darkpulse', 'psychic', 'thunderbolt', 'icebeam', 'energyball',
	'shadowsneak', 'confuseray', 'curse', 'spite', 'disable', 'trick', 'destinybond', 'protect', 'calmmind',
];
exports.DEX_ENTRY = DEX_ENTRY;
exports.SEARCH_ALIASES = [['boo', ID, 4], ['luigismansion', ID, 0], ['mario', ID, 0]];
