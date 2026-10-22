'use strict';
/**
 * Freischutz, from Lobotomy Corporation's "Der Freischutz" (F-01-69, HE risk). A
 * marksman who bought bullets that never miss, and pays for them: every seventh
 * belongs to the devil. A Collab Pokemon: see collab.js for the tier.
 *
 *   Freischutz   Dark/Steel   80 / 125 / 80 / 85 / 75 / 115   560
 *
 *   Magic Bullet          Dark, physical, 80, never misses. Goes through Protect and
 *                         substitutes, and is never redirected (Follow Me, Storm Drain).
 *   The Devil's Seventh   Freischutz counts the Magic Bullets it fires, switches and
 *                         all. Every seventh hits a random active Pokemon instead of
 *                         the one aimed at: any of them, its own side and itself
 *                         included - in singles, the foe or itself.
 */

const ID = 'freischutz';
const ABILITY = "The Devil's Seventh";
const DEVILS_SHARE = 7;

const DEX_ENTRY = "He made a pact for bullets that never miss, and he never does. The price is written into every seventh round: that one belongs to the one he bargained with, and goes wherever it pleases. He keeps count. He has never once managed to stop.";

exports.pokedex = (data) => {
	data[ID] = {
		num: 2007,
		gen: 9,
		name: 'Freischutz',
		types: ['Dark', 'Steel'],
		gender: 'M',
		baseStats: { hp: 80, atk: 125, def: 80, spa: 85, spd: 75, spe: 115 },
		abilities: { 0: ABILITY },
		heightm: 1.8,
		weightkg: 72,
		color: 'Black',
		eggGroups: ['Undiscovered'],
		tags: [],
	};
	return data;
};

exports.abilities = (data) => {
	data.thedevilsseventh = {
		name: ABILITY,
		num: -251,
		gen: 9,
		rating: 0,
		// Before the move picks its target, once per use. The count is on the Pokemon, so a switch keeps it.
		onModifyTarget(relayVar, pokemon, target, move) {
			if (move.id !== 'magicbullet') return;
			pokemon.m.magicBullets = (pokemon.m.magicBullets || 0) + 1;
			if (pokemon.m.magicBullets % DEVILS_SHARE) return;
			relayVar.target = this.sample(this.getAllActive());
			this.add('-activate', pokemon, `ability: ${ABILITY}`);
		},
		flags: { failroleplay: 1, noreceiver: 1, noentrain: 1, notrace: 1, failskillswap: 1, cantsuppress: 1 },
		shortDesc: "Every 7th Magic Bullet this Pokemon fires hits a random active Pokemon, itself included.",
		desc: "This Pokemon counts the Magic Bullets it fires; the count is kept when it switches out. Every 7th one hits a random active Pokemon instead of its target: any Pokemon on the field, this Pokemon and its allies included. This Ability can't be suppressed, copied, swapped or replaced.",
	};
	return data;
};

exports.moves = (data) => {
	data.magicbullet = {
		num: -303,
		gen: 9,
		accuracy: true,
		basePower: 80,
		category: 'Physical',
		name: 'Magic Bullet',
		pp: 10,
		priority: 0,
		flags: { mirror: 1, metronome: 1, bypasssub: 1 },
		tracksTarget: true,
		secondary: null,
		target: 'normal',
		type: 'Dark',
		shortDesc: 'Never misses. Ignores Protect, substitutes and redirection. Freischutz.',
		desc: "This move does not check accuracy, bypasses the target's substitute, is not blocked by Protect, Detect, King's Shield or any other protection, and cannot be redirected by Follow Me, Rage Powder, Lightning Rod, Storm Drain or anything else. Freischutz's signature move.",
	};
	return data;
};

exports.ID = ID;
exports.FORMES = [];
exports.NAMES = ['Freischutz'];
exports.ABILITY_IDS = ['thedevilsseventh'];
exports.SIGNATURE = ['magicbullet'];
exports.MOVES = [
	'knockoff', 'suckerpunch', 'pursuit', 'nightslash', 'throatchop', 'ironhead', 'bulletpunch', 'smartstrike', 'gunkshot',
	'snipeshot', 'darkpulse', 'flashcannon', 'honeclaws', 'lockon', 'laserfocus', 'focusenergy', 'taunt', 'protect',
];
exports.DEX_ENTRY = DEX_ENTRY;
exports.SEARCH_ALIASES = [['derfreischutz', ID, 0], ['derfreischuetz', ID, 0]];
