'use strict';
/**
 * Hatrequeen, from Lobotomy Corporation's "The Queen of Hatred" (O-01-04, WAW risk).
 * A magical girl who fights for love and justice, and comes apart when there is no
 * villain left to fight. A Collab Pokemon: see collab.js for the tier.
 *
 *   Hatrequeen          Fairy/Psychic   90 / 70 / 90 / 130 / 100 / 110   590   Magical Girl
 *   Hatrequeen-Hatred   Fairy/Dark      90 / 110 / 80 / 150 / 80 / 120   630   hysterical
 *
 *   Love and Justice   when she ends 2 turns in a row on the field without being hit
 *                      by an attack, she turns hysterical, for good: Hatrequeen-Hatred
 *                      until she faints, switches included. A switch starts the 2 turns over.
 *   Arcana Slave       Fairy, 150, 100%. Charges a turn, as Solar Beam; physical when
 *                      her Attack is higher, as Photon Geyser. Hatrequeen-Hatred fires it
 *                      at once.
 */

const ID = 'hatrequeen';
const HATRED = 'hatrequeenhatred';
const ABILITY = 'Love and Justice';
const QUIET_TURNS = 2;

const DEX_ENTRY = "A magical girl who fights for love and justice, and needs villains to fight. Leave her with none, and the quiet grows unbearable: her love curdles, and the hero becomes the very thing she swore to destroy.";

exports.pokedex = (data) => {
	const common = {
		num: 2008,
		gen: 9,
		gender: 'F',
		abilities: { 0: ABILITY },
		heightm: 1.6,
		weightkg: 48,
		color: 'Pink',
		eggGroups: ['Undiscovered'],
		tags: [],
	};
	data[ID] = {
		...common,
		name: 'Hatrequeen',
		types: ['Fairy', 'Psychic'],
		baseStats: { hp: 90, atk: 70, def: 90, spa: 130, spd: 100, spe: 110 },
		otherFormes: ['Hatrequeen-Hatred'],
		formeOrder: ['Hatrequeen', 'Hatrequeen-Hatred'],
	};
	data[HATRED] = {
		...common,
		name: 'Hatrequeen-Hatred',
		baseSpecies: 'Hatrequeen',
		forme: 'Hatred',
		types: ['Fairy', 'Dark'],
		baseStats: { hp: 90, atk: 110, def: 80, spa: 150, spd: 80, spe: 120 },
		requiredAbility: ABILITY,
		battleOnly: 'Hatrequeen',
	};
	return data;
};

exports.abilities = (data) => {
	data.loveandjustice = {
		name: ABILITY,
		num: -252,
		gen: 9,
		rating: 3,
		// The ability's state starts afresh each time she comes in, so a switch resets the count.
		onDamagingHit(damage, target, source, move) {
			this.effectState.struck = true;
		},
		onResidualOrder: 29,
		onResidual(pokemon) {
			if (pokemon.baseSpecies.baseSpecies !== 'Hatrequeen' || pokemon.transformed || pokemon.baseSpecies.id === HATRED) return;
			if (this.effectState.struck) {
				this.effectState.struck = false;
				this.effectState.quiet = 0;
				return;
			}
			this.effectState.quiet = (this.effectState.quiet || 0) + 1;
			if (this.effectState.quiet < QUIET_TURNS) return;
			this.add('-activate', pokemon, `ability: ${ABILITY}`);
			pokemon.formeChange('Hatrequeen-Hatred', this.effect, true);
			// Back to Hatrequeen when she faints, as Zygarde-Complete goes back to Zygarde.
			pokemon.formeRegression = true;
			this.add('-message', 'The Queen of Hatred has turned hysterical!');
		},
		flags: { failroleplay: 1, noreceiver: 1, noentrain: 1, notrace: 1, failskillswap: 1, cantsuppress: 1 },
		shortDesc: 'After 2 turns in a row on the field without being hit by an attack: Hatrequeen-Hatred.',
		desc: "If Hatrequeen ends 2 turns in a row on the field without being hit by an attack, she permanently becomes Hatrequeen-Hatred (Fairy/Dark, 90/110/80/150/80/120) until she faints, switching included. Switching out starts the count over. This Ability can't be suppressed, copied, swapped or replaced.",
	};
	return data;
};

exports.moves = (data) => {
	data.arcanaslave = {
		num: -304,
		gen: 9,
		accuracy: 100,
		basePower: 150,
		category: 'Special',
		name: 'Arcana Slave',
		pp: 5,
		priority: 0,
		flags: { charge: 1, protect: 1, mirror: 1, metronome: 1, nosleeptalk: 1, failinstruct: 1 },
		// Solar Beam's charge, which Hatrequeen-Hatred skips.
		onTryMove(attacker, defender, move) {
			if (attacker.removeVolatile(move.id) || attacker.species.id === HATRED) return;
			this.add('-prepare', attacker, move.name);
			if (!this.runEvent('ChargeMove', attacker, defender, move)) return;
			attacker.addVolatile('twoturnmove', defender);
			return null;
		},
		// Photon Geyser's choice: physical when the user's Attack is the higher.
		onModifyMove(move, pokemon) {
			if (pokemon.getStat('atk', false, true) > pokemon.getStat('spa', false, true)) move.category = 'Physical';
		},
		secondary: null,
		target: 'normal',
		type: 'Fairy',
		shortDesc: 'Charges, then hits turn 2. Physical if Atk > SpA. No charge as Hatred. Hatrequeen.',
		desc: "This attack charges on the first turn and executes on the second; Hatrequeen-Hatred executes it on the first turn. If the user is holding a Power Herb, the move completes in one turn. This move becomes a physical attack if the user's Attack is greater than its Special Attack, including stat stage changes. Hatrequeen's signature move.",
	};
	return data;
};

exports.ID = ID;
exports.FORMES = [HATRED];
exports.NAMES = ['Hatrequeen', 'Hatrequeen-Hatred'];
exports.ABILITY_IDS = ['loveandjustice'];
exports.SIGNATURE = ['arcanaslave'];
exports.MOVES = [
	'moonblast', 'dazzlinggleam', 'psychic', 'psyshock', 'mysticalfire', 'aurasphere', 'darkpulse', 'hyperbeam', 'magicalleaf',
	'drainingkiss', 'calmmind', 'moonlight', 'lightscreen', 'reflect', 'healingwish', 'futuresight', 'trick', 'protect',
];
exports.DEX_ENTRY = DEX_ENTRY;
exports.SEARCH_ALIASES = [['queenofhatred', ID, 0], ['magicalgirl', ID, 0], ['hatred', HATRED, 10]];
