'use strict';
/**
 * Touhou: the Touhou Project characters as Pokemon, and the tier that holds them.
 *
 * From the Touhoumons solomod (DH2, MIT): github.com/scoopapa/DH2, data/mods/toho,
 * "Touhoumons v5". The species, learnsets and search aliases are plain data and are
 * imported into touhou-data.json by scripts/import-touhou.js; the moves, abilities and
 * items are code and are ported below by hand, effect for effect.
 *
 * Like the collab Pokemon (collab.js) they are guests, not a power level: a tier of
 * their own at the top of the ladder (Touhou > Collab > AG > Uber > ...), legal in
 * [Gen 9] RP Touhou (RP AG's rules plus these) and in the RP Battle formats, and
 * refused by name everywhere else - the normal RP tiers, RP Draft and RP Collab
 * (config/custom-formats.js, GUEST_TIERS). Nobody can obtain one yet: no wild spawns
 * (src/encounters.js), no rewards, and the bot drafts them only in RP Touhou.
 *
 * Changed on the way in, and why:
 *   - Numbers. The mod numbers them 1..134, which are Bulbasaur to Kabutops here; ours
 *     run from 2101 in the mod's order, and a forme shares its base's number.
 *   - Names. "Hecatia-Otherworld" was a base species with a hyphen in it and "Ichirin
 *     and Unzan" a forme whose name is not Base-Forme, which Showdown's client and
 *     validator both read wrongly. They are Hecatia (base forme Otherworld) and Ichirin
 *     Kumoi-Unzan here; the old names are search aliases.
 *   - Cirno-Tanned: the mod swapped Cirno holding a Summer Backdoor at battle start in
 *     its own engine. Here the item names Cirno-Tanned as its forced forme, as the
 *     Griseous Core does Giratina-Origin, so the validator makes the swap.
 *   - Size and weight: the mod has none (Low Kick and Heavy Slam need one), so 1.5 m,
 *     50 kg for everyone.
 *   - Bugs fixed rather than ported: Shikigami Rush read `allies` as a list (it is a
 *     method, so the move threw); Demon Parade checked one foe picked at random on every
 *     Speed read, so it checks all adjacent foes; Bloodsucker healed without telling the
 *     client; Recollection put a move object where the request wants a name; the Summer
 *     Backdoor crashed with no taker and now stays put as the Griseous Core does; Echo and
 *     Sword of Hisou are written as abilities instead of engine patches (see each).
 *   - Wicked Energy had Charge's number (268); every move, ability and item here has a
 *     number of ours (-201 and down), clear of the rest of data/velvet.
 *   - Type-wide buffs (buffs.js) skip them: they keep the movepools their mod gave them.
 *
 * Not ported (the mod's scripts.ts replaces whole engine functions to do these):
 *   - Grow Bigger's own Dynamax. In the mod it is the only way to Dynamax, for one turn.
 *     Every RP format already lets anyone Dynamax, so here the ability does nothing.
 *   - Okina Matara keeping her first type against type-changing moves (a setType check
 *     on her number).
 *   - Lunatic Torch's sun for Solar Beam, Synthesis and the like: only the damage half
 *     is here (the mod's own damage handler never returned its value, so did nothing).
 *   - The Dynamax condition ending after one turn (it belongs to Grow Bigger).
 */

const DATA = require('./touhou-data.json');

const TIER = 'Touhou';
const clone = v => JSON.parse(JSON.stringify(v));

// Battle-only formes and the ones a Pokemon changes into in battle are formes; the
// rest - one per character - are the species.
const FORMES = Object.keys(DATA.species).filter(id => DATA.species[id].baseSpecies);
const SPECIES = Object.keys(DATA.species).filter(id => !DATA.species[id].baseSpecies);
const NAMES = Object.values(DATA.species).map(s => s.name);

/*
 * The legendary ones (owner, 21 Oct 2026: "all Boneka are 1% encounters (legendary ones
 * are excluded)"). Gods of real standing, the rulers of whole realms and Gensokyo's
 * sages: the ones the story hands out, never the grass. Tagged Sub-Legendary, so every
 * rule that keeps legendaries out of the wild and out of a ball (src/encounters.js
 * isLegendary) keeps these out too, and the rarity ladder rates them legendary. A forme
 * is legendary when its base is. src/rarity.js TOUHOU_LEGENDS is the same list, for
 * the RP bot, which cannot load this dex; test/gensokyo-encounters.test.js keeps them equal.
 */
const LEGENDS = [
	'yukariyakumo',        // the youkai sage who drew the Great Barrier
	'okinamatara',         // the hidden god of the back door, a founding sage
	'kanakoyasaka',        // goddess of wind and war, the Moriya Shrine's god
	'suwakomoriya',        // the native god of the Moriya, mistress of the Mishaguji
	'eikishiki',           // the Yama: judge of the dead
	'hecatia',             // goddess of hell, with a body on each world
	'junko',               // a divine spirit of vengeance, LoLK's mastermind
	'sagumekishin',        // a Lunarian goddess of the Lunar Capital's command
	'watatsukinotoyohime', // ruler of the Lunar Capital's defence
	'watatsukinoyorihime', // her sister, who channels any god at will
	'keikihaniyasushin',   // goddess of creation, maker of the haniwa
	'chimatatenkyuu',      // goddess of the market and of ownerlessness
	'zanmunippaku',        // the oni who rules over Hell's underworld politics
	'ariyaiwanaga',        // Iwanaga-hime, goddess of stone and long life
];

exports.pokedex = (data) => {
	for (const [id, s] of Object.entries(DATA.species)) {
		data[id] = clone(s);
		const base = String(s.baseSpecies || s.name).toLowerCase().replace(/[^a-z0-9]/g, '');
		if (LEGENDS.includes(base) && !(data[id].tags || []).includes('Sub-Legendary')) data[id].tags = [...(data[id].tags || []), 'Sub-Legendary'];
		// The Summer Backdoor's forme (see the items below): the validator's message for
		// a Cirno-Tanned without one names the Pokemon it changes from.
		if (id === 'cirnotanned') data[id].changesFrom = 'Cirno';
	}
	return data;
};

exports.formatsData = (data) => {
	for (const id of Object.keys(DATA.species)) {
		data[id] = { isNonstandard: null, tier: TIER, doublesTier: TIER, natDexTier: TIER };
	}
	return data;
};

exports.learnsets = (data) => {
	for (const [id, learnset] of Object.entries(DATA.learnsets)) data[id] = { learnset: clone(learnset) };
	// Fate's Call (ours, not the mod's): Remilia's alone, from level 1.
	if (data.remiliascarlet) data.remiliascarlet.learnset.fatescall = ['9L1'];
	// Forbidden Barrage: Flandre's alone now. The mod also taught it to Byakuren Hijiri
	// and Zanmu Nippaku; they no longer learn it.
	for (const id of Object.keys(DATA.learnsets)) if (id !== 'flandrescarlet' && data[id]) delete data[id].learnset.forbiddenbarrage;
	if (data.flandrescarlet) data.flandrescarlet.learnset.forbiddenbarrage = ['9L1'];
	return data;
};

// ------------------------------------------------------------------ moves

const anim = (...names) => function (target, pokemon) {
	this.attrLastMove('[still]');
	for (const name of names) this.add('-anim', pokemon, name, target);
};
/** The condition behind Watatsuki no Yorihime's three Invoke moves: a god's type for her and her blade. */
function invoke(type, others, extra) {
	return {
		onStart(pokemon) {
			pokemon.setType(type);
			if (extra) extra.call(this, pokemon);
			this.add('-start', pokemon, 'typechange', type);
			for (const other of others) pokemon.removeVolatile(other);
		},
		onRestart(pokemon) {
			pokemon.setType(type);
			if (extra) extra.call(this, pokemon);
			this.add('-start', pokemon, 'typechange', type);
			for (const other of others) pokemon.removeVolatile(other);
		},
		onModifyType(move) {
			if (move.flags['slicing']) move.type = type;
		},
	};
}
const INVOKES = ['invokeamaterasu', 'invokehonoikazuchi', 'invokeishikoridome'];
const HAZARDS = ['spikes', 'toxicspikes', 'stealthrock', 'stickyweb', 'gmaxsteelsurge'];

const MOVES = {
	dreamseal: {
		num: -201, accuracy: true, basePower: 70, category: 'Special', name: 'Dream Seal', pp: 10, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Hidden Power', 'Bleakwind Storm'),
		volatileStatus: 'partiallytrapped',
		secondary: null, target: 'normal', type: 'Flying',
		shortDesc: 'Never misses. Traps and damages the target for 4-5 turns.',
		desc: "Does not check accuracy. Prevents the target from switching for four or five turns (seven turns if the user is holding Grip Claw), and deals 1/8 of its maximum HP (1/6 with Binding Band) at the end of each of those turns. The effect ends early if the user leaves the field, or the target uses Rapid Spin or Mortal Spin successfully. Reimu Hakurei's signature move.",
	},
	silverdagger: {
		num: -202, accuracy: 100, basePower: 65, category: 'Physical', name: 'Silver Dagger', pp: 15, priority: 0,
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1, slicing: 1 },
		basePowerCallback(pokemon, target, move) {
			if (target.newlySwitched || this.queue.willMove(target)) return move.basePower * 1.5;
			return move.basePower;
		},
		onPrepareHit: anim('Smart Strike'),
		secondary: null, target: 'normal', type: 'Steel',
		shortDesc: '1.5x power if the user moves before the target.',
		desc: "Power is multiplied by 1.5 (97.5) if the user moves before the target this turn, or the target switched in this turn. Slicing move.",
	},
	// Flandre Scarlet's signature (the owner, 21 Oct 2026): raised to match her sister's
	// Fate's Call - 120 power, never misses, 8 PP - and hers alone (learnsets above).
	forbiddenbarrage: {
		num: -203, accuracy: true, basePower: 120, category: 'Special', name: 'Forbidden Barrage', pp: 8, priority: 0,
		flags: { protect: 1, mirror: 1, bullet: 1 },
		onPrepareHit: anim('Astral Barrage'),
		secondary: { chance: 10, volatileStatus: 'flinch' },
		target: 'allAdjacentFoes', type: 'Dark',
		shortDesc: "Can't miss. 10% to flinch. Hits adjacent foes. Flandre's signature.",
		desc: "Can't miss: does not check accuracy, so evasion and accuracy changes do not matter. Has a 10% chance to make each target flinch. Hits all adjacent foes. Ball and bomb move: Bulletproof blocks it. Flandre Scarlet's signature move.",
	},
	shikigamirush: {
		num: -204, accuracy: 100, basePower: 70, category: 'Special', name: 'Shikigami Rush', pp: 5, priority: 0,
		flags: { protect: 1, mirror: 1, contact: 1 },
		onPrepareHit: anim('Zen Headbutt'),
		onModifyPriority(priority, source) {
			if (source.allies().some(p => p.baseSpecies.id === 'ranyakumo')) return priority + 1;
		},
		secondary: null, target: 'normal', type: 'Psychic',
		shortDesc: '+1 priority if Ran Yakumo is an ally on the field.',
		desc: "Usually goes first (+1 priority) if Ran Yakumo is the user's ally on the field (doubles). Makes contact. Yukari Yakumo's.",
	},
	lunaticbullet: {
		num: -205, accuracy: 100, basePower: 40, category: 'Special', name: 'Lunatic Bullet', pp: 20, priority: 0.1,
		flags: { protect: 1, mirror: 1, bullet: 1 },
		onPrepareHit: anim('Vacuum Wave', 'Psychic'),
		secondary: null, target: 'normal', type: 'Psychic',
		shortDesc: 'Moves first in its priority bracket.',
		desc: "Goes before every other move of priority 0, as if it had a sliver more priority; still goes after any +1 move. Ball and bomb move.",
	},
	nervepoison: {
		num: -206, accuracy: 100, basePower: 80, category: 'Special', name: 'Nerve Poison', pp: 15, priority: 0,
		flags: { protect: 1, mirror: 1 },
		onPrepareHit: anim('Clear Smog'),
		secondary: { chance: 30, status: 'par' },
		target: 'allAdjacentFoes', type: 'Poison',
		shortDesc: '30% chance to paralyze the foe(s).',
		desc: "Has a 30% chance to paralyze each target. Hits all adjacent foes.",
	},
	superscope3d: {
		num: -207, accuracy: 90, basePower: 20, category: 'Physical', name: 'Super Scope 3d', pp: 10, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1, bullet: 1 },
		basePowerCallback(pokemon, target, move) {
			return 20 * move.hit;
		},
		onPrepareHit(target, pokemon) {
			this.attrLastMove('[still]');
			this.add('-anim', pokemon, 'Fling', target);
			this.add('-anim', target, 'Water Sport', pokemon);
		},
		multihit: 3, multiaccuracy: true,
		secondary: null, target: 'normal', type: 'Water',
		shortDesc: 'Hits 3 times. Each hit can miss, but power rises.',
		desc: "Hits three times. Power is 20 for the first hit, 40 for the second and 60 for the third. The accuracy check is made for each hit, and the move stops at the first miss. Ball and bomb move.",
	},
	cloudfist: {
		num: -208, accuracy: 90, basePower: 100, category: 'Physical', name: 'Cloud Fist', pp: 10, priority: 0,
		flags: { contact: 1, protect: 1, mirror: 1, punch: 1, metronome: 1, wind: 1 },
		onPrepareHit(target, pokemon) {
			this.attrLastMove('[still]');
			this.add('-anim', pokemon, 'Hammer Arm', target);
			this.add('-anim', target, 'Haze', pokemon);
		},
		self: { boosts: { spe: -1 } },
		secondary: null, target: 'normal', type: 'Flying',
		shortDesc: 'Lowers the user\'s Speed by 1.',
		desc: "Lowers the user's Speed by 1 stage. Punch and wind move.",
	},
	waterplates: {
		num: -209, accuracy: 90, basePower: 50, category: 'Physical', name: 'Water Plates', pp: 15, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Snipe Shot'),
		critRatio: 2, multihit: 2,
		secondary: null, target: 'normal', type: 'Water',
		shortDesc: 'Hits 2 times. High critical hit ratio.',
		desc: "Hits twice. Has a higher chance for a critical hit. If the first hit breaks the target's substitute, it will take damage for the second hit.",
	},
	bodyswap: {
		num: -210, accuracy: true, basePower: 0, category: 'Status', name: 'Body Swap', pp: 10, priority: 0,
		flags: { heal: 1, metronome: 1 },
		heal: [1, 2],
		onHit(pokemon) {
			if (pokemon.baseSpecies.baseSpecies !== 'Hecatia') return;
			const next = { 'Hecatia': ['Hecatia-Earth', 'Natural Cure'], 'Hecatia-Earth': ['Hecatia-Moon', 'Dazzling'], 'Hecatia-Moon': ['Hecatia', 'Pressure'] };
			const [forme, ability] = next[pokemon.species.name] || next['Hecatia-Moon'];
			pokemon.formeChange(forme, this.effect, true);
			this.add('-ability', pokemon, ability, '[from] move: Body Swap');
			pokemon.set.ability = ability;
		},
		secondary: null, target: 'self', type: 'Normal',
		shortDesc: 'Heals 50%. Hecatia: Otherworld -> Earth -> Moon -> Otherworld.',
		desc: "The user restores 1/2 of its maximum HP, rounded half up. If the user is Hecatia, it also changes body for the rest of the battle: Otherworld becomes Earth (Natural Cure), Earth becomes Moon (Dazzling), and Moon becomes Otherworld (Pressure).",
	},
	dancingblow: {
		num: -211, accuracy: 95, basePower: 80, category: 'Physical', name: 'Dancing Blow', pp: 10, priority: 0,
		flags: { protect: 1, mirror: 1, contact: 1, dance: 1, metronome: 1 },
		onPrepareHit: anim('Quiver Dance', 'Mach Punch'),
		secondary: { chance: 20, boosts: { spa: -1 } },
		target: 'normal', type: 'Fighting',
		shortDesc: '20% chance to lower the target\'s Sp. Atk by 1.',
		desc: "Has a 20% chance to lower the target's Special Attack by 1 stage. Dance move: Dancer copies it.",
	},
	stonestacking: {
		num: -212, accuracy: 100, basePower: 140, category: 'Special', name: 'Stone Stacking', pp: 5, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit(target, pokemon) {
			this.attrLastMove('[still]');
			this.add('-anim', target, 'Stone Edge', pokemon);
			this.add('-anim', pokemon, 'Never-Ending Nightmare', target);
		},
		onAfterHit(target, source, move) {
			if (!move.hasSheerForce && source.hp) source.side.addSideCondition('stealthrock');
		},
		onAfterSubDamage(damage, target, source, move) {
			if (!move.hasSheerForce && source.hp) source.side.addSideCondition('stealthrock');
		},
		secondary: null, target: 'allAdjacentFoes', type: 'Ghost',
		shortDesc: 'Sets Stealth Rock on the user\'s own side.',
		desc: "Hits all adjacent foes. After it hits, Stealth Rock is set on the user's own side of the field, not the target's. Not if the user has Sheer Force or has fainted.",
	},
	sculptedarmor: {
		num: -213, accuracy: true, basePower: 0, category: 'Status', name: 'Sculpted Armor', pp: 20, priority: 0,
		flags: { metronome: 1 },
		onPrepareHit: anim('Sand Tomb'),
		onHit(target) {
			this.boost({ def: 1, spd: 1 }, target);
			if (target.hasType('Ground')) return;
			if (!target.addType('Ground')) return;
			this.add('-start', target, 'typeadd', 'Ground', '[from] move: Sculpted Armor');
		},
		secondary: null, target: 'adjacentAllyOrSelf', type: 'Ground',
		shortDesc: 'User or ally: +1 Def and Sp. Def, and adds Ground type.',
		desc: "Raises the Defense and Special Defense of the user or an adjacent ally by 1 stage each, and adds Ground to its types if it is not already Ground type.",
	},
	excavate: {
		num: -214, accuracy: 90, basePower: 65, category: 'Physical', name: 'Excavate', pp: 15, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		basePowerCallback(pokemon, target, move) {
			for (const condition of HAZARDS) if (pokemon.side.sideConditions[condition]) return move.basePower * 2;
			return move.basePower;
		},
		onPrepareHit: anim('Rock Throw'),
		onAfterHit(target, pokemon, move) {
			if (move.hasSheerForce) return;
			for (const condition of HAZARDS) {
				if (pokemon.hp && pokemon.side.removeSideCondition(condition)) {
					this.add('-sideend', pokemon.side, this.dex.conditions.get(condition).name, '[from] move: Excavate', `[of] ${pokemon}`);
				}
			}
		},
		secondary: null, target: 'normal', type: 'Ground',
		shortDesc: 'Clears hazards on the user\'s side. 2x power if any.',
		desc: "Power doubles if there are entry hazards (Spikes, Toxic Spikes, Stealth Rock, Sticky Web or G-Max Steelsurge) on the user's side of the field. After it hits, removes them from the user's side.",
	},
	ironchomp: {
		num: -215, accuracy: 100, basePower: 80, category: 'Physical', name: 'Iron Chomp', pp: 5, priority: 0,
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1, bite: 1 },
		onPrepareHit: anim('Iron Defense', 'Jaw Lock'),
		secondary: {
			chance: 100,
			onHit(target, source, move) {
				if (source.isActive) target.addVolatile('trapped', source, move, 'trapper');
			},
		},
		target: 'normal', type: 'Steel',
		shortDesc: 'The target can\'t switch out while the user is in.',
		desc: "Prevents the target from switching out for as long as the user is active. Biting move.",
	},
	missile: {
		num: -216, accuracy: true, basePower: 90, category: 'Physical', name: 'Missile', pp: 10, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1, bullet: 1 },
		onPrepareHit: anim('Torch Song'),
		secondary: { chance: 20, status: 'brn' },
		target: 'normal', type: 'Steel',
		shortDesc: 'Never misses. 20% chance to burn.',
		desc: "Does not check accuracy. Has a 20% chance to burn the target. Ball and bomb move.",
	},
	wickedenergy: {
		num: -217, accuracy: true, basePower: 0, category: 'Status', name: 'Wicked Energy', pp: 20, priority: 0,
		flags: { snatch: 1, metronome: 1 },
		volatileStatus: 'wickedenergy',
		condition: {
			onStart(pokemon, source, effect) {
				if (effect && effect.name === 'Wicked Power') {
					this.add('-start', pokemon, 'Wicked Energy', this.activeMove ? this.activeMove.name : '', '[from] ability: Wicked Power');
				} else {
					this.add('-start', pokemon, 'Wicked Energy');
				}
			},
			onRestart(pokemon, source, effect) {
				if (effect && effect.name === 'Wicked Power') {
					this.add('-start', pokemon, 'Wicked Energy', this.activeMove ? this.activeMove.name : '', '[from] ability: Wicked Power');
				} else {
					this.add('-start', pokemon, 'Wicked Energy');
				}
			},
			onBasePowerPriority: 9,
			onBasePower(basePower, attacker, defender, move) {
				if (move.type === 'Dark') return this.chainModify(2);
			},
			onMoveAborted(pokemon, target, move) {
				if (move.type === 'Dark' && move.id !== 'wickedenergy') pokemon.removeVolatile('wickedenergy');
			},
			onAfterMove(pokemon, target, move) {
				if (move.type === 'Dark' && move.id !== 'wickedenergy') pokemon.removeVolatile('wickedenergy');
			},
			onEnd(pokemon) {
				this.add('-end', pokemon, 'Wicked Energy', '[silent]');
			},
		},
		boosts: { spd: 1 },
		secondary: null, target: 'self', type: 'Dark',
		shortDesc: '+1 Sp. Def; the user\'s next Dark move has 2x power.',
		desc: "Raises the user's Special Defense by 1 stage. The user's next Dark-type attack has its power doubled; the effect ends once a Dark-type move is used or fails. Charge, for Dark.",
	},
	dustupheaval: {
		num: -218, accuracy: 100, basePower: 70, category: 'Physical', name: 'Dust Upheaval', pp: 10, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit(target, pokemon) {
			this.actions.useMove('Sandstorm', pokemon);
		},
		secondary: { chance: 20, volatileStatus: 'flinch' },
		target: 'normal', type: 'Ground',
		shortDesc: 'Summons Sandstorm first. 20% chance to flinch.',
		desc: "The user summons a Sandstorm before attacking, as if it had used the move Sandstorm. Has a 20% chance to make the target flinch.",
	},
	invokeamaterasu: {
		num: -219, accuracy: 100, basePower: 0, category: 'Status', name: 'Invoke Amaterasu', pp: 10, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		onHit(target, pokemon) {
			this.attrLastMove('[still]');
			this.add('-anim', pokemon, 'Take Heart', target);
			pokemon.addVolatile('invokeamaterasu');
		},
		condition: invoke('Fire', ['invokehonoikazuchi', 'invokeishikoridome']),
		boosts: { atk: 1 },
		secondary: null, target: 'self', type: 'Fire',
		shortDesc: '+1 Atk. User becomes Fire type; its slicing moves become Fire.',
		desc: "Raises the user's Attack by 1 stage. The user becomes pure Fire type, and its slicing moves become Fire type, until it switches out or uses another Invoke move.",
	},
	invokehonoikazuchi: {
		num: -220, accuracy: 100, basePower: 0, category: 'Status', name: 'Invoke Honoikazuchi', pp: 10, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		onHit(target, pokemon) {
			this.attrLastMove('[still]');
			this.add('-anim', pokemon, 'Take Heart', target);
			pokemon.addVolatile('invokehonoikazuchi');
		},
		condition: invoke('Electric', ['invokeamaterasu', 'invokeishikoridome']),
		boosts: { spe: 1 },
		secondary: null, target: 'self', type: 'Electric',
		shortDesc: '+1 Spe. User becomes Electric type; its slicing moves become Electric.',
		desc: "Raises the user's Speed by 1 stage. The user becomes pure Electric type, and its slicing moves become Electric type, until it switches out or uses another Invoke move.",
	},
	/*
	 * Fate's Call: Remilia Scarlet's own, not the mod's (the owner, 21 Oct 2026). She
	 * manipulates fate, so it cannot miss and no protection stops it: no `protect` flag,
	 * so Protect, Detect, King's Shield and the rest are passed by, not broken - they are
	 * still up for the next move. Never a machine (not in TMS).
	 */
	fatescall: {
		num: -222, accuracy: true, basePower: 120, category: 'Special', name: "Fate's Call", pp: 8, priority: 0,
		flags: { mirror: 1, metronome: 1 },
		onPrepareHit: anim('Dark Pulse'),
		secondary: null, target: 'normal', type: 'Dark',
		shortDesc: "Can't miss. Hits through protection. Remilia's signature.",
		desc: "Does not check accuracy, so evasion and accuracy changes do not matter. Hits a target using Protect, Detect, King's Shield, Spiky Shield, Baneful Bunker, Silk Trap, Burning Bulwark, Obstruct or Max Guard without ending the protection or suffering its effects. Remilia Scarlet's signature move.",
	},
	invokeishikoridome: {
		num: -221, accuracy: 100, basePower: 0, category: 'Status', name: 'Invoke Ishikori-Dome', pp: 10, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		onHit(target, pokemon) {
			this.attrLastMove('[still]');
			this.add('-anim', pokemon, 'Take Heart', target);
			pokemon.addVolatile('invokeishikoridome');
		},
		condition: invoke('Ice', ['invokeamaterasu', 'invokehonoikazuchi'], function (pokemon) {
			pokemon.setAbility('magicbounce', pokemon);
		}),
		secondary: null, target: 'self', type: 'Ice',
		shortDesc: 'User\'s ability becomes Magic Bounce; it becomes Ice type; slicing moves become Ice.',
		desc: "The user's Ability becomes Magic Bounce. The user becomes pure Ice type, and its slicing moves become Ice type, until it switches out or uses another Invoke move.",
	},
};

// ------------------------------------------------------------------ TMs

/*
 * The mod's moves as machines (the owner, 21 Oct 2026: "distribute the new tms
 * generously"). Handed out by buffs.js the way Wave Charge is: each rule is a test
 * on a Pokemon's types, stats, abilities and the moves it already learns, run over
 * the whole dex (Touhou guests included), and a Pokemon that passes learns the move
 * as '9M'. Pre-evolutions of a Pokemon that passes learn it too. A rule's `except`
 * takes out a whole evolution family, since an evolution inherits its baby's moves.
 *
 * Left out of every rule unless named in `also`: the Restricted Legendaries, the
 * Mythicals, and anything with 670 base stats or more (the box-art and Uber legends).
 *
 * `physical` is Attack at least Special Attack, `special` the reverse.
 */
const SLICING = ['slash', 'nightslash', 'xscissor', 'leafblade', 'sacredsword', 'psychocut', 'razorshell', 'crosspoison',
	'kowtowcleave', 'stoneaxe', 'ceaselessedge', 'bitterblade', 'aquacutter', 'solarblade', 'secretsword',
	'populationbomb', 'tachyoncutter', 'psyblade', 'mightycleave'];
const PUNCHES = ['machpunch', 'drainpunch', 'firepunch', 'icepunch', 'thunderpunch', 'dynamicpunch', 'focuspunch',
	'hammerarm', 'skyuppercut', 'cometpunch', 'megapunch', 'bulletpunch', 'shadowpunch', 'poweruppunch', 'meteormash',
	'wickedblow', 'surgingstrikes', 'ragefist', 'jetpunch', 'icehammer'];
const DANCES = ['quiverdance', 'featherdance', 'teeterdance', 'petaldance', 'fierydance', 'revelationdance',
	'lunardance', 'victorydance', 'aquastep'];
const BITES = ['bite', 'crunch', 'firefang', 'icefang', 'thunderfang', 'poisonfang', 'psychicfangs', 'hyperfang',
	'jawlock', 'fishiousrend'];
// A flat half of the user's HP, which is all Body Swap does for anyone but Hecatia.
const HALF_HEALS = ['recover', 'slackoff', 'softboiled', 'roost', 'milkdrink', 'shoreup', 'healorder'];
// Sword-bearers, for the two Invokes that are not Yorihime's alone.
const SWORDS = ['gallade', 'ceruledge', 'samurott', 'samurotthisui', 'kleavor', 'sirfetchd', 'farfetchd',
	'scyther', 'kabutops', 'bisharp', 'decidueyehisui', 'veluza', 'aegislash'];

const TMS = {
	// Reimu Hakurei's own (the move says so): kept narrow, to the mystic special
	// birds. A never-missing trap is a lot to hand out further than that.
	dreamseal: {
		when: () => false,
		also: ['xatu', 'sigilyph', 'noctowl', 'swoobat', 'oricoriopau', 'oricoriosensu', 'togekiss', 'articunogalar'],
	},
	// The physical Steel and Dark types with a blade or claw (any slicing move), and
	// every Sharpness user. Not Chien-Pao or Kartana: a 97.5 power hit for outspeeding
	// is a free upgrade on the fastest blades in the game.
	silverdagger: {
		when: (s, k) => s.physical && (s.has('Steel') || s.has('Dark')) && k(SLICING) || s.physical && s.ability('Sharpness'),
		except: ['chienpao', 'kartana'],
	},
	// Flandre Scarlet's signature (the owner): never a machine.
	forbiddenbarrage: null,
	// The special Psychic types. Off Yukari it is a plain 70 power Psychic move (the
	// priority only comes with Ran Yakumo beside her), so it costs nothing to share.
	shikigamirush: {
		when: s => s.special && s.has('Psychic'),
	},
	// The special Psychic and Ghost types: a 40 power shot that goes first among
	// equals, Vacuum Wave for the mind.
	lunaticbullet: {
		when: s => s.special && (s.has('Psychic') || s.has('Ghost')),
	},
	// The special Poison types. Not Gengar or Glimmora (as with Oxidize, a 30%
	// paralysis STAB on top of what they threaten), Iron Moth, or the Poison Ultra
	// Beasts (Nihilego, Naganadel).
	nervepoison: {
		when: s => s.special && s.has('Poison'),
		except: ['gengar', 'glimmora', 'ironmoth', 'nihilego', 'naganadel'],
	},
	// The physical Water types: Nitori's water cannon, three rising shots.
	superscope3d: {
		when: s => s.physical && s.has('Water'),
	},
	// The physical Flying types, the physical Fighting types that throw punches, and
	// every Iron Fist user. Not Annihilape or Urshifu (Ubers), nor Landorus.
	cloudfist: {
		when: (s, k) => s.physical && (s.has('Flying') || s.has('Fighting') && k(PUNCHES) || s.ability('Iron Fist')),
		except: ['annihilape', 'urshifu', 'landorus'],
	},
	// The physical Water types. Not the Sniper ones: two high-crit hits on Sniper and a
	// Scope Lens is a guaranteed double crit at 2.25x.
	waterplates: {
		when: s => s.physical && s.has('Water') && !s.ability('Sniper'),
	},
	// Psychic and Ghost types (a soul changing bodies) that already heal half their HP:
	// to them it is Recover under another name. The forme change is Hecatia's alone.
	bodyswap: {
		when: (s, k) => (s.has('Psychic') || s.has('Ghost')) && k(HALF_HEALS),
	},
	// The physical Fighting types and the physical dancers (any dance move but Swords
	// and Dragon Dance, which nearly everything knows), and every Dancer.
	// Not Annihilape or Urshifu (Ubers).
	dancingblow: {
		when: (s, k) => s.physical && (s.has('Fighting') || k(DANCES)) || s.ability('Dancer'),
		except: ['annihilape', 'urshifu'],
	},
	// Eika Ebisu's, at the Sanzu river: kept narrow. 140 power Ghost on a fast special
	// Ghost (Dragapult, Chandelure, Gholdengo, Flutter Mane) is far too much; it goes to
	// the slow stone-and-tomb Ghosts, for whom Stealth Rock on their own side really costs.
	stonestacking: {
		when: () => false,
		also: ['spiritomb', 'runerigus', 'cofagrigus', 'palossand', 'dusknoir', 'golurk'],
	},
	// Ground and Rock types, and the clay and stone statues. Not Garganacl, Gliscor,
	// Ting-Lu or Landorus: Cosmic Power plus an Electric immunity on a top-tier wall
	// (Gliscor with Poison Heal above all) is a tier review.
	sculptedarmor: {
		when: s => s.has('Ground') || s.has('Rock'),
		also: ['golurk', 'bronzong', 'regirock', 'registeel', 'regice'],
		except: ['garganacl', 'gliscor', 'tinglu', 'landorus'],
	},
	// The physical Ground types, and the physical Rock and Steel types that dig. Not
	// Garchomp, Landorus, Ting-Lu or Garganacl: hazard control and a 130 power Ground
	// move tips any of them.
	excavate: {
		when: (s, k) => s.physical && (s.has('Ground') || (s.has('Rock') || s.has('Steel')) && k(['dig'])),
		except: ['garchomp', 'landorus', 'tinglu', 'garganacl'],
	},
	// The physical biters that are Steel or have Strong Jaw. Not Dracovish (Strong Jaw
	// and Fishious Rend is an Uber already).
	ironchomp: {
		when: (s, k) => s.physical && k(BITES) && (s.has('Steel') || s.ability('Strong Jaw')),
		also: ['mawile'],
		except: ['dracovish'],
	},
	// The physical Steel and Electric types, and the machines and cannons. Not
	// Kingambit (a never-missing STAB that burns is more than Iron Head on it), Kartana,
	// or Regieleki (an Uber).
	missile: {
		when: s => s.physical && (s.has('Steel') || s.has('Electric')),
		also: ['blastoise', 'golurk', 'revavroom', 'ironhands', 'irontreads', 'ironboulder', 'ironleaves', 'ironvaliant',
			'porygonz', 'magnezone', 'klinklang', 'clawitzer'],
		except: ['kingambit', 'kartana', 'regieleki'],
	},
	// Every Dark type: Charge, for Dark. Not where a doubled Dark move is already a
	// threat: Kingambit (Sucker Punch and Kowtow Cleave), Chien-Pao, Roaring Moon,
	// Meowscarada (Knock Off), Chi-Yu, Urshifu (an always-critting Wicked Blow at 150),
	// Greninja (Battle Bond) and Ting-Lu (+1 Sp. Def a turn on that wall).
	wickedenergy: {
		when: s => s.has('Dark'),
		except: ['kingambit', 'chienpao', 'roaringmoon', 'meowscarada', 'chiyu', 'urshifu', 'greninja', 'tinglu'],
	},
	// The physical Ground and Rock types. Not the Sand Rush or Sand Veil ones (it would
	// set their own sand and double their Speed, or their evasion, in one move), nor
	// Landorus.
	dustupheaval: {
		when: s => s.physical && (s.has('Ground') || s.has('Rock')) && !s.ability('Sand Rush') && !s.ability('Sand Veil'),
		except: ['landorus', 'garchomp', 'gliscor'],
	},
	// Yorihime's: a god's type for the user and its blade. Kept to the sword-bearers.
	invokeamaterasu: { when: () => false, also: SWORDS },
	invokehonoikazuchi: { when: () => false, also: SWORDS },
	// Yorihime's alone: it hands out Magic Bounce, which no TM should.
	invokeishikoridome: null,
};
// Mew learns every machine move, as with the shared moves in balance-patch-1.js.
for (const rule of Object.values(TMS)) if (rule) rule.also = [...(rule.also || []), 'mew'];

/** Hazards that Dexterity walks over: the switch-in handlers of these two, behind a check. */
function dexterous(entry) {
	const condition = { ...entry.condition };
	const own = condition.onSwitchIn;
	condition.onSwitchIn = function (pokemon) {
		if (pokemon.hasAbility('dexterity')) return;
		return own.apply(this, arguments);
	};
	return { ...entry, condition };
}

exports.moves = (data) => {
	// `velvetShared`: handed out as machines (TMS above), so not anyone's signature by
	// learnset, and the bot treats them as ordinary moves rather than a Pokemon's own.
	for (const [id, move] of Object.entries(MOVES)) data[id] = { gen: 9, ...move, ...(TMS[id] ? { velvetShared: true } : {}) };
	// Dexterity (Yamame Kurodani): Toxic Spikes and Sticky Web pass it by as well.
	for (const id of ['toxicspikes', 'stickyweb']) if (data[id] && data[id].condition) data[id] = dexterous(data[id]);
	// Hyperspace Fury: Junko can use it, as Hoopa-Unbound can.
	if (data.hyperspacefury && data.hyperspacefury.onTry) {
		const own = data.hyperspacefury.onTry;
		data.hyperspacefury = {
			...data.hyperspacefury,
			onTry(source) {
				if (source.species.name === 'Junko') return;
				return own.apply(this, arguments);
			},
		};
	}
	return data;
};

// --------------------------------------------------------------- abilities

const halveTypes = (types, name) => ({
	onSourceModifyAtkPriority: 6,
	onSourceModifyAtk(atk, attacker, defender, move) {
		if (types.includes(move.type)) return this.chainModify(0.5);
	},
	onSourceModifySpAPriority: 5,
	onSourceModifySpA(atk, attacker, defender, move) {
		if (types.includes(move.type)) return this.chainModify(0.5);
	},
	flags: { breakable: 1 },
});
const SEASON_OF = {
	sunnyday: 'Okina Matara-Summer', desolateland: 'Okina Matara-Summer',
	raindance: 'Okina Matara-Spring', primordialsea: 'Okina Matara-Spring',
	sandstorm: 'Okina Matara-Autumn',
	hail: 'Okina Matara-Winter', snow: 'Okina Matara-Winter',
};
const CACTUS_STATS = { atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD' };

const ABILITIES = {
	hakkero: {
		num: -201, rating: 2, flags: {},
		name: 'Hakkero',
		shortDesc: 'This Pokemon\'s Fire moves are not weakened by rain.',
		desc: "Rain does not halve the power of this Pokemon's Fire-type attacks. Marisa Kirisame's Mini-Hakkero.",
	},
	darkborder: {
		num: -202, rating: 3.5, ...halveTypes(['Fairy', 'Fire']),
		name: 'Dark Border',
		shortDesc: 'Fairy and Fire damage taken is halved.',
		desc: "This Pokemon takes half damage from Fairy-type and Fire-type attacks (the attacker's attacking stat is halved). Mold Breaker ignores it.",
	},
	mistystep: {
		num: -203, rating: 2.5, flags: {},
		onModifySpe(spe) {
			if (this.field.isTerrain('mistyterrain')) return this.chainModify(2);
		},
		name: 'Misty Step',
		shortDesc: 'Speed is doubled in Misty Terrain.',
		desc: "If Misty Terrain is active, this Pokemon's Speed is doubled.",
	},
	anemic: {
		num: -204, rating: 2.5, flags: {},
		onBasePowerPriority: 19,
		onBasePower(basePower, attacker, defender, move) {
			if (move.category !== 'Special') return;
			for (const moveSlot of attacker.moveSlots) if (moveSlot.id === move.id && moveSlot.pp > 0) moveSlot.pp--;
			return this.chainModify(1.2);
		},
		name: 'Anemic',
		shortDesc: 'Special moves have 1.2x power but use 2 PP.',
		desc: "This Pokemon's special attacks have their power multiplied by 1.2, and each use of one costs an extra PP (taken when it deals damage).",
	},
	maidstrick: {
		num: -205, rating: 3, flags: {},
		onModifyPriority(priority, pokemon, target, move) {
			if (move.flags['slicing'] && pokemon.hp === pokemon.maxhp) return priority + 1;
		},
		name: "Maid's Trick",
		shortDesc: 'At full HP, its slicing moves have +1 priority.',
		desc: "If this Pokemon is at full HP, its slicing moves have their priority increased by 1.",
	},
	vampirism: {
		num: -206, rating: 3, flags: {},
		onModifyMove(move) {
			if (move.flags['bite']) move.drain = move.drain || [1, 4];
		},
		name: 'Vampirism',
		shortDesc: 'Biting moves heal it by 25% of the damage dealt.',
		desc: "This Pokemon's biting moves restore 1/4 of the damage they deal to it, as draining moves do. Remilia Scarlet's.",
	},
	illusorybacking: {
		num: -207, rating: 1, flags: {},
		onAllyBasePowerPriority: 22,
		onAllyBasePower(basePower, attacker, defender, move) {
			if (move.flags['sound'] && attacker !== this.effectState.target) return this.chainModify([5325, 4096]);
		},
		name: 'Illusory Backing',
		shortDesc: 'Allies\' sound moves have 1.3x power.',
		desc: "This Pokemon's allies have the power of their sound moves multiplied by 1.3. Its own are not boosted. Lyrica Prismriver's.",
	},
	netherworldsspring: {
		num: -208, rating: 2, flags: {},
		onResidual(pokemon) {
			if (pokemon.hp && pokemon.hp < pokemon.baseMaxhp && this.field.isWeather('snow')) {
				if (this.field.clearWeather()) this.heal(pokemon.baseMaxhp / 3, pokemon, pokemon);
			}
		},
		name: "Netherworld's Spring",
		shortDesc: 'End of turn, if hurt: ends Snow to heal 1/3 max HP.',
		desc: "At the end of each turn, if Snow is active and this Pokemon is not at full HP, the Snow ends and this Pokemon restores 1/3 of its maximum HP.",
	},
	demonparade: {
		num: -209, rating: 2, flags: {},
		onModifySpe(spe, pokemon) {
			if (pokemon.adjacentFoes().some(foe => foe.status === 'brn')) return this.chainModify(2);
		},
		name: 'Demon Parade',
		shortDesc: 'Speed is doubled if an adjacent foe is burned.',
		desc: "This Pokemon's Speed is doubled while an adjacent opposing Pokemon is burned. Suika Ibuki's.",
	},
	nightsong: {
		num: -210, rating: 3, flags: {},
		onModifyTypePriority: -1,
		onModifyType(move, pokemon) {
			if (move.flags['sound'] && !pokemon.volatiles['dynamax']) move.type = 'Dark';
		},
		name: 'Night Song',
		shortDesc: 'This Pokemon\'s sound moves become Dark type.',
		desc: "This Pokemon's sound-based moves become Dark type (not while it is Dynamaxed). Mystia Lorelei's.",
	},
	werehakutaku: {
		num: -211, rating: 3.5,
		onSourceAfterFaint(length, target, source, effect) {
			if (effect && effect.effectType === 'Move' && source.species.id === 'keine') {
				source.formeChange('Keine-Hakutaku', this.effect, true);
			}
		},
		flags: { failroleplay: 1, noreceiver: 1, noentrain: 1, notrace: 1, failskillswap: 1, cantsuppress: 1 },
		name: 'Were-Hakutaku',
		shortDesc: 'Keine: becomes Keine-Hakutaku after knocking out a foe.',
		desc: "If this Pokemon is Keine and knocks out a Pokemon with an attack, it becomes Keine-Hakutaku for the rest of the battle. This Ability can't be suppressed, copied, swapped or replaced.",
	},
	brainofthemoon: {
		num: -212, rating: 3, ...halveTypes(['Psychic', 'Dark']),
		name: 'Brain of the Moon',
		shortDesc: 'Psychic and Dark damage taken is halved.',
		desc: "This Pokemon takes half damage from Psychic-type and Dark-type attacks (the attacker's attacking stat is halved). Mold Breaker ignores it. Eirin Yagokoro's.",
	},
	blackandwhite: {
		num: -213, rating: 3, flags: {},
		onModifyDamage(damage, source, target, move) {
			if (!move) return;
			const typeMod = target.getMoveHitData(move).typeMod;
			if (typeMod > 0) return this.chainModify(1.5);
			if (typeMod < 0) return this.chainModify(0.5);
		},
		name: 'Black and White',
		shortDesc: 'Its super effective moves 1.5x damage; not very effective 0.5x.',
		desc: "This Pokemon's super effective attacks deal 1.5 times the damage, and its not very effective attacks deal half the damage. Eiki Shiki's.",
	},
	cursegathering: {
		num: -214, rating: 2, flags: {},
		onAnyRedirectTarget(target, source, source2, move) {
			if (move.category !== 'Status' || move.flags['pledgecombo']) return;
			const redirectTarget = ['randomNormal', 'adjacentFoe'].includes(move.target) ? 'normal' : move.target;
			if (this.validTarget(this.effectState.target, source, redirectTarget)) {
				if (move.smartTarget) move.smartTarget = false;
				if (this.effectState.target !== target) this.add('-activate', this.effectState.target, 'ability: Curse Gathering');
				return this.effectState.target;
			}
		},
		name: 'Curse Gathering',
		shortDesc: 'Draws single-target status moves to itself.',
		desc: "This Pokemon redirects single-target status moves to itself, as Storm Drain does for Water moves, when it is a valid target. Hina Kagiyama's.",
	},
	swordofhisou: {
		num: -215, rating: 3.5, flags: {},
		onStart(pokemon) {
			if (pokemon.effectiveWeather()) this.add('-ability', pokemon, 'Sword of Hisou');
		},
		onWeatherChange(pokemon) {
			if (pokemon.effectiveWeather()) this.add('-ability', pokemon, 'Sword of Hisou');
		},
		// Sword of Ruin while any weather is up: every other Pokemon's Defense x0.75.
		onAnyModifyDef(def, target, source, move) {
			const holder = this.effectState.target;
			if (!holder.effectiveWeather() || target === holder || target.hasAbility('Sword of Ruin')) return;
			if (!move.ruinedDef || !move.ruinedDef.hasAbility(['Sword of Ruin', 'Sword of Hisou'])) move.ruinedDef = holder;
			if (move.ruinedDef !== holder) return;
			return this.chainModify(0.75);
		},
		name: 'Sword of Hisou',
		shortDesc: 'While weather is active: Sword of Ruin (others\' Def x0.75).',
		desc: "While any weather is active, this Pokemon has Sword of Ruin's effect: the Defense of every other active Pokemon is multiplied by 0.75. Does not stack with Sword of Ruin. Tenshi Hinanawi's.",
	},
	dexterity: {
		num: -216, rating: 3, flags: {},
		onDamage(damage, target, source, effect) {
			if (effect && ['stealthrock', 'spikes', 'gmaxsteelsurge'].includes(effect.id)) return false;
		},
		name: 'Dexterity',
		shortDesc: 'Unaffected by entry hazards.',
		desc: "This Pokemon is unaffected by entry hazards: Stealth Rock, Spikes, G-Max Steelsurge, Toxic Spikes (which it does not absorb either) and Sticky Web. Yamame Kurodani's.",
	},
	jealous: {
		num: -217, rating: 2.5, flags: {},
		onBasePowerPriority: 19,
		onBasePower(basePower, attacker, defender, move) {
			if (move.target === 'normal' || move.target === 'any') return this.chainModify(Math.min(2, 1 + 0.1 * defender.positiveBoosts()));
		},
		name: 'Jealous',
		shortDesc: '+10% power per positive stat stage on the target, up to 2x.',
		desc: "This Pokemon's single-target moves gain 10% power for each positive stat stage the target has, up to double power. Parsee Mizuhashi's.",
	},
	recollection: {
		num: -218, rating: 3, flags: {},
		onSwitchIn(source) {
			const target = source.side.foe.active[source.side.foe.active.length - 1 - source.position];
			if (!target) return;
			for (const moveSlot of target.moveSlots.slice(0, 4)) {
				if (!moveSlot || source.moveSlots.some(m => m.id === moveSlot.id)) continue;
				const move = this.dex.moves.get(moveSlot.id);
				source.moveSlots.push({
					move: move.name, id: move.id, pp: 5, maxpp: 5, target: move.target,
					disabled: false, disabledSource: '', used: false,
				});
			}
		},
		name: 'Recollection',
		shortDesc: 'On switch-in, learns the opposing Pokemon\'s moves (5 PP each).',
		desc: "When this Pokemon switches in, it learns every move of the opposing Pokemon facing it that it does not already know, with 5 PP each, in addition to its own moves, until it switches out. Satori Komeiji's.",
	},
	delusion: {
		num: -219, rating: 2, flags: {},
		onResidual(pokemon) {
			if (pokemon.volatiles['confusion'] || this.field.isTerrain('psychicterrain')) this.heal(pokemon.baseMaxhp / 8, pokemon, pokemon);
		},
		name: 'Delusion',
		shortDesc: 'Heals 1/8 each turn while confused or in Psychic Terrain.',
		desc: "At the end of each turn, this Pokemon restores 1/8 of its maximum HP if it is confused or Psychic Terrain is active.",
	},
	surprise: {
		num: -220, rating: 3, flags: {},
		onStart(pokemon) {
			let activated = false;
			for (const target of pokemon.adjacentFoes()) {
				if (!activated) {
					this.add('-ability', pokemon, 'Surprise', 'boost');
					activated = true;
				}
				if (target.volatiles['substitute'] || target.hasType('Psychic')) {
					this.add('-immune', target);
				} else {
					this.boost({ spa: -1 }, target, pokemon, null, true);
				}
			}
		},
		name: 'Surprise',
		shortDesc: 'On switch-in, -1 Sp. Atk to adjacent foes. Psychic types are immune.',
		desc: "On switch-in, this Pokemon lowers the Special Attack of adjacent opposing Pokemon by 1 stage. Psychic-type Pokemon and Pokemon behind a substitute are not affected. Kogasa Tatara's, the Intimidate of special attackers.",
	},
	summonnyuudou: {
		num: -221, rating: 4,
		onSwitchOut(pokemon) {
			if (pokemon.baseSpecies.baseSpecies !== 'Ichirin Kumoi') return;
			if (pokemon.species.forme !== 'Unzan') {
				pokemon.formeChange('Ichirin Kumoi-Unzan', this.effect, true);
				pokemon.set.ability = 'Iron Fist';
			}
		},
		onSwitchIn(pokemon) {
			if (pokemon.baseSpecies.baseSpecies !== 'Ichirin Kumoi') return;
			if (!this.effectState.heroMessageDisplayed && pokemon.species.forme === 'Unzan') {
				this.add('-activate', pokemon, 'ability: Summon Nyuudou');
				this.effectState.heroMessageDisplayed = true;
			}
		},
		flags: { failroleplay: 1, noreceiver: 1, noentrain: 1, notrace: 1, failskillswap: 1, notransform: 1 },
		name: 'Summon Nyuudou',
		shortDesc: 'Ichirin Kumoi: becomes Ichirin Kumoi-Unzan on switching out.',
		desc: "When Ichirin Kumoi switches out, she becomes Ichirin Kumoi-Unzan (with Iron Fist) for the rest of the battle, as Palafin becomes Palafin-Hero. This Ability can't be copied, swapped or replaced.",
	},
	waterygrave: {
		num: -222, rating: 2, flags: {},
		onSourceAfterFaint(length, target, source, effect) {
			if (effect && effect.effectType === 'Move') this.field.setWeather('raindance');
		},
		name: 'Watery Grave',
		shortDesc: 'Summons rain after knocking out a foe.',
		desc: "When this Pokemon knocks out a Pokemon with an attack, it summons Rain Dance for 5 turns (8 with Damp Rock). Minamitsu Murasa's.",
	},
	devilsrecitation: {
		num: -223, rating: 2, flags: {},
		onBasePower(basePower, attacker, defender, move) {
			if (move.type === 'Dark' && this.field.isTerrain('psychicterrain')) return this.chainModify(1.5);
		},
		name: "Devil's Recitation",
		shortDesc: 'Dark moves have 1.5x power in Psychic Terrain.',
		desc: "While Psychic Terrain is active, this Pokemon's Dark-type attacks have their power multiplied by 1.5. Byakuren Hijiri's.",
	},
	undefineddefense: {
		num: -224, rating: 2.5, flags: {},
		onSourceModifyDamage(damage, source, target, move) {
			if (move.type === target.teraType) return this.chainModify(0.5);
		},
		name: 'Undefined Defense',
		shortDesc: 'Halves damage from moves of its own Tera type.',
		desc: "This Pokemon takes half damage from attacks of the same type as its Tera Type, whether or not it has Terastallized. Nue Houjuu's.",
	},
	echo: {
		num: -225, rating: 2.5, flags: {},
		onTryHit(target, source, move) {
			if (target !== source && move.flags['sound']) {
				this.add('-immune', target, '[from] ability: Echo');
				return null;
			}
		},
		onAllyTryHitSide(target, source, move) {
			if (move.flags['sound']) this.add('-immune', this.effectState.target, '[from] ability: Echo');
		},
		// The echo itself: the mod repeats it in its runMove, after the move; this is the
		// same moment (the move's AfterMove), the way Dancer copies a dance.
		onAnyAfterMove(source, target, move) {
			const echoer = this.effectState.target;
			if (!move || source === echoer || !move.flags['sound'] || move.isExternal) return;
			if (!echoer.isActive || echoer.fainted || !echoer.hp || echoer.isSemiInvulnerable()) return;
			this.add('-activate', echoer, 'ability: Echo');
			const first = this.activeTarget;
			const at = first && !first.isAlly(echoer) && source.isAlly(echoer) ? first : source;
			this.actions.runMove(move.id, echoer, echoer.getLocOf(at), { sourceEffect: this.dex.abilities.get('echo'), externalMove: true });
		},
		name: 'Echo',
		shortDesc: 'Immune to sound moves; repeats any sound move another Pokemon uses.',
		desc: "This Pokemon is immune to sound-based moves used by others. When another Pokemon uses a sound-based move, this Pokemon uses it too, right after, as Dancer does for dances: at the original user if that was a foe, otherwise at the original target. Kyouko Kasodani's.",
	},
	healbydesire: {
		num: -226, rating: 3.5,
		onTryHit(target, source, move) {
			if (target !== source && move.type === 'Ghost') {
				if (!this.heal(target.baseMaxhp / 4)) this.add('-immune', target, '[from] ability: Heal by Desire');
				return null;
			}
		},
		flags: { breakable: 1 },
		name: 'Heal by Desire',
		shortDesc: 'Ghost immunity; heals 1/4 max HP when hit by Ghost.',
		desc: "This Pokemon is immune to Ghost-type moves and restores 1/4 of its maximum HP when hit by one. Mold Breaker ignores it. Yoshika Miyako's.",
	},
	'100medicines': {
		num: -227, rating: 2, flags: {},
		onResidualOrder: 5,
		onResidualSubOrder: 3,
		onResidual(pokemon) {
			if (pokemon.status && this.field.isTerrain('grassyterrain')) {
				this.add('-activate', pokemon, 'ability: 100 Medicines');
				pokemon.cureStatus();
			}
		},
		name: '100 Medicines',
		shortDesc: 'Cures its status at the end of each turn in Grassy Terrain.',
		desc: "At the end of each turn, if Grassy Terrain is active, this Pokemon is cured of its non-volatile status condition.",
	},
	wickedpower: {
		num: -228, rating: 2.5, flags: {},
		onDamagingHitOrder: 1,
		onDamagingHit(damage, target) {
			target.addVolatile('wickedenergy');
		},
		name: 'Wicked Power',
		shortDesc: 'When hit by an attack, its next Dark move has 2x power.',
		desc: "When this Pokemon is damaged by an attack, it is charged as by Wicked Energy (without the Special Defense boost): its next Dark-type attack has its power doubled. Kasen Ibaraki's.",
	},
	growbigger: {
		num: -229, rating: 0, flags: {},
		name: 'Grow Bigger',
		shortDesc: 'No effect here: in the original mod, its only way to Dynamax.',
		desc: "No competitive use on this server. In the Touhoumons mod this was the only way to Dynamax, once a battle and for one turn; every RP format here already lets any Pokemon Dynamax. Shinmyoumaru Sukuna's.",
	},
	pristinebeat: {
		num: -230, rating: 2.5, flags: {},
		onStart(pokemon) {
			pokemon.addVolatile('pristinebeat');
		},
		condition: {
			onStart() {
				this.effectState.lastMove = '';
				this.effectState.numConsecutive = 0;
			},
			onTryMovePriority: -2,
			onTryMove(pokemon, target, move) {
				if (!pokemon.hasAbility('pristinebeat')) {
					pokemon.removeVolatile('pristinebeat');
					return;
				}
				if (move.callsMove) return;
				if (this.effectState.lastMove === move.id && pokemon.moveLastTurnResult) {
					this.effectState.numConsecutive++;
				} else if (pokemon.volatiles['twoturnmove']) {
					if (this.effectState.lastMove !== move.id) this.effectState.numConsecutive = 1;
					else this.effectState.numConsecutive++;
				} else {
					this.effectState.numConsecutive = 0;
				}
				this.effectState.lastMove = move.id;
			},
			onModifyDamage() {
				const dmgMod = [4096, 4915, 5734, 6553, 7372, 8192];
				const n = Math.min(5, this.effectState.numConsecutive);
				return this.chainModify([dmgMod[n], 4096]);
			},
		},
		name: 'Pristine Beat',
		shortDesc: 'The Metronome item: +20% per consecutive use of a move, up to 2x.',
		desc: "Each time this Pokemon uses the same move successfully in a row, the move deals 20% more damage, up to double after five, as if it held a Metronome. Raiko Horikawa's.",
	},
	dangoinfluence: {
		num: -231, rating: 2, flags: {},
		onEatItem(item, pokemon) {
			this.boost({ atk: 1 }, pokemon);
		},
		name: 'Dango Influence',
		shortDesc: 'Eating a Berry raises its Attack by 1.',
		desc: "When this Pokemon eats a Berry, its Attack is raised by 1 stage. Ringo's.",
	},
	lunatictorch: {
		num: -232, rating: 1.5, flags: {},
		// Sun's damage effect, for its own attacks, while Psychic Terrain is up and the sun is not.
		onWeatherModifyDamage(damage, attacker, defender, move) {
			if (attacker !== this.effectState.target || !this.field.isTerrain('psychicterrain')) return;
			if (this.field.isWeather(['sunnyday', 'desolateland']) || (defender && defender.hasItem('utilityumbrella'))) return;
			if (move.type === 'Fire') return this.chainModify(1.5);
			if (move.type === 'Water') return this.chainModify(0.5);
		},
		name: 'Lunatic Torch',
		shortDesc: 'In Psychic Terrain its attacks act as in sun (Fire 1.5x, Water 0.5x).',
		desc: "While Psychic Terrain is active and the weather is not sun, this Pokemon's attacks are affected as if the sun were out: its Fire-type attacks deal 1.5x damage and its Water-type attacks half. Clownpiece's.",
	},
	foolsgold: {
		num: -233, rating: 2, flags: {},
		onTryHit(target, source, move) {
			if (move.category === 'Status' && target !== source) {
				this.add('-immune', target, "[from] ability: Fool's Gold");
				target.setAbility('defeatist');
				return null;
			}
		},
		name: "Fool's Gold",
		shortDesc: 'Blocks the first status move aimed at it, then becomes Defeatist.',
		desc: "This Pokemon is immune to status moves used on it by other Pokemon. The first time it blocks one, its Ability becomes Defeatist. Joon Yorigami's.",
	},
	cutdeep: {
		num: -234, rating: 2.5, flags: {},
		onSourceDamagingHit(damage, target, source, move) {
			if (!move.flags['slicing'] || target.hasAbility('shielddust') || target.hasItem('covertcloak')) return;
			this.boost({ def: -1 }, target, source);
		},
		name: 'Cut Deep',
		shortDesc: 'Its slicing moves lower the target\'s Defense by 1.',
		desc: "When this Pokemon damages a Pokemon with a slicing move, the target's Defense is lowered by 1 stage. Shield Dust and Covert Cloak prevent it. Nemuno Sakata's.",
	},
	winterhearth: {
		num: -235, rating: 2, flags: {},
		onBasePower(basePower, attacker, defender, move) {
			if (this.field.isWeather(['hail', 'snow']) && move.type === 'Fire') return this.chainModify(2);
		},
		name: 'Winter Hearth',
		shortDesc: 'Fire moves have 2x power in Snow.',
		desc: "While Snow (or hail) is active, this Pokemon's Fire-type attacks have their power doubled. Narumi Yatadera's.",
	},
	fourseasons: {
		num: -236, rating: 3,
		onSwitchInPriority: -2,
		onStart(pokemon) {
			this.singleEvent('WeatherChange', this.effect, this.effectState, pokemon);
		},
		onWeatherChange(pokemon) {
			if (pokemon.baseSpecies.baseSpecies !== 'Okina Matara' || pokemon.transformed) return;
			const forme = SEASON_OF[pokemon.effectiveWeather()] || 'Okina Matara';
			if (pokemon.isActive && pokemon.species.name !== forme) pokemon.formeChange(forme, this.effect, false, '[msg]');
		},
		flags: { failroleplay: 1, noentrain: 1, notrace: 1, failskillswap: 1, cantsuppress: 1 },
		name: 'Four Seasons',
		shortDesc: 'Okina Matara: her forme follows the weather.',
		desc: "Okina Matara changes forme with the weather: Spring (Water/Dark) in rain, Summer (Fire/Dark) in sun, Autumn (Rock/Dark) in sandstorm, Winter (Ice/Dark) in snow, and back to Normal/Dark when it clears. This Ability can't be suppressed, copied or swapped.",
	},
	heavystone: {
		num: -237, rating: 2, flags: {},
		onStart(source) {
			this.add('-activate', source, 'ability: Heavy Stone');
			this.field.addPseudoWeather('gravity');
		},
		name: 'Heavy Stone',
		shortDesc: 'On switch-in, sets Gravity for 5 turns.',
		desc: "On switch-in, this Pokemon summons Gravity for 5 turns. Urumi Ushizaki's.",
	},
	marchingorders: {
		num: -238, rating: 2, flags: {},
		onAllyAfterMove(ally) {
			if (!ally.lastMove || ally.lastMove.priority > 0) return;
			const pokemon = this.effectState.target;
			if (!pokemon) return;
			const action = this.queue.willMove(pokemon);
			if (!action) return;
			this.add('-activate', pokemon, 'ability: Marching Orders');
			this.queue.prioritizeAction(action);
		},
		name: 'Marching Orders',
		shortDesc: 'Moves right after an ally uses a non-priority move.',
		desc: "When an ally uses a move without positive priority, this Pokemon takes its turn immediately afterwards, if it has not moved yet. Mayumi Joutouguu's.",
	},
	blacksmoke: {
		num: -239, rating: 3, flags: {},
		onAnyTryBoost(boost, target, source, effect) {
			if (target === this.effectState.target || !target.runStatusImmunity('powder')) return;
			let showMsg = false;
			for (const stat in boost) {
				if (boost[stat] > 0) {
					delete boost[stat];
					showMsg = true;
				}
			}
			if (showMsg && !(effect && effect.secondaries) && (!effect || effect.id !== 'octolock')) {
				this.add('-fail', target, 'boost', '[from] ability: Black Smoke', `[of] ${this.effectState.target}`);
			}
		},
		name: 'Black Smoke',
		shortDesc: 'No other Pokemon\'s stats can rise, unless powder-immune.',
		desc: "While this Pokemon is active, no other Pokemon can have its stat stages raised, unless it is immune to powder moves (Grass types, Overcoat, Safety Goggles). Sannyo Komakusa's.",
	},
	property: {
		num: -240, rating: 1.5,
		onTakeItem(item, pokemon, source) {
			if (!this.activeMove) throw new Error('Battle.activeMove is null');
			if (!pokemon.hp || pokemon.item === 'stickybarb') return;
			if ((source && source !== pokemon) || this.activeMove.id === 'knockoff') {
				this.add('-activate', pokemon, 'ability: Property');
				return false;
			}
		},
		flags: { breakable: 1 },
		name: 'Property',
		shortDesc: 'Its item cannot be removed by other Pokemon.',
		desc: "This Pokemon's held item cannot be taken or knocked off by other Pokemon, as with Sticky Hold. Chimata Tenkyuu's.",
	},
	dragoneater: {
		num: -241, rating: 2.5, flags: {},
		onBasePower(basePower, attacker, defender) {
			if (defender.hasType('Dragon')) return this.chainModify(1.5);
		},
		name: 'Dragon Eater',
		shortDesc: 'Its attacks have 1.5x power against Dragon types.',
		desc: "This Pokemon's attacks have their power multiplied by 1.5 against Dragon-type Pokemon. Momoyo Himemushi's.",
	},
	bloodsucker: {
		num: -242, rating: 2.5, flags: {},
		onAfterMoveSecondarySelf(pokemon, target, move) {
			if (move.flags['contact'] && (!target || target.fainted || target.hp <= 0)) this.heal(pokemon.baseMaxhp / 3, pokemon, pokemon);
		},
		name: 'Bloodsucker',
		shortDesc: 'Knocking out a foe with a contact move heals 1/3 max HP.',
		desc: "When this Pokemon knocks out a Pokemon with a contact move, it restores 1/3 of its maximum HP. Chiyari Tenkajin's.",
	},
	void: {
		num: -243, rating: 4, flags: {},
		onSwitchIn(pokemon) {
			for (const foe of pokemon.foes()) {
				if (!foe.getAbility().flags['cantsuppress']) foe.addVolatile('gastroacid');
			}
		},
		name: 'Void',
		shortDesc: 'On switch-in, suppresses the opposing Pokemon\'s Abilities.',
		desc: "On switch-in, this Pokemon suppresses the Abilities of the opposing active Pokemon, as Gastro Acid does, until they switch out. Abilities that can't be suppressed are unaffected. Zanmu Nippaku's.",
	},
	cactusdrive: {
		num: -244, rating: 3,
		onSwitchInPriority: -2,
		onStart(pokemon) {
			this.singleEvent('TerrainChange', this.effect, this.effectState, pokemon);
		},
		onTerrainChange(pokemon) {
			if (this.field.isTerrain('grassyterrain')) {
				pokemon.addVolatile('cactusdrive');
			} else if (!(pokemon.volatiles['cactusdrive'] && pokemon.volatiles['cactusdrive'].fromBooster)) {
				pokemon.removeVolatile('cactusdrive');
			}
		},
		onEnd(pokemon) {
			delete pokemon.volatiles['cactusdrive'];
			this.add('-end', pokemon, 'Cactus Drive', '[silent]');
		},
		condition: Object.assign({
			noCopy: true,
			onStart(pokemon, source, effect) {
				if (effect && effect.name === 'Booster Energy') {
					this.effectState.fromBooster = true;
					this.add('-activate', pokemon, 'ability: Cactus Drive', '[fromitem]');
				} else {
					this.add('-activate', pokemon, 'ability: Cactus Drive');
				}
				this.effectState.bestStat = pokemon.getBestStat(false, true);
				this.add('-start', pokemon, 'cactusdrive' + this.effectState.bestStat);
			},
			onModifySpe(spe, pokemon) {
				if (this.effectState.bestStat !== 'spe' || pokemon.ignoringAbility()) return;
				return this.chainModify(1.5);
			},
			onEnd(pokemon) {
				this.add('-end', pokemon, 'Cactus Drive');
			},
		}, ...Object.entries(CACTUS_STATS).map(([stat, Name]) => ({
			[`onModify${Name}Priority`]: stat === 'atk' || stat === 'spa' ? 5 : 6,
			[`onModify${Name}`](value, pokemon) {
				if (this.effectState.bestStat !== stat || pokemon.ignoringAbility()) return;
				return this.chainModify([5325, 4096]);
			},
		}))),
		flags: { failroleplay: 1, noreceiver: 1, noentrain: 1, notrace: 1, failskillswap: 1, notransform: 1 },
		name: 'Cactus Drive',
		shortDesc: 'Grassy Terrain or Booster Energy: highest stat 1.3x, or Speed 1.5x.',
		desc: "Quark Drive, for Grassy Terrain: while Grassy Terrain is active, or once after using a Booster Energy, this Pokemon's highest stat is multiplied by 1.3, or by 1.5 if that is Speed. VIVIT's.",
	},
	corruptdata: {
		num: -245, rating: 2, flags: {},
		onDamagingHit(damage, target, source, move) {
			if (!this.checkMoveMakesContact(move, source, target)) return;
			if (source.setType('???')) this.add('-start', source, 'typechange', '???', '[from] ability: Corrupt Data');
		},
		name: 'Corrupt Data',
		shortDesc: 'An attacker making contact with it becomes typeless.',
		desc: "When a Pokemon makes contact with this Pokemon, the attacker loses its types and becomes typeless (???) until it switches out. Yuiman Asama's.",
	},
	immovable: {
		num: -246, rating: 1, flags: { breakable: 1 },
		onDragOutPriority: 1,
		onDragOut(pokemon) {
			this.add('-activate', pokemon, 'ability: Immovable');
			return null;
		},
		name: 'Immovable',
		shortDesc: 'Cannot be forced out by moves or items.',
		desc: "This Pokemon cannot be forced to switch out by another Pokemon's moves or items, as with Suction Cups. Mold Breaker ignores it. Ariya Iwanaga's.",
	},
	truthoverload: {
		num: -247, rating: 2, flags: {},
		onDamagingHit(damage, target, source, move) {
			if (this.checkMoveMakesContact(move, source, target) && this.randomChance(3, 10)) source.addVolatile('confusion', source, move);
		},
		name: 'Truth Overload',
		shortDesc: '30% chance to confuse an attacker making contact.',
		desc: "When a Pokemon makes contact with this Pokemon, it has a 30% chance to become confused. Nina Watari's.",
	},
	/*
	 * Remilia and Flandre's Awakened ability (the owner, 21 Oct 2026: "literally old gen
	 * Soul Dew", then: "Attack and Special Attack"): the Gen 3-6 Soul Dew's 1.5x, on Attack
	 * and Special Attack, with no item and no condition. Not the mod's: granted beside what each sister already has
	 * (GRANTS below, applied by buffs.js like any Awakened ability).
	 */
	scarletsisters: {
		num: -248, rating: 3.5, flags: {},
		onModifyAtkPriority: 5,
		onModifyAtk(atk) {
			return this.chainModify(1.5);
		},
		onModifySpAPriority: 5,
		onModifySpA(spa) {
			return this.chainModify(1.5);
		},
		name: 'Scarlet Sisters',
		shortDesc: "This Pokemon's Attack and Sp. Atk are 1.5x.",
		desc: "This Pokemon's Attack and Special Attack are multiplied by 1.5, in the manner of the old Soul Dew, without holding anything. Remilia and Flandre Scarlet's.",
	},
};

exports.abilities = (data) => {
	for (const [id, ability] of Object.entries(ABILITIES)) data[id] = { gen: 9, ...ability };
	return data;
};

// ------------------------------------------------------------------ items

const EIKI = 'eikishiki';
const SCARLET = ['remiliascarlet', 'flandrescarlet'];
const PLATES = ['dracoplate', 'dreadplate', 'earthplate', 'fistplate', 'flameplate', 'icicleplate', 'insectplate', 'ironplate',
	'meadowplate', 'mindplate', 'pixieplate', 'skyplate', 'splashplate', 'spookyplate', 'stoneplate', 'toxicplate', 'zapplate'];

const ITEMS = {
	/*
	 * Bloodlust: the Scarlet sisters' own item (the owner, 21 Oct 2026). +1 Speed every
	 * time the holder comes in, as often as it comes in - the old Intrepid Sword, before
	 * Zacian's was cut to once a battle. Nobody else gets anything from it, and like the
	 * trio's items (abyss-shrine.js) it never leaves them and they never take one, so
	 * Knock Off neither removes it nor gains power from it.
	 */
	bloodlust: {
		num: -203, gen: 9, spritenum: 390, name: 'Bloodlust',
		fling: { basePower: 30 },
		itemUser: ['Remilia Scarlet', 'Flandre Scarlet'],
		onStart(pokemon) {
			if (!SCARLET.includes(pokemon.baseSpecies.id)) return;
			this.boost({ spe: 1 }, pokemon);
		},
		onTakeItem(item, pokemon, source) {
			return !(SCARLET.includes(pokemon.baseSpecies.id) || (source && SCARLET.includes(source.baseSpecies.id)));
		},
		shortDesc: 'Remilia or Flandre Scarlet: +1 Speed every time it switches in. Can\'t be removed.',
		desc: "If held by Remilia Scarlet or Flandre Scarlet, raises its Speed by 1 stage each time it enters the battle, with no limit. Does nothing for any other Pokemon. Can't be removed from either sister or stolen by one, so Knock Off gains no power against it.",
	},
	summerbackdoor: {
		num: -201, gen: 9, spritenum: 751, name: 'Summer Backdoor',
		forcedForme: 'Cirno-Tanned',
		itemUser: ['Cirno-Tanned'],
		onTakeItem(item, pokemon, source) {
			if ((source && source.baseSpecies.baseSpecies === 'Cirno') || pokemon.baseSpecies.baseSpecies === 'Cirno') return false;
			return true;
		},
		shortDesc: 'Cirno holding it becomes Cirno-Tanned. Can\'t be removed from Cirno.',
		desc: "If held by Cirno, she becomes Cirno-Tanned (Ice/Grass, Drought) for the battle. It cannot be removed from or given to Cirno, as the Griseous Core cannot be taken from Giratina.",
	},
	jeweledpagoda: {
		num: -202, gen: 9, spritenum: 92, name: 'Jeweled Pagoda',
		fling: { basePower: 30 },
		itemUser: ['Nazrin', 'Shou Toramaru'],
		onBasePowerPriority: 15,
		onBasePower(basePower, source, target, move) {
			if (!['Nazrin', 'Shou Toramaru'].includes(source.baseSpecies.baseSpecies)) return;
			if (move && move.type === 'Fairy') return this.chainModify(1.5);
		},
		shortDesc: 'Nazrin, Shou Toramaru: Fairy moves have 1.5x power.',
		desc: "If held by Nazrin or Shou Toramaru, its Fairy-type attacks have their power multiplied by 1.5. Bishamonten's pagoda.",
	},
};

/** An existing item's handler, with something run before it that may answer first. */
function before(entry, key, first) {
	const own = entry[key];
	return {
		...entry,
		[key]: function () {
			const said = first.apply(this, arguments);
			if (said !== undefined) return said;
			return own ? own.apply(this, arguments) : undefined;
		},
	};
}

/** Hecatia changing body when she enters holding a stone (the mod's Water and Moon Stone). */
function hecatiaStone(forme, ability, stone) {
	return function (pokemon) {
		if (pokemon.species.name !== 'Hecatia') return;
		pokemon.formeChange(forme, this.effect, true);
		this.add('-ability', pokemon, ability, `[from] item: ${stone}`);
		pokemon.set.ability = ability;
		pokemon.eatItem();
	};
}

exports.items = (data) => {
	for (const [id, item] of Object.entries(ITEMS)) data[id] = item;
	// Eiki Shiki holds a plate for good, as Arceus does (the mod checked her number).
	for (const id of PLATES) {
		if (!data[id]) continue;
		data[id] = before(data[id], 'onTakeItem', function (item, pokemon, source) {
			if ((source && source.baseSpecies.id === EIKI) || pokemon.baseSpecies.id === EIKI) return false;
		});
	}
	// Booster Energy starts Cactus Drive as it does Quark Drive.
	if (data.boosterenergy) {
		data.boosterenergy = before(data.boosterenergy, 'onUpdate', function (pokemon) {
			if (!this.effectState.started || pokemon.transformed) return;
			if (pokemon.hasAbility('cactusdrive') && !this.field.isTerrain('grassyterrain') && pokemon.useItem()) {
				pokemon.addVolatile('cactusdrive');
			}
		});
	}
	for (const [id, forme, ability, stone] of [['waterstone', 'Hecatia-Earth', 'Natural Cure', 'Water Stone'], ['moonstone', 'Hecatia-Moon', 'Dazzling', 'Moon Stone']]) {
		if (!data[id]) continue;
		data[id] = {
			...data[id],
			onStart: hecatiaStone(forme, ability, stone),
			shortDesc: `Hecatia (Otherworld) holding it becomes ${forme} on entry, using it up.`,
			desc: `Evolves certain species of Pokemon when used. If held by Hecatia in her Otherworld body, it is used up when she enters the battle and she becomes ${forme} (${ability}) for the rest of it.`,
		};
	}
	return data;
};

// ------------------------------------------------------------- conditions

// Hakkero (Marisa Kirisame): rain does not weaken her Fire moves.
exports.conditions = (data) => {
	if (data.raindance && data.raindance.onWeatherModifyDamage) {
		const own = data.raindance.onWeatherModifyDamage;
		data.raindance = {
			...data.raindance,
			onWeatherModifyDamage(damage, attacker, defender, move) {
				if (move.type === 'Fire' && attacker.hasAbility('hakkero')) return;
				return own.apply(this, arguments);
			},
		};
	}
	return data;
};

exports.TIER = TIER;
exports.SPECIES = SPECIES;
exports.FORMES = FORMES;
exports.LEGENDS = LEGENDS;
// What config/custom-formats.js bans by name from every RP format but RP Touhou and the RP Battle ones.
exports.NAMES = NAMES;
exports.MOVE_IDS = Object.keys(MOVES);
exports.TMS = TMS;
// Awakened abilities for the guests, added beside the mod's (buffs.js, addAbilities).
exports.GRANTS = { remiliascarlet: ['Scarlet Sisters'], flandrescarlet: ['Scarlet Sisters'] };
// The spell cards that stay one character's signature though a few others learn them.
exports.PERSONAL = {
	dreamseal: 'reimuhakurei', stonestacking: 'eikaebisu',
	invokeamaterasu: 'watatsukinoyorihime', invokehonoikazuchi: 'watatsukinoyorihime', invokeishikoridome: 'watatsukinoyorihime',
};
exports.ABILITY_IDS = Object.keys(ABILITIES);
exports.ITEM_IDS = Object.keys(ITEMS);
// The vanilla entries changed above, for anything that lists what we changed.
exports.CHANGED_MOVES = ['toxicspikes', 'stickyweb', 'hyperspacefury'];
exports.CHANGED_ITEMS = ['boosterenergy', 'waterstone', 'moonstone', ...PLATES];
/**
 * For the builder's search: [alias, species id, where in the id it starts]. The mod's
 * own aliases (nicknames: "reimu", "patchy", "9"), and each later word of a name, so
 * "hakurei" finds Reimu Hakurei the way "valiant" finds Iron Valiant.
 */
exports.SEARCH_ALIASES = (() => {
	const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
	const out = [];
	const seen = new Set();
	const add = (alias, id) => {
		if (!alias || alias === id || seen.has(alias + '>' + id)) return;
		seen.add(alias + '>' + id);
		const at = id.indexOf(alias);
		out.push([alias, id, at > 0 ? at : 0]);
	};
	for (const [alias, id] of DATA.aliases) add(alias, id);
	for (const [id, s] of Object.entries(DATA.species)) {
		const words = s.name.split(/[^A-Za-z0-9]+/).filter(Boolean);
		for (let w = 1; w < words.length; w++) add(toID(words.slice(w).join('')), id);
	}
	return out;
})();
exports.SOURCE = DATA.source;
