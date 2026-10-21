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

/**
 * Typings the owner changed from the mod's (21 Oct 2026). The move tables read these too, so a
 * new type brings its kit with it.
 */
const TYPES = {
	// A fairy with wings.
	daiyousei: ['Fairy', 'Flying'],
	// The Master Spark: a lightning-hot beam from her hakkero.
	marisakirisame: ['Electric', 'Fire'],
	// An engineer kappa: her machines and the Super Scope run on electricity, not armour.
	nitorikawashiro: ['Water', 'Electric'],
	// The teacher who keeps Gensokyo's history: a mind of knowledge (base forme only; Hakutaku stays Steel/Dragon).
	keine: ['Steel', 'Psychic'],
	// The maid's time and space manipulation is a power of the mind; Psychic in the fan games.
	sakuyaizayoi: ['Steel', 'Psychic'],
	// The firefly youkai of the night, as in the hacks.
	wrigglenightbug: ['Bug', 'Dark'],
	// The ghost princess of the Saigyou Ayakashi, the cherry tree that blooms over her grave.
	yuyukosaigyouji: ['Ghost', 'Grass'],
	// The doll of the lily-of-the-valley field: poison from the flowers.
	medicinemelancholy: ['Poison', 'Grass'],
	// The tsurube-otoshi in her bucket, who drops into the fires of the old hell.
	kisume: ['Rock', 'Fire'],
	// The kuda-gitsune: a spirit fox, a tricky schemer.
	tsukasakudamaki: ['Ghost', 'Dark'],
};
/*
 * Base stats the owner set (21 Oct 2026: "all Scarlet Devil Mansion members should have decent
 * stats"). Written into the imported data as this file loads, so everything that reads
 * DATA.species - the dex, the physical/special split behind the move kits (sides), random
 * sets and the calc data - sees the same numbers.
 */
const STATS = {
	hongmeiling: { hp: 90, atk: 130, def: 105, spa: 70, spd: 80, spe: 105 },
	koakuma: { hp: 80, atk: 67, def: 80, spa: 115, spd: 90, spe: 108 },
	patchouliknowledge: { hp: 85, atk: 40, def: 70, spa: 150, spd: 115, spe: 100 },
	sakuyaizayoi: { hp: 90, atk: 115, def: 100, spa: 90, spd: 95, spe: 110 },
	remiliascarlet: { hp: 80, atk: 130, def: 95, spa: 120, spd: 100, spe: 115 },
	flandrescarlet: { hp: 75, atk: 140, def: 85, spa: 140, spd: 95, spe: 105 },
};
for (const [id, stats] of Object.entries(STATS)) if (DATA.species[id]) DATA.species[id].baseStats = { ...stats };
const typesOf = id => TYPES[id] || DATA.species[id].types;

exports.pokedex = (data) => {
	for (const [id, s] of Object.entries(DATA.species)) {
		data[id] = clone(s);
		if (TYPES[id]) data[id].types = TYPES[id];
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

/**
 * The main cast's signatures (the owner, 21 Oct 2026: "give Reimu and the main cast their
 * signature"): each character's best-known spell card, theirs alone. Move -> owner.
 */
const SIGNATURES = {
	fantasyseal: 'reimuhakurei', sakuyasworld: 'sakuyaizayoi', killingdoll: 'sakuyaizayoi',
	presentlifeslash: 'youmukonpaku', mosessmiracle: 'sanaekochiya', lunaticredeyes: 'reiseninaba',
	occultball: 'sumirekousami', perfectfreeze: 'cirno', rainbowwindchime: 'hongmeiling',
	royalflare: 'patchouliknowledge', artfulsacrifice: 'alicemargatroid', resurrectionbutterfly: 'yuyukosaigyouji',
	spiritingaway: 'yukariyakumo', ultimatebuddhist: 'ranyakumo', pentagramflight: 'chen',
	houraielixir: 'eirinyagokoro', impossiblerequest: 'kaguyahouraisan', phoenixrebirth: 'fujiwaranomokou',
	illusionarydominance: 'ayashameimaru', kappaspororoca: 'nitorikawashiro', expandedonbashira: 'kanakoyasaka',
	mishagujisama: 'suwakomoriya', terriblesouvenir: 'satorikomeiji', subterraneanrose: 'koishikomeiji',
	gigaflare: 'utsuhoreiuji', rekindlingofdeadashes: 'rinkaenbyou', superhumanhijiri: 'byakurenhijiri',
	undefinedufo: 'nuehoujuu', guseflash: 'toyosatomiminomiko', keystoneofheavenandearth: 'tenshihinanawi',
	elekiterdragonpalace: 'ikunagae', refloweringofgensokyo: 'yuukakazami', narrowconfinesofavici: 'komachionozuka',
	lastjudgement: 'eikishiki', missingpower: 'suikaibuki', tentransformations: 'mamizoufutatsuiwa',
	changeairbrave: 'seijakijin', shiningneedlesword: 'shinmyoumarusukuna', purelightofthepalm: 'junko',
	hiddenstarinallseasons: 'okinamatara',
};

/** Who learns each Touhou move: its owners in the mod, plus the signatures added here. */
const OWNERS = (() => {
	const out = {};
	for (const [id, entry] of Object.entries(DATA.learnsets)) {
		for (const move of Object.keys(entry.learnset || entry)) (out[move] = out[move] || new Set()).add(id);
	}
	out.fatescall = new Set(['remiliascarlet']);
	out.forbiddenbarrage = new Set(['flandrescarlet']);
	out.wickedenergy = new Set(['kasenibaraki']);
	out.masterspark = new Set(['marisakirisame']);
	for (const [move, id] of Object.entries(SIGNATURES)) out[move] = new Set([id]);
	return out;
})();

exports.learnsets = (data) => {
	for (const [id, learnset] of Object.entries(DATA.learnsets)) data[id] = { learnset: clone(learnset) };
	// Fate's Call (ours, not the mod's): Remilia's alone, from level 1.
	if (data.remiliascarlet) data.remiliascarlet.learnset.fatescall = ['9L1'];
	// Forbidden Barrage: Flandre's alone now. The mod also taught it to Byakuren Hijiri
	// and Zanmu Nippaku; they no longer learn it.
	for (const id of Object.keys(DATA.learnsets)) if (id !== 'flandrescarlet' && data[id]) delete data[id].learnset.forbiddenbarrage;
	if (data.flandrescarlet) data.flandrescarlet.learnset.forbiddenbarrage = ['9L1'];
	// Wicked Energy is the move behind Kasen's Wicked Power: hers to use directly too.
	if (data.kasenibaraki) data.kasenibaraki.learnset.wickedenergy = ['9L1'];
	if (data.marisakirisame) data.marisakirisame.learnset.masterspark = ['9L1'];
	// The main cast's spell cards (the owner, 21 Oct 2026): one each, from level 1 (SIGNATURES).
	for (const [move, id] of Object.entries(SIGNATURES)) if (data[id]) data[id].learnset[move] = ['9L1'];
	// Tanned Cirno brings her own summer (Drought): a fire move for each side of her 139/139.
	if (data.cirnotanned) for (const move of ['flamethrower', 'heatwave', 'firepunch']) data.cirnotanned.learnset[move] = data.cirnotanned.learnset[move] || ['9M'];
	// Full movepools (the owner, 21 Oct 2026): the classic machines, their types' kits and
	// their own canon, as machines ('9M'). See UNIVERSAL, TYPE_TMS and THEMATIC below.
	for (const id of Object.keys(DATA.learnsets)) {
		if (!data[id]) continue;
		const learnset = data[id].learnset;
		for (const move of grantsFor(id)) if (!learnset[move]) learnset[move] = ['9M'];
	}
	// The Touhou moves stay with the characters they belong to: whoever learns them in the mod,
	// Remilia's Fate's Call, and Kasen's Wicked Energy (her Wicked Power's move).
	for (const [id, entry] of Object.entries(data)) {
		if (!entry || !entry.learnset) continue;
		for (const move of Object.keys(MOVES)) {
			if (entry.learnset[move] && !(OWNERS[move] || new Set()).has(id)) delete entry.learnset[move];
		}
	}
	return data;
};

/*
 * ------------------------------------------------------------- full movepools
 *
 * The mod gave them 26 to 89 moves each, about half a real Pokemon's, and none of the
 * machines every Pokemon knows (the owner, 21 Oct 2026: "you need to MASSIVELY increase
 * their pools to fit standard mons", "I want them to feel strong"). Three layers, every
 * one a machine ('9M', the server's form; build-buffs ships them to the builder as '9a'):
 *
 *   UNIVERSAL  the TMs nearly every Pokemon learns.
 *   TYPE_TMS   what a Pokemon of each type normally gets: status moves for every one
 *              of the type, attacks by the side it attacks from (PHYSICAL / SPECIAL).
 *   THEMATIC   each character's own canon: spell cards, abilities, what they are.
 *
 * Nothing here is anyone's signature, ours or the games' (test/touhou.test.js checks
 * every entry against velvet-signatures.js and the moves of ours that are not shared).
 * Past-generation moves (Pursuit, Hidden Power, Return) are fine: RP Touhou and the RP
 * Battle formats are National Dex, which allows them. One exception to the signature rule,
 * by the owner's own list: Confide, a universal TM in Generations 6 and 7 that
 * velvet-signatures.js files under Impidimp only because nothing else kept it in Gen 9.
 */
const UNIVERSAL = ['toxic', 'weatherball', 'hiddenpower', 'terablast', 'protect', 'substitute', 'rest', 'sleeptalk',
	'endure', 'facade', 'return', 'frustration', 'round', 'snore', 'attract', 'doubleteam', 'swagger', 'confide',
	'secretpower', 'naturalgift', 'mimic', 'hyperbeam', 'gigaimpact', 'takedown', 'helpinghand', 'bodyslam', 'curse'];

/*
 * By type. `status` goes to every Boneka of the type; `physical` to the ones that hit
 * physically, `special` to the ones that hit specially (both when they do both; see
 * sides()). The server's own shared moves for the type (Wave Charge, Undertow, Hive
 * Frenzy...) are in here too, the way buffs.js hands them to regular Pokemon.
 */
const TYPE_TMS = {
	Normal: {
		status: ['encore', 'yawn', 'wish', 'healbell', 'charm', 'workup', 'batonpass', 'disable', 'screech', 'hustleup', 'uproar'],
		physical: ['doubleedge', 'quickattack', 'headbutt', 'swordsdance', 'retaliate', 'crushclaw', 'thrash'],
		special: ['hypervoice', 'triattack', 'swift', 'echoedvoice'],
	},
	Fire: {
		status: ['willowisp', 'sunnyday'],
		physical: ['flareblitz', 'firepunch', 'firefang', 'flamecharge', 'temperflare', 'heatcrash', 'blazekick'],
		special: ['flamethrower', 'fireblast', 'heatwave', 'overheat', 'mysticalfire', 'lavaplume', 'incinerate', 'firespin', 'ember'],
	},
	Water: {
		status: ['raindance', 'aquaring', 'soak', 'lifedew', 'flipturn'],
		physical: ['waterfall', 'liquidation', 'aquajet', 'aquatail', 'dive', 'wavecharge', 'superscope3d'],
		special: ['surf', 'scald', 'hydropump', 'muddywater', 'waterpulse', 'whirlpool', 'brine', 'chillingwater', 'undertow'],
	},
	Grass: {
		status: ['leechseed', 'synthesis', 'grassyterrain', 'stunspore', 'ingrain', 'worryseed', 'trailblaze'],
		physical: ['leafblade', 'seedbomb', 'powerwhip', 'bulletseed', 'swordsdance'],
		special: ['gigadrain', 'energyball', 'solarbeam', 'leafstorm', 'magicalleaf', 'grassknot', 'petalblizzard', 'solarnectar'],
	},
	Electric: {
		status: ['thunderwave', 'electricterrain', 'charge', 'eerieimpulse', 'magnetrise', 'voltswitch'],
		physical: ['wildcharge', 'thunderpunch', 'thunderfang', 'spark', 'supercellslam', 'voltaiclance', 'sparkscamper'],
		special: ['thunderbolt', 'thunder', 'discharge', 'electroball', 'shockwave', 'chargebeam', 'electroweb'],
	},
	Ice: {
		status: ['snowscape', 'hail', 'haze', 'mist', 'auroraveil', 'chillingmist'],
		physical: ['iciclecrash', 'iciclespear', 'icepunch', 'icefang', 'iceshard', 'avalanche', 'rimecleaver'],
		special: ['icebeam', 'blizzard', 'icywind', 'frostbreath', 'powdersnow'],
	},
	Psychic: {
		status: ['calmmind', 'reflect', 'lightscreen', 'trickroom', 'trick', 'magiccoat', 'teleport', 'imprison', 'gravity',
			'psychicterrain', 'skillswap', 'allyswitch', 'magicroom', 'wonderroom', 'hypnosis', 'amnesia', 'agility', 'safeguard'],
		physical: ['zenheadbutt', 'psychocut', 'psychicfangs'],
		special: ['psychic', 'psyshock', 'psybeam', 'futuresight', 'expandingforce', 'extrasensory', 'storedpower',
			'psychicnoise', 'confusion', 'dreameater', 'hypnowhirl'],
	},
	Ghost: {
		status: ['willowisp', 'confuseray', 'spite', 'painsplit', 'nightshade', 'destinybond'],
		physical: ['shadowclaw', 'shadowsneak', 'phantomforce', 'shadowpunch', 'shadowstrike'],
		special: ['shadowball', 'hex', 'ominouswind'],
	},
	Fairy: {
		status: ['charm', 'sweetkiss', 'mistyterrain', 'babydolleyes', 'craftyshield'],
		physical: ['playrough'],
		special: ['moonblast', 'dazzlinggleam', 'drainingkiss', 'mistyexplosion', 'fairywind', 'alluringvoice', 'velvetpress'],
	},
	Flying: {
		status: ['roost', 'tailwind', 'defog', 'featherdance', 'uturn'],
		physical: ['bravebird', 'fly', 'drillpeck', 'acrobatics', 'aerialace', 'dualwingbeat', 'cloudfist'],
		special: ['airslash', 'hurricane', 'aircutter', 'gust'],
	},
	Fighting: {
		status: ['bulkup', 'detect', 'quickguard', 'coaching'],
		physical: ['closecombat', 'drainpunch', 'brickbreak', 'machpunch', 'superpower', 'lowkick', 'highjumpkick', 'bodypress',
			'rocksmash', 'lowsweep', 'reversal', 'focuspunch', 'shufflejab', 'dancingblow'],
		special: ['aurasphere', 'focusblast', 'vacuumwave'],
	},
	Ground: {
		status: ['stealthrock', 'spikes', 'sandstorm', 'sculptedarmor'],
		physical: ['earthquake', 'highhorsepower', 'bulldoze', 'dig', 'stompingtantrum', 'drillrun', 'excavate', 'dustupheaval'],
		special: ['earthpower', 'mudshot', 'scorchingsands', 'mudbomb', 'tremorshot'],
	},
	Rock: {
		status: ['stealthrock', 'sandstorm', 'rockpolish', 'wideguard'],
		physical: ['stoneedge', 'rockslide', 'rocktomb', 'rockblast', 'smackdown', 'craghammer'],
		special: ['powergem', 'ancientpower', 'meteorbeam'],
	},
	Steel: {
		status: ['irondefense', 'autotomize', 'metalsound'],
		physical: ['ironhead', 'bulletpunch', 'heavyslam', 'gyroball', 'smartstrike', 'metalclaw', 'missile'],
		special: ['flashcannon', 'steelbeam', 'mirrorshot'],
	},
	Poison: {
		status: ['toxicspikes', 'acidarmor', 'gastroacid'],
		physical: ['poisonjab', 'gunkshot', 'crosspoison', 'poisonfang'],
		special: ['sludgebomb', 'sludgewave', 'venoshock', 'acidspray', 'clearsmog', 'sludge', 'oxidize'],
	},
	Bug: {
		status: ['stringshot', 'ragepowder', 'uturn', 'chrysalisveil'],
		physical: ['xscissor', 'leechlife', 'lunge', 'megahorn', 'pounce', 'bugbite', 'hivefrenzy'],
		special: ['bugbuzz', 'signalbeam', 'strugglebug', 'pollenpuff'],
	},
	Dragon: {
		status: ['dragontail'],
		physical: ['outrage', 'dragonclaw', 'dragonrush', 'scaleshot', 'dragondance', 'breakingswipe'],
		special: ['dragonpulse', 'dracometeor', 'dragonbreath', 'twister'],
	},
	Dark: {
		// The owner's own list (Pursuit, Thief, Foul Play, Taunt, Knock Off), for all of them:
		// Foul Play hits with the target's Attack and Knock Off is utility either way.
		status: ['pursuit', 'thief', 'foulplay', 'taunt', 'knockoff', 'faketears', 'torment', 'quash', 
			'wickedenergy'],
		physical: ['crunch', 'bite', 'suckerpunch', 'throatchop', 'nightslash', 'lashout', 'payback', 'assurance', 'carrionfeast'],
		special: ['darkpulse', 'snarl', 'nastyplot'],
	},
};

/*
 * Per character: a short reason, then the moves. Signatures that are theirs already
 * (Dream Seal, Fate's Call...) come from the mod's learnsets above, not from here.
 * Strong grants are marked RISK with what to watch.
 */
const THEMATIC = {
	// Shrine maiden: barriers and wards (Fantasy Seal's Psyshock, not Mewtwo's Psystrike), the yin-yang orb.
	reimuhakurei: ['barrier', 'reflect', 'lightscreen', 'safeguard', 'magiccoat', 'psyshock', 'calmmind', 'extrasensory', 'dazzlinggleam', 'aurasphere', 'vacuumwave'],
	// Master Spark (Hyper Beam is universal), the stars of her magic, the broom, the books she "borrows".
	marisakirisame: ['dracometeor', 'meteorbeam', 'swift', 'dazzlinggleam', 'powergem', 'mysticalfire', 'energyball', 'nastyplot', 'thief', 'covet', 'acrobatics', 'bravebird'],
	// The youkai of darkness who eats people: the moonless night and its Moonlight Ray.
	rumia: ['carrionfeast', 'shadowstrike', 'twilightexit', 'swordsdance', 'shadowsneak', 'shadowclaw', 'moonlight', 'psychicfangs', 'superfang', 'haze', 'playrough'],
	// The great fairy of the misty lake: teleporting, healing, a fairy's dance.
	daiyousei: ['teleport', 'calmmind', 'quiverdance', 'wish', 'healbell', 'pollenpuff', 'energyball', 'magicalleaf', 'psychic', 'lifedew'],
	// The ice fairy (owner: Ice moves, Freeze-Dry). Perfect Freeze, the misty lake's chill.
	cirno: ['freezedry', 'iceshard', 'iciclecrash', 'tripleaxel', 'icespinner', 'auroraveil', 'frostbreath', 'chillingmist', 'rimecleaver', 'uturn', 'mist'],
	// The gatekeeper martial artist, rainbow qi, asleep on duty (owner: Belly Drum, "hi meiling").
	// RISK: Belly Drum with Mach Punch; no Extreme Speed on top, which would be Azumarill with a Dragon STAB.
	hongmeiling: ['bellydrum', 'swordsdance', 'bulkup', 'dragondance', 'machpunch', 'drainpunch', 'firepunch', 'icepunch', 'thunderpunch', 'highjumpkick', 'blazekick', 'cloudfist', 'dancingblow', 'shufflejab', 'focuspunch', 'rapidspin'],
	// The library's little devil: tricks, Prankster mischief, bat wings.
	koakuma: ['nastyplot', 'encore', 'partingshot', 'memento', 'trick', 'faketears', 'flatter', 'willowisp', 'hex', 'dazzlinggleam', 'airslash', 'psychic'],
	// The magician of five elements and sun and moon (owner: all five, special, Calm Mind).
	// Royal Flare's Overheat, Silent Selene's Moonblast. RISK: Neuroforce on full coverage.
	patchouliknowledge: ['fireblast', 'flamethrower', 'heatwave', 'overheat', 'hydropump', 'surf', 'scald', 'gigadrain', 'energyball', 'leafstorm', 'solarbeam',
		'flashcannon', 'steelbeam', 'earthpower', 'scorchingsands', 'moonblast', 'sunnyday', 'raindance', 'sandstorm', 'snowscape', 'calmmind'],
	// The maid who stops time (owner: knives, Trick Room, Steel slicers). Time stop's Extreme Speed.
	// RISK: Extreme Speed with Swords Dance.
	sakuyaizayoi: ['nightslash', 'psychocut', 'sacredsword', 'leafblade', 'smartstrike', 'aerialace', 'trickroom', 'extremespeed', 'swordsdance', 'quickattack',
		'uturn', 'knockoff', 'agility', 'quash', 'feint'],
	// The scarlet devil (the owner's example set) and her set-up ("OH MY GOD NO SETUPS?"): Nasty Plot,
	// Swords Dance, a vampire's drain, Gungnir's flight. RISK: Nasty Plot beside Fate's Call and Roost.
	remiliascarlet: ['carrionfeast', 'shadowstrike', 'twilightexit', 'hustleup', 'dancingblow', 'cloudfist', 'moonblast', 'nastyplot', 'swordsdance', 'bravebird',
		'hurricane', 'airslash', 'drainpunch', 'leechlife', 'psychicfangs', 'playrough', 'dualwingbeat'],
	// Her sister: Laevateinn's fire, destroying everything, the same vampire kit and set-up.
	// RISK: 130/135 attacks with Nasty Plot and Swords Dance both.
	flandrescarlet: ['carrionfeast', 'shadowstrike', 'twilightexit', 'hustleup', 'dancingblow', 'cloudfist', 'moonblast', 'nastyplot', 'swordsdance', 'overheat',
		'fireblast', 'flareblitz', 'flamethrower', 'heatwave', 'sacredsword', 'superpower', 'stompingtantrum', 'lashout', 'explosion', 'leechlife', 'drainpunch', 'psychicfangs'],
	// The winter youkai: the long snow, its wind and its weight.
	lettywhiterock: ['roar', 'reflect', 'lightscreen', 'mirrorcoat', 'healbell', 'surf', 'auroraveil', 'blizzard', 'wish', 'haze', 'avalanche', 'bodypress', 'frostbreath', 'chillingmist', 'calmmind', 'yawn', 'whirlwind'],
	// Ran's cat shikigami: claws, a cat's speed, her endless spinning.
	chen: ['fakeout', 'uturn', 'rapidspin', 'furyswipes', 'honeclaws', 'crushclaw', 'nightslash', 'playrough', 'knockoff', 'suckerpunch', 'acrobatics', 'shadowclaw'],
	// The puppeteer: dolls on strings, decoys, the exploding Artful Sacrifice.
	alicemargatroid: ['calmmind', 'trick', 'stringshot', 'spite', 'mistyexplosion', 'dazzlinggleam', 'flashcannon', 'magiccoat', 'teleport', 'allyswitch', 'magnetrise', 'irondefense'],
	// The fairy who heralds spring: blossoms, sun, a spring dance.
	lilywhite: ['grassyterrain', 'synthesis', 'sunnyday', 'petalblizzard', 'petaldance', 'sweetscent', 'quiverdance', 'pollenpuff', 'healbell', 'wish', 'solarnectar'],
	// The Prismriver sisters, poltergeist musicians. Lunasa's violin is the gloomy one.
	lunasaprismriver: ['echoedvoice', 'alluringvoice', 'icywind', 'haze', 'torment', 'calmmind', 'hypervoice', 'sing', 'perishsong', 'painsplit', 'willowisp', 'psychic', 'psychicnoise', 'disarmingvoice', 'snarl'],
	// Merlin's trumpet is the manic one.
	merlinprismriver: ['echoedvoice', 'alluringvoice', 'disarmingvoice', 'psychicnoise', 'dazzlinggleam', 'teeterdance', 'nastyplot', 'hypervoice', 'boomburst', 'uproar', 'sing', 'willowisp', 'metronome', 'trick', 'encore'],
	// Lyrica's keyboard plays the illusory sounds.
	lyricaprismriver: ['alluringvoice', 'disarmingvoice', 'dazzlinggleam', 'uproar', 'calmmind', 'hypervoice', 'sing', 'teeterdance', 'psychicnoise', 'echoedvoice', 'nastyplot', 'encore', 'trick', 'fakeout'],
	// The half-phantom gardener and her two swords (owner: slicing moves, Swords Dance). RISK: Extreme Speed on 130 Speed.
	youmukonpaku: ['swordsdance', 'sacredsword', 'leafblade', 'nightslash', 'psychocut', 'xscissor', 'aerialace', 'shadowsneak', 'shadowclaw', 'phantomforce',
		'extremespeed', 'agility', 'uturn', 'shadowstrike', 'silverdagger', 'furycutter'],
	// The ghost princess who invites death (owner: Destiny Bond, Perish Song), cherry blossoms, endless appetite.
	yuyukosaigyouji: ['destinybond', 'perishsong', 'meanlook', 'willowisp', 'calmmind', 'strengthsap', 'petalblizzard', 'stockpile', 'swallow', 'spitup', 'belch',
		'stuffcheeks', 'recycle', 'carrionfeast', 'grudge'],
	// Yukari's nine-tailed fox shikigami, the calculator: foxfire and a fox's speed.
	ranyakumo: ['nastyplot', 'flamethrower', 'fireblast', 'willowisp', 'mysticalfire', 'extrasensory', 'futuresight', 'uturn', 'swordsdance', 'firepunch', 'tailslap', 'agility'],
	// The gap youkai: boundaries, rooms that change the rules, Twilight's exit. RISK: Nasty Plot on a 600 legend.
	yukariyakumo: ['nastyplot', 'trickroom', 'wonderroom', 'magicroom', 'gravity', 'teleport', 'allyswitch', 'twilightexit', 'partingshot', 'trick', 'barrier', 'storedpower'],
	// The oni of the gourd: strength, density and mist, boulders thrown.
	suikaibuki: ['bulkup', 'drainpunch', 'firepunch', 'icepunch', 'thunderpunch', 'cloudfist', 'dancingblow', 'stoneedge', 'rockslide', 'heavyslam', 'mist', 'haze', 'growth', 'focusblast'],
	// The firefly youkai: insect swarms and her light. RISK: Quiver Dance on mixed 115/107.
	wrigglenightbug: ['quiverdance', 'hivefrenzy', 'chrysalisveil', 'firstimpression', 'lunge', 'pollenpuff', 'dazzlinggleam', 'signalbeam', 'swordsdance', 'megahorn', 'skittersmack'],
	// The night sparrow: songs that blind at night.
	mystialorelei: ['sing', 'hypervoice', 'alluringvoice', 'nastyplot', 'roost', 'hurricane', 'tailwind', 'featherdance', 'snarl', 'torment'],
	// The history teacher, a were-hakutaku: her headbutts, her horns, history hidden and remembered.
	keine: ['headsmash', 'zenheadbutt', 'headbutt', 'megahorn', 'hornattack', 'amnesia', 'calmmind', 'futuresight', 'extrasensory', 'imprison', 'bodypress', 'irondefense'],
	// The lucky rabbit trickster. Huge Power, so she hits physically too.
	tewiinaba: ['quickattack', 'highjumpkick', 'bounce', 'dig', 'doublekick', 'playrough', 'knockoff', 'thief', 'trick', 'encore', 'partingshot', 'charm', 'fakeout', 'superfang'],
	// The lunar rabbit: Lunatic Red Eyes' madness, her gun and the bullets of light.
	reiseninaba: ['nastyplot', 'hypnosis', 'confuseray', 'psybeam', 'psychicnoise', 'voltswitch', 'uturn', 'aurasphere', 'vacuumwave', 'lockon', 'zapcannon', 'electroweb', 'teleport'],
	// The lunar genius pharmacist and archer: medicine and the moon. RISK: Recover and Calm Mind on 200 Sp. Def.
	eirinyagokoro: ['recover', 'healpulse', 'healbell', 'refresh', 'wish', 'calmmind', 'storedpower', 'futuresight', 'moonblast', 'acupressure', 'magicroom', 'trickroom'],
	// The moon princess and her five impossible requests: the jeweled branch, the fire-rat robe,
	// the dragon's jewel, the swallow's shell. Moonlight, with Magic Guard (Clefable's set).
	kaguyahouraisan: ['moonblast', 'moonlight', 'dragonpulse', 'powergem', 'flamethrower', 'airslash', 'calmmind', 'meteorbeam', 'psychic', 'earthpower'],
	// The immortal phoenix: Rising Phoenix, burning herself and rising again.
	fujiwaranomokou: ['flareblitz', 'blazekick', 'firepunch', 'bravebird', 'roost', 'bulkup', 'flamecharge', 'overheat', 'reversal', 'memento', 'explosion', 'temperflare'],
	// The crow tengu reporter, fastest in Gensokyo (owner: Brave Bird, Hurricane, Tailwind); her fan, her camera's flash.
	// RISK: Extreme Speed and Swords Dance on 170 Speed.
	ayashameimaru: ['bravebird', 'hurricane', 'tailwind', 'extremespeed', 'uturn', 'defog', 'roost', 'acrobatics', 'agility', 'swordsdance', 'heatwave', 'whirlwind', 'quickattack', 'twister'],
	// The poison doll among the lilies of the valley.
	medicinemelancholy: ['calmmind', 'painsplit', 'leechseed', 'toxicspikes', 'gastroacid', 'acidarmor', 'poisonpowder', 'stunspore', 'synthesis', 'gigadrain', 'energyball', 'oxidize', 'hex', 'clearsmog'],
	// The flower master, strongest of youkai, whose Master Spark Marisa copied (Hyper Beam is universal).
	yuukakazami: ['frenzyplant', 'solarblade', 'solarbeam', 'leafstorm', 'petalblizzard', 'petaldance', 'woodhammer', 'powerwhip', 'growth', 'swordsdance', 'trickroom',
		'ingrain', 'drainpunch', 'solarnectar'],
	// The lazy shinigami ferrywoman: her scythe, the Sanzu's water, distance manipulation.
	komachionozuka: ['slackoff', 'yawn', 'nightslash', 'psychocut', 'xscissor', 'razorshell', 'aquacutter', 'sacredsword', 'swordsdance', 'phantomforce', 'shadowsneak', 'destinybond', 'shadowstrike'],
	// The Yama: the Rod of Remorse, the Mirror of Judgment, black and white, her long sermons.
	eikishiki: ['calmmind', 'psychic', 'psyshock', 'mirrorcoat', 'flashcannon', 'punishment', 'quash', 'torment', 'imprison', 'darkpulse', 'dazzlinggleam', 'hypervoice', 'focusblast', 'aurasphere'],
	// The goddess of autumn leaves. RISK: Tailwind sets off her own Wind Rider (+1 Attack).
	shizuhaaki: ['leaftornado', 'leafblade', 'leafstorm', 'magicalleaf', 'razorleaf', 'petalblizzard', 'tailwind', 'aircutter', 'hurricane', 'swordsdance', 'uturn', 'solarblade'],
	// The goddess of the harvest: crops, sweet potatoes, a good table.
	minorikoaki: ['synthesis', 'rototiller', 'growth', 'ingrain', 'leechseed', 'stuffcheeks', 'recycle', 'seedbomb', 'earthpower', 'gigadrain'],
	// The goddess of misfortune, who spins to gather it.
	hinakagiyama: ['rapidspin', 'teeterdance', 'grudge', 'spite', 'hex', 'memento', 'nastyplot', 'toxicspikes', 'clearsmog', 'haze', 'gyroball'],
	// The kappa engineer (owner: water and tech): gadgets, optical camouflage, Kappa's Pororoca.
	nitorikawashiro: ['hydropump', 'waterspout', 'scald', 'flashcannon', 'steelbeam', 'thunderbolt', 'voltswitch', 'electroball', 'magnetrise', 'trick', 'autotomize', 'zapcannon', 'lockon', 'flipturn', 'raindance', 'icebeam'],
	// The white wolf tengu on guard (owner: dog moves): fangs, howls, sword and shield. RISK: Strong Jaw fangs with Extreme Speed.
	momijiinubashiri: ['crunch', 'firefang', 'icefang', 'thunderfang', 'psychicfangs', 'howl', 'roar', 'extremespeed', 'sacredsword', 'swordsdance', 'bulkup', 'bodypress',
		'irondefense', 'wideguard', 'quickguard', 'retaliate', 'nightslash'],
	// The wind priestess of miracles: Serene Grace's flinches and the Moriya's rain.
	sanaekochiya: ['hurricane', 'thunder', 'thunderbolt', 'icebeam', 'calmmind', 'wish', 'healbell', 'miracleeye', 'tailwind', 'psychic', 'dazzlinggleam', 'swift', 'meteorbeam', 'gust', 'aircutter'],
	// The goddess of wind and war: the onbashira pillars and the serpent.
	kanakoyasaka: ['woodhammer', 'heavyslam', 'coil', 'glare', 'swordsdance', 'bravebird', 'tailwind', 'roost', 'defog', 'stoneedge', 'rockslide', 'crunch', 'superpower'],
	// The frog goddess and the Mishaguji's curses, her iron rings.
	suwakomoriya: ['hypnosis', 'bounce', 'muddywater', 'mudshot', 'scald', 'earthpower', 'hydropump', 'calmmind', 'hex', 'grudge', 'sludgebomb', 'flashcannon', 'stealthrock', 'spikes'],
	// The oarfish envoy of the dragon palace: storm clouds and lightning. RISK: Dragon Dance with Multiscale.
	ikunagae: ['dragondance', 'calmmind', 'raindance', 'surf', 'hydropump', 'waterfall', 'aquatail', 'hurricane', 'thunder', 'dracometeor', 'twister', 'dragontail', 'wildcharge', 'thunderpunch'],
	// The celestial with the Sword of Hisou, earthquakes and keystones, who wants to be hit.
	tenshihinanawi: ['sacredsword', 'swordsdance', 'counter', 'metalburst', 'reversal', 'bodypress', 'irondefense', 'craghammer', 'sculptedarmor', 'headsmash', 'highhorsepower', 'stealthrock', 'rockpolish'],
	// The well-bucket youkai who drops on heads; her onibi. Shell Smash: the bucket is a shell.
	kisume: ['headsmash', 'heavyslam', 'smackdown', 'withdraw', 'shellsmash', 'willowisp', 'gyroball', 'rollout', 'bodypress', 'stealthrock'],
	// The earth spider who spreads disease.
	yamamekurodani: ['stickyweb', 'stringshot', 'lunge', 'firstimpression', 'leechlife', 'poisonjab', 'gunkshot', 'xscissor', 'uturn', 'swordsdance', 'toxicspikes', 'infestation', 'earthquake', 'spiderweb'],
	// The bridge princess, the green-eyed monster.
	parseemizuhashi: ['torment', 'grudge', 'spite', 'hex', 'willowisp', 'nastyplot', 'psychup', 'faketears', 'lashout', 'shadowball', 'calmmind'],
	// The oni of strength and her Three Steps of Certain Kill.
	yuugihoshiguma: ['hammerarm', 'dynamicpunch', 'focuspunch', 'drainpunch', 'superpower', 'firepunch', 'icepunch', 'thunderpunch', 'cloudfist', 'shufflejab', 'craghammer', 'earthquake', 'bulkup', 'headsmash', 'stealthrock'],
	// The mind reader and her third eye.
	satorikomeiji: ['mindreader', 'mefirst', 'copycat', 'psychup', 'hypnosis', 'dreameater', 'nightmare', 'imprison', 'skillswap', 'mirrorcoat', 'counter', 'nastyplot', 'trick', 'powersplit', 'guardsplit'],
	// The kasha cat who steals corpses, with her zombie fairies.
	rinkaenbyou: ['willowisp', 'hex', 'overheat', 'mysticalfire', 'nastyplot', 'uturn', 'fakeout', 'partingshot', 'destinybond', 'nightshade', 'flamecharge', 'acrobatics'],
	// The hell raven with the sun inside her (owner: nuclear moves, but no Blue Flare or Fusion Flare):
	// Overheat, Flare Blitz, the meltdown's Explosion, the control rod's Steel Beam, Giga Flare's Meteor Beam.
	// RISK: 680 base stats; no set-up at all, and Klutz keeps her off the Choice items.
	utsuhoreiuji: ['overheat', 'flareblitz', 'fireblast', 'heatwave', 'sunnyday', 'solarbeam', 'explosion', 'steelbeam', 'flashcannon', 'meteorbeam', 'bravebird'],
	// The closed eye, the unconscious: roses, unnoticed approach. RISK: Calm Mind and Stored Power with Unaware on 157 Sp. Def.
	koishikomeiji: ['hypnosis', 'teeterdance', 'confuseray', 'petalblizzard', 'magicalleaf', 'calmmind', 'storedpower', 'wish', 'boomburst', 'hypervoice', 'encore', 'trick', 'spite', 'imprison'],
	// The mouse dowser of Bishamonten: treasure-finding.
	nazrin: ['superfang', 'nuzzle', 'quickattack', 'uturn', 'thief', 'covet', 'knockoff', 'crunch', 'powergem', 'swordsdance', 'agility', 'foresight', 'mindreader', 'dig', 'rapidspin'],
	// The karakasa umbrella who wants to surprise, and the blacksmith she is.
	kogasatatara: ['fakeout', 'astonish', 'lick', 'scaryface', 'suckerpunch', 'aquajet', 'liquidation', 'playrough', 'ironhead', 'bulletpunch', 'heavyslam', 'smartstrike', 'bounce', 'raindance', 'swordsdance'],
	// The nun and Unzan, the cloud nyuudou who throws her punches.
	ichirinkumoi: ['machpunch', 'drainpunch', 'dynamicpunch', 'focuspunch', 'hammerarm', 'firepunch', 'icepunch', 'thunderpunch', 'shadowpunch', 'bulkup', 'skyuppercut', 'megapunch', 'mist', 'haze'],
	// The ghost captain who sinks ships with her anchor.
	minamitsumurasa: ['wavecrash', 'liquidation', 'aquajet', 'dive', 'whirlpool', 'phantomforce', 'shadowsneak', 'heavyslam', 'ironhead', 'swordsdance', 'destinybond', 'soak', 'shadowstrike'],
	// Bishamonten's avatar: the tiger and the jeweled pagoda's light.
	shoutoramaru: ['thunderfang', 'firefang', 'icefang', 'crunch', 'wildcharge', 'playrough', 'powergem', 'calmmind', 'bulkup', 'roar', 'sacredsword'],
	// The magician monk whose magic strengthens the body. RISK: Extreme Speed beside Bulk Up and Calm Mind.
	byakurenhijiri: ['bulkup', 'calmmind', 'agility', 'highjumpkick', 'drainpunch', 'machpunch', 'zenheadbutt', 'aurasphere', 'vacuumwave', 'extremespeed', 'meditate', 'healbell', 'dazzlinggleam', 'dancingblow'],
	// The unidentifiable nue, a thunder-beast, with her UFOs.
	nuehoujuu: ['nastyplot', 'thunderbolt', 'thunder', 'confuseray', 'trick', 'partingshot', 'spite', 'imprison', 'disable'],
	// The crow tengu who photographs from afar.
	hatatehimekaidou: ['airslash', 'hurricane', 'tailwind', 'roost', 'uturn', 'defog', 'nastyplot', 'foresight', 'mindreader', 'heatwave', 'gust', 'aircutter', 'extrasensory'],
	// The three light fairies. Sunny Milk bends sunlight.
	sunnymilk: ['solarblade', 'sunnyday', 'morningsun', 'flareblitz', 'firepunch', 'flamecharge', 'playrough', 'uturn', 'thief', 'swordsdance', 'temperflare'],
	// Luna Child silences sound under moonlight.
	lunachild: ['moonblast', 'moonlight', 'calmmind', 'snarl', 'disable', 'torment', 'yawn', 'teleport', 'foulplay'],
	// Star Sapphire senses every living thing by starlight. Pixilate's Hyper Voice, as Sylveon's.
	starsapphire: ['hypervoice', 'swift', 'triattack', 'meteorbeam', 'cosmicpower', 'storedpower', 'calmmind', 'foresight', 'miracleeye', 'futuresight'],
	// The yamabiko punk singer: every echo, and what she throws back.
	kyoukokasodani: ['boomburst', 'hypervoice', 'echoedvoice', 'uproar', 'screech', 'snarl', 'supersonic', 'nobleroar', 'sing', 'mirrorcoat', 'mirrormove', 'copycat', 'alluringvoice', 'disarmingvoice'],
	// The jiang-shi, stiff and always hungry.
	yoshikamiyako: ['carrionfeast', 'stockpile', 'swallow', 'belch', 'stuffcheeks', 'poisonjab', 'gunkshot', 'poisonfang', 'crunch', 'shadowclaw', 'shadowsneak', 'painsplit', 'bounce', 'irondefense', 'bulkup', 'drainpunch'],
	// The wicked hermit who walks through walls and raises the dead.
	seigakaku: ['nastyplot', 'shadowball', 'hex', 'sludgebomb', 'trick', 'partingshot', 'hypnosis', 'dreameater', 'nightshade', 'focusblast', 'psychic', 'teleport', 'faketears'],
	// The vengeful ghost of the Soga clan, a thunderstorm.
	soganotojiko: ['nastyplot', 'thunder', 'thunderbolt', 'discharge', 'hex', 'willowisp', 'grudge', 'destinybond', 'raindance', 'electroweb', 'zapcannon', 'hurricane'],
	// The Taoist who sets temples alight, rides boats and reads feng shui.
	mononobenofuto: ['flamethrower', 'fireblast', 'overheat', 'scald', 'hydropump', 'flareblitz', 'liquidation', 'willowisp', 'calmmind', 'earthpower', 'psychic', 'sunnyday', 'raindance', 'aquajet', 'flamecharge'],
	// The saint who hears ten voices at once: her sword, her mantle's light.
	// RISK: 585 base stats, mixed, with Nasty Plot and Swords Dance both.
	toyosatomiminomiko: ['calmmind', 'nastyplot', 'swordsdance', 'sacredsword', 'aurasphere', 'vacuumwave', 'focusblast', 'psychic', 'psyshock', 'flashcannon', 'mindreader', 'foresight', 'meteorbeam', 'healbell', 'drainpunch'],
	// The bake-danuki of Sado: a tanuki's belly drum, transformation tricks. RISK: Belly Drum with Sucker Punch (but 50 Speed).
	mamizoufutatsuiwa: ['bellydrum', 'fakeout', 'leafblade', 'seedbomb', 'woodhammer', 'doubleedge', 'suckerpunch', 'knockoff', 'uturn', 'swordsdance', 'trick', 'copycat', 'leechseed', 'synthesis'],
	// The one-armed hermit: an oni's arm, a hundred medicines, her eagle.
	kasenibaraki: ['drainpunch', 'bulkup', 'swordsdance', 'hornleech', 'woodhammer', 'machpunch', 'hammerarm', 'icepunch', 'thunderpunch', 'firepunch', 'powerwhip', 'synthesis', 'bravebird', 'cloudfist'],
	// The menreiki of sixty-six masks, one per emotion, and her naginata. RISK: Libero makes all of it STAB.
	hatanokokoro: ['charm', 'scaryface', 'faketears', 'tickle', 'flatter', 'torment', 'psychocut', 'nightslash', 'sacredsword', 'swordsdance', 'calmmind', 'teeterdance', 'shadowsneak', 'lashout'],
	// The mermaid of the lake, who sings.
	wakasagihime: ['sing', 'alluringvoice', 'aquaring', 'lifedew', 'wavecrash', 'liquidation', 'aquajet', 'flipturn', 'dive', 'whirlpool', 'icebeam', 'undertow', 'wavecharge', 'swordsdance', 'dragondance'],
	// The rokurokubi whose flying heads fire lasers.
	sekibanki: ['flashcannon', 'powergem', 'hypervoice', 'snarl', 'spite', 'nastyplot', 'hex', 'willowisp', 'confuseray', 'scaryface', 'psybeam', 'darkpulse', 'chargebeam', 'signalbeam', 'dazzlinggleam', 'partingshot', 'teleport', 'ominouswind'],
	// The shy werewolf. RISK: Strong Jaw fangs, Swords Dance and a Normal-STAB Extreme Speed.
	kagerouimaizumi: ['crunch', 'firefang', 'icefang', 'thunderfang', 'psychicfangs', 'howl', 'roar', 'moonlight', 'honeclaws', 'crushclaw', 'nightslash', 'shadowclaw', 'quickattack',
		'extremespeed', 'swordsdance', 'jawlock', 'uturn'],
	// The tsukumogami sisters. Benben's biwa (Minus).
	benbentsukumo: ['hypervoice', 'echoedvoice', 'sing', 'uproar', 'voltswitch', 'thunder', 'discharge', 'nastyplot', 'magneticflux', 'electroweb', 'alluringvoice', 'charge', 'eerieimpulse'],
	// Yatsuhashi's koto (Plus).
	yatsuhashitsukumo: ['hypervoice', 'echoedvoice', 'sing', 'uproar', 'voltswitch', 'thunder', 'discharge', 'nastyplot', 'magneticflux', 'electroweb', 'alluringvoice', 'charge', 'eerieimpulse'],
	// The amanojaku who turns everything upside down: Contrary's reversed drops.
	// RISK: Contrary turns Superpower, Close Combat and Hammer Arm into boosts.
	seijakijin: ['superpower', 'closecombat', 'hammerarm', 'switcheroo', 'reversal', 'counter', 'mirrorcoat', 'skillswap', 'knockoff', 'uturn'],
	// The inchling: her needle sword and the Miracle Mallet that grants wishes and growth.
	shinmyoumarusukuna: ['pinmissile', 'smartstrike', 'sacredsword', 'furycutter', 'woodhammer', 'hammerarm', 'heavyslam', 'growth', 'swordsdance', 'wish', 'endeavor', 'metalburst', 'reversal', 'counter', 'silverdagger'],
	// The taiko drum tsukumogami: thunder, rhythm, the drum's roar.
	raikohorikawa: ['thunder', 'thunderpunch', 'wildcharge', 'supercellslam', 'boomburst', 'hypervoice', 'uproar', 'echoedvoice', 'electricterrain', 'charge', 'bulkup', 'nastyplot'],
	// The outside-world psychic: telekinesis, Zener cards, the urban legends' occult balls, her phone.
	sumirekousami: ['nastyplot', 'calmmind', 'telekinesis', 'gravity', 'trick', 'teleport', 'shadowball', 'focusblast', 'chargebeam', 'thunderbolt', 'powergem', 'magicroom', 'psychicnoise'],
	// The lunar rabbit soldier: her gun, her mochi mallet. RISK: Sniper with Focus Energy.
	seiran: ['lockon', 'focusenergy', 'flashcannon', 'aurasphere', 'vacuumwave', 'psybeam', 'heavyslam', 'ironhead', 'bulletpunch', 'quickattack', 'highjumpkick', 'uturn', 'agility', 'zenheadbutt'],
	// The lunar rabbit dango seller (Cheek Pouch).
	ringo: ['stuffcheeks', 'belch', 'recycle', 'stockpile', 'swallow', 'bulletseed', 'seedbomb', 'powerwhip', 'uturn', 'quickattack', 'highjumpkick', 'swordsdance', 'knockoff', 'bounce'],
	// The baku who eats dreams.
	doremysweet: ['dreameater', 'hypnosis', 'nightmare', 'yawn', 'calmmind', 'moonlight', 'shadowball', 'hex', 'nightshade', 'moonblast', 'storedpower'],
	// The Lunarian goddess whose words reverse fate. RISK: Contrary Leaf Storm and Overheat.
	sagumekishin: ['skillswap', 'leafstorm', 'overheat', 'hurricane', 'roost', 'defog', 'tailwind', 'moonblast', 'psychic', 'futuresight'],
	// The hell fairy and her torch of lunacy; the stars and stripes.
	clownpiece: ['flamethrower', 'fireblast', 'lavaplume', 'willowisp', 'mysticalfire', 'confuseray', 'teeterdance', 'flatter', 'encore', 'wish', 'swift', 'meteorbeam', 'nastyplot', 'fakeout', 'uturn'],
	// Pure fury: a divine spirit of vengeance. RISK: 600 base stats with Extreme Speed, Swords Dance,
	// Nasty Plot and Boomburst, and Mold Breaker.
	junko: ['boomburst', 'hypervoice', 'extremespeed', 'swordsdance', 'nastyplot', 'thrash', 'outrage', 'lashout', 'stompingtantrum', 'doubleedge', 'shadowball', 'darkpulse',
		'moonblast', 'flamethrower', 'icebeam', 'thunderbolt', 'earthquake', 'grudge', 'destinybond', 'taunt', 'spite'],
	// The goddess of hell with a body on each world: hell's fire, the Earth's and the Moon's moves.
	hecatia: ['nastyplot', 'calmmind', 'willowisp', 'painsplit', 'destinybond', 'meanlook', 'trickroom', 'moonblast', 'earthpower', 'gigadrain', 'scald', 'dracometeor', 'flamethrower',
		'fireblast', 'psychic', 'meteorbeam', 'partingshot'],
	// The pestilence goddess who spends: jewellery, fashion, other people's things.
	joonyorigami: ['nastyplot', 'powergem', 'dazzlinggleam', 'trick', 'switcheroo', 'fling', 'thief', 'covet', 'recycle', 'charm', 'flatter', 'steelbeam', 'sludgewave', 'oxidize'],
	// Her sister, the goddess of poverty: misfortune and loss.
	shionyorigami: ['spite', 'grudge', 'destinybond', 'memento', 'hex', 'painsplit', 'trick', 'gastroacid', 'torment', 'nastyplot', 'willowisp', 'nightshade', 'clearsmog', 'toxicspikes'],
	// The swallowtail butterfly fairy. RISK: Quiver Dance on 138 Sp. Atk with Regenerator.
	eternitylarva: ['quiverdance', 'bugbuzz', 'pollenpuff', 'stunspore', 'silverwind', 'gigadrain', 'energyball', 'solarbeam', 'sunnyday', 'hurricane', 'roost', 'tailwind', 'uturn', 'dazzlinggleam', 'growth'],
	// The mountain hag and her cleaver (Cut Deep).
	nemunosakata: ['nightslash', 'psychocut', 'leafblade', 'xscissor', 'sacredsword', 'silverdagger', 'swordsdance', 'stoneedge', 'stealthrock', 'spikes', 'woodhammer', 'synthesis', 'rockpolish', 'scaryface', 'roar'],
	// The komainu guardian: a lion-dog's fangs and a shrine guard's shields. RISK: Rock Head Head Smash.
	aunnkomano: ['crunch', 'firefang', 'icefang', 'thunderfang', 'psychicfangs', 'howl', 'roar', 'playrough', 'wideguard', 'quickguard', 'followme', 'bodypress', 'irondefense', 'headsmash', 'doubleedge', 'swordsdance'],
	// The jizo statue of the Forest of Magic, guarding the living and the dead.
	narumiyatadera: ['powergem', 'meteorbeam', 'earthpower', 'frostbreath', 'calmmind', 'stealthrock', 'irondefense', 'wish', 'healbell', 'energyball', 'shadowball', 'auroraveil', 'sandstorm', 'snowscape'],
	// Okina's backup dancers, with their bamboo. Mai: every dance there is.
	maiteireida: ['swordsdance', 'dragondance', 'featherdance', 'teeterdance', 'petaldance', 'leafblade', 'bulletseed', 'tripleaxel', 'highjumpkick', 'fakeout', 'uturn', 'afteryou', 'followme', 'cloudfist'],
	// Satono, her twin, with the ginger.
	satononishida: ['swordsdance', 'dragondance', 'featherdance', 'teeterdance', 'petaldance', 'leafblade', 'bulletseed', 'tripleaxel', 'highjumpkick', 'fakeout', 'uturn', 'afteryou', 'followme', 'shufflejab'],
	// The secret god of back doors and the four seasons (her formes): each season's weather and moves.
	// RISK: a 580 legend with Nasty Plot and Swords Dance.
	okinamatara: ['nastyplot', 'swordsdance', 'uturn', 'partingshot', 'twilightexit', 'teleport', 'sunnyday', 'raindance', 'sandstorm', 'snowscape', 'hydropump', 'scald', 'fireblast',
		'flamethrower', 'powergem', 'stoneedge', 'icebeam', 'blizzard', 'iciclecrash', 'solarbeam'],
	// The child spirit stacking stones by the Sanzu, and its water.
	eikaebisu: ['stealthrock', 'spikes', 'irondefense', 'bodypress', 'powergem', 'meteorbeam', 'hex', 'willowisp', 'painsplit', 'calmmind', 'sandstorm', 'followme', 'lifedew', 'surf', 'scald'],
	// The ushi-oni, a cow, with her ever-heavier stone baby.
	urumiushizaki: ['highhorsepower', 'headsmash', 'megahorn', 'heavyslam', 'gravity', 'stoneedge', 'rockslide', 'liquidation', 'wavecrash', 'aquatail', 'stealthrock', 'bulkup', 'smackdown'],
	// The niwatari god, a chicken guarding the checkpoint. RISK: Simple doubles Calm Mind (no Nasty Plot here).
	kutakaniwatari: ['calmmind', 'roost', 'featherdance', 'hurricane', 'tailwind', 'defog', 'scald', 'hydropump', 'icebeam', 'uturn', 'bravebird', 'dualwingbeat', 'mirrormove', 'quickguard', 'wideguard'],
	// The jidiao turtle-dragon boss of the Kiketsu family, all intimidation. No Shell Smash: Beast Boost.
	yachiekicchou: ['withdraw', 'irondefense', 'bodypress', 'dragontail', 'dracometeor', 'knockoff', 'taunt', 'torment', 'partingshot', 'nobleroar', 'scaryface', 'snarl', 'trickroom', 'aquatail', 'waterpulse'],
	// The haniwa soldier who follows Keiki's orders.
	mayumijoutouguu: ['irondefense', 'swordsdance', 'bulkup', 'sacredsword', 'smartstrike', 'ironhead', 'heavyslam', 'highhorsepower', 'bodypress', 'stealthrock', 'wideguard', 'quickguard', 'sculptedarmor', 'gyroball'],
	// The goddess of creation who sculpts the haniwa: clay reshaped, and her own Electric Surge.
	// RISK: Shore Up and Calm Mind on a 572 legend with Rising Voltage in her own terrain.
	keikihaniyasushin: ['shoreup', 'calmmind', 'earthpower', 'voltswitch', 'stealthrock', 'meteorbeam', 'powergem', 'flashcannon', 'sandstorm', 'electricterrain', 'wildcharge',
		'highhorsepower', 'thunderpunch', 'irondefense'],
	// The black pegasus boss of the Keiga family and her kicks. RISK: No Guard Dynamic Punch, Mega Kick and Stone Edge.
	sakikurokuma: ['highjumpkick', 'blazekick', 'axekick', 'megakick', 'doublekick', 'dynamicpunch', 'highhorsepower', 'stomp', 'bounce', 'bravebird', 'dualwingbeat', 'roost', 'swordsdance', 'bulkup', 'stoneedge'],
	// The taotie boss of the Gouyoku alliance, who devours everything.
	yuumatoutetsu: ['carrionfeast', 'stockpile', 'swallow', 'spitup', 'belch', 'stuffcheeks', 'jawlock', 'suckerpunch', 'wavecrash', 'liquidation', 'bulkup', 'swordsdance', 'whirlpool', 'thief'],
	// The maneki-neko who beckons customers and money.
	mikegotoukuji: ['followme', 'fakeout', 'uturn', 'nastyplot', 'flashcannon', 'powergem', 'charm', 'covet', 'encore', 'furyswipes', 'slash', 'playrough'],
	// The mountain kappa broker of the forest (Pickpocket).
	takaneyamashiro: ['leechseed', 'synthesis', 'gigadrain', 'energyball', 'scald', 'surf', 'raindance', 'spikes', 'trick', 'switcheroo', 'flipturn', 'grassknot', 'aquaring', 'lifedew', 'calmmind'],
	// The mountain hag who sells tobacco: her smoke.
	sannyokomakusa: ['smokescreen', 'haze', 'clearsmog', 'smog', 'willowisp', 'lavaplume', 'flamethrower', 'dragonpulse', 'calmmind', 'mysticalfire', 'dragontail', 'incinerate', 'heatwave'],
	// The goddess who makes the magatama and the yin-yang orbs.
	misumarutamatsukuri: ['magiccoat', 'storedpower', 'cosmicpower', 'irondefense', 'gravity', 'trickroom', 'powergem', 'meteorbeam', 'ancientpower', 'rockpolish', 'calmmind', 'stealthrock', 'psychic', 'psyshock', 'dazzlinggleam', 'earthpower', 'flashcannon', 'reflect', 'lightscreen', 'sandstorm'],
	// The kuda-gitsune pipe fox, a whispering manipulator (Prankster).
	tsukasakudamaki: ['partingshot', 'taunt', 'encore', 'torment', 'flatter', 'faketears', 'trick', 'willowisp', 'hex', 'nastyplot', 'sweetkiss', 'disable', 'memento', 'foulplay', 'hypervoice'],
	// The great tengu chief, and her starlight.
	megumuiizunamaru: ['meteorbeam', 'swift', 'airslash', 'hurricane', 'calmmind', 'roost', 'tailwind', 'defog', 'bravebird', 'skyattack', 'extrasensory', 'dazzlinggleam', 'powergem', 'agility', 'futuresight'],
	// The goddess of the market and of ownerlessness, of the rainbow.
	chimatatenkyuu: ['trick', 'switcheroo', 'bestow', 'fling', 'recycle', 'aurorabeam', 'dazzlinggleam', 'calmmind', 'roost', 'tailwind', 'defog', 'powergem', 'hurricane'],
	// The great centipede who mines and eats dragons. RISK: Speed Boost with Swords Dance and Coil.
	momoyohimemushi: ['firstimpression', 'lunge', 'megahorn', 'xscissor', 'uturn', 'pounce', 'stoneedge', 'stealthrock', 'spikes', 'drillrun', 'dig', 'poisonjab', 'poisonfang', 'crunch', 'dragonclaw', 'coil', 'swordsdance'],
	// The monkey and her extending staff. RISK: Magic Guard with Nasty Plot.
	sonbiten: ['nastyplot', 'focusblast', 'aurasphere', 'vacuumwave', 'uturn', 'fakeout', 'knockoff', 'encore', 'taunt', 'screech', 'tickle', 'energyball', 'grassknot', 'rapidspin', 'psychic'],
	// The hunting wolf pack's leader (Strong Jaw).
	enokomitsugashira: ['howl', 'roar', 'crunch', 'jawlock', 'psychicfangs', 'firefang', 'icefang', 'thunderfang', 'swordsdance', 'suckerpunch', 'knockoff', 'bulletpunch', 'uturn', 'quickattack', 'nobleroar'],
	// The blood pool's bloodsucker.
	chiyaritenkajin: ['leechlife', 'drainpunch', 'flareblitz', 'firefang', 'firepunch', 'temperflare', 'shadowclaw', 'shadowsneak', 'willowisp', 'painsplit', 'swordsdance', 'flamecharge', 'carrionfeast', 'shadowstrike'],
	// The yomotsu-shikome, Zanmu's devoted hag of the underworld.
	hisamiyomotsu: ['willowisp', 'hex', 'gigadrain', 'leechseed', 'spikes', 'toxicspikes', 'painsplit', 'meanlook', 'spite', 'synthesis', 'ingrain', 'sludgebomb', 'energyball', 'strengthsap', 'knockoff'],
	// The oni of nothingness who runs Hell. RISK: a 600 legend, mixed, with Nasty Plot and Swords Dance.
	zanmunippaku: ['nastyplot', 'swordsdance', 'knockoff', 'suckerpunch', 'partingshot', 'haze', 'clearsmog', 'shadowball', 'shadowclaw', 'phantomforce', 'willowisp', 'destinybond', 'focusblast',
		'closecombat', 'earthquake', 'icebeam', 'thunderbolt', 'twilightexit'],
	// The robot maid (Cactus Drive): machinery, missiles, tea.
	vivit: ['autotomize', 'magnetrise', 'voltswitch', 'thunderbolt', 'flashcannon', 'steelbeam', 'zapcannon', 'lockon', 'thunderpunch', 'wildcharge', 'bulletpunch', 'ironhead', 'gyroball', 'supercellslam',
		'rapidspin', 'agility'],
	// The earth's sand and stone (Sand Force).
	ubamechirizuka: ['highhorsepower', 'stoneedge', 'rockslide', 'sandstorm', 'stealthrock', 'spikes', 'swordsdance', 'knockoff', 'suckerpunch', 'scorchingsands', 'drillrun', 'nightslash', 'rapidspin'],
	// The chimi of the mountains (Magic Guard: no recoil from Wood Hammer).
	chimihoujuu: ['leafblade', 'woodhammer', 'leafstorm', 'gigadrain', 'nastyplot', 'swordsdance', 'knockoff', 'suckerpunch', 'partingshot', 'uturn', 'leechseed', 'synthesis', 'taunt', 'nightslash', 'grassknot'],
	// The god of the roads, who guides travellers.
	narekomichigami: ['earthpower', 'calmmind', 'stealthrock', 'spikes', 'teleport', 'allyswitch', 'futuresight', 'trickroom', 'gravity', 'sandstorm', 'scorchingsands', 'mudshot', 'powergem', 'mirrorcoat', 'wish'],
	// The corrupted spirit (Sniper, Corrupt Data).
	yuimanasama: ['shadowclaw', 'shadowsneak', 'phantomforce', 'shadowstrike', 'swordsdance', 'nightslash', 'psychocut', 'suckerpunch', 'knockoff', 'uturn', 'icepunch', 'thunderpunch', 'firepunch',
		'earthquake', 'willowisp', 'destinybond'],
	// The Lunarian who links sea and mountain, and the fan that clears whole forests.
	watatsukinotoyohime: ['calmmind', 'moonblast', 'moonlight', 'psychic', 'futuresight', 'hurricane', 'tailwind', 'defog', 'icebeam', 'energyball', 'haze', 'raindance', 'whirlpool', 'teleport'],
	// Her sister, who calls down any god, with Gion's sword. RISK: the Invokes retype her slicers, with Swords Dance.
	watatsukinoyorihime: ['sacredsword', 'swordsdance', 'leafblade', 'nightslash', 'psychocut', 'xscissor', 'aerialace', 'smartstrike', 'bulkup', 'drainpunch', 'machpunch', 'closecombat',
		'aurasphere', 'vacuumwave', 'agility', 'wideguard', 'quickguard'],
	// Iwanaga-hime, goddess of stone and long life, who cursed the lives of those who spurned her.
	ariyaiwanaga: ['wish', 'lifedew', 'irondefense', 'bodypress', 'stealthrock', 'stoneedge', 'powergem', 'meteorbeam', 'earthpower', 'calmmind', 'rockpolish', 'sandstorm', 'gravity', 'grudge', 'headsmash', 'heavyslam'],
	// The water-and-lightning spirit (Surge Surfer).
	ninawatari: ['scald', 'hydropump', 'thunderbolt', 'voltswitch', 'discharge', 'raindance', 'electricterrain', 'calmmind', 'flipturn', 'icebeam', 'aquaring', 'chargebeam', 'paraboliccharge'],
};
// A forme with a learnset of its own gets its character's, and its own types' kits (formeTypes).
const FORME_OF = { cirnotanned: 'cirno', keinehakutaku: 'keine', ichirinkumoiunzan: 'ichirinkumoi', hecatiaearth: 'hecatia', hecatiamoon: 'hecatia' };
// Taken back out where a type's kit is too much on that body. Keine's full-moon forme has 680
// base stats and needs no item: no Dragon Dance on top of that.
const TYPE_EXCEPT = { keinehakutaku: ['dragondance'] };

/** Which sides it attacks from: Huge Power doubles Tewi's 40 Attack, so she counts as physical. */
function sides(species) {
	const { atk, spa } = species.baseStats;
	const doubled = Object.values(species.abilities || {}).some(a => a === 'Huge Power' || a === 'Pure Power');
	return { physical: atk >= 90 || atk >= spa || doubled, special: spa >= 90 || spa >= atk };
}

/** Everything the three layers give one species id (a forme too). */
function grantsFor(id) {
	const species = DATA.species[id];
	if (!species) return [];
	const base = FORME_OF[id];
	const types = new Set([...typesOf(id), ...(base ? typesOf(base) : [])]);
	const { physical, special } = sides(species);
	const out = new Set(UNIVERSAL);
	for (const type of types) {
		const kit = TYPE_TMS[type];
		if (!kit) continue;
		for (const move of kit.status) out.add(move);
		if (physical) for (const move of kit.physical) out.add(move);
		if (special) for (const move of kit.special) out.add(move);
	}
	for (const move of TYPE_EXCEPT[id] || []) out.delete(move);
	for (const move of THEMATIC[base || id] || []) out.add(move);
	return [...out];
}

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

/** Of `types`, the one that deals `target` the most damage from `pokemon`: its own types' bonus counts; the first wins ties. */
function bestType(battle, types, pokemon, target) {
	const score = type => (battle.dex.getImmunity(type, target) ? battle.dex.getEffectiveness(type, target) : -99) + (pokemon.hasType(type) ? 0.585 : 0);
	return types.reduce((best, type) => (score(type) > score(best) ? type : best));
}
// Meiling's rainbow, red to violet, her own two first.
const RAINBOW = ['Fighting', 'Dragon', 'Fire', 'Electric', 'Grass', 'Water', 'Poison'];
const clearHazards = (battle, pokemon) => {
	for (const id of HAZARDS) {
		if (pokemon.side.removeSideCondition(id)) battle.add('-sideend', pokemon.side, battle.dex.conditions.get(id).name, '[from] move: Illusionary Dominance', '[of] ' + pokemon);
	}
};

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
	// 8 PP flat (noPPBoosts): PP Ups make a move's PP 8/5 of itself, and 8 * 8/5 is 12.8, which
	// the battle showed as "12.8/12.8" and counted down as "11.8/12.8".
	forbiddenbarrage: {
		num: -203, accuracy: true, basePower: 120, category: 'Special', name: 'Forbidden Barrage', pp: 8, noPPBoosts: true, priority: 0,
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
		num: -222, accuracy: true, basePower: 120, category: 'Special', name: "Fate's Call", pp: 8, noPPBoosts: true, priority: 0,
		flags: { mirror: 1, metronome: 1 },
		onPrepareHit: anim('Dark Pulse'),
		secondary: null, target: 'normal', type: 'Dark',
		shortDesc: "Can't miss. Hits through protection. Remilia's signature.",
		desc: "Does not check accuracy, so evasion and accuracy changes do not matter. Hits a target using Protect, Detect, King's Shield, Spiky Shield, Baneful Bunker, Silk Trap, Burning Bulwark, Obstruct or Max Guard without ending the protection or suffering its effects. Remilia Scarlet's signature move.",
	},
	masterspark: {
		num: -260, accuracy: 100, basePower: 120, category: 'Special', name: 'Master Spark', pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Hyper Beam'),
		// Light and heat from the hakkero: whichever of Electric and Fire hits harder.
		onModifyMove(move, pokemon, target) {
			if (!target) return;
			const score = type => this.dex.getImmunity(type, target) ? this.dex.getEffectiveness(type, target) : -9;
			move.type = score('Fire') > score('Electric') ? 'Fire' : 'Electric';
		},
		secondary: {
			chance: 20,
			onHit(target, source) {
				target.trySetStatus(this.random(2) ? 'brn' : 'par', source);
			},
		},
		target: 'normal', type: 'Electric',
		shortDesc: "Electric or Fire, whichever is more effective. 20% to burn or paralyze. Marisa's signature.",
		desc: "This move is Electric or Fire, whichever is more effective against the target; Electric if they are equal. Has a 20% chance to either burn or paralyze the target. Marisa Kirisame's signature move.",
	},
	/*
	 * ---------------------------------------------- the main cast's signatures
	 *
	 * The owner, 21 Oct 2026: each character's best-known spell card, theirs alone (SIGNATURES).
	 * Power 80 to 130 - the stronger the effect, the lower - 100% accurate or never missing, and
	 * no drawback: no recoil, recharge, charge turn or drop of the user's own stats. 8 PP flat
	 * (noPPBoosts, see Forbidden Barrage). Positive priority only for Sakuya, the time-stopper.
	 */
	fantasyseal: {
		num: -261, accuracy: true, basePower: 100, category: 'Special', name: 'Fantasy Seal', pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Hidden Power', 'Dazzling Gleam'),
		// The shrine maiden's homing orbs: they find their mark, exorcise ghosts and seal power away.
		ignoreImmunity: { Fighting: true },
		onHit(target) {
			target.clearBoosts();
			this.add('-clearboost', target);
		},
		secondary: null, target: 'normal', type: 'Fighting',
		shortDesc: "Can't miss. Hits Ghosts. Clears the target's stat changes. Reimu's signature.",
		desc: "Does not check accuracy, so evasion and accuracy changes do not matter. Hits Ghost types, which are normally immune to Fighting moves. The target's stat stages are all reset to 0 when hit. Reimu Hakurei's signature move.",
	},
	// Sakuya stops time. The one signature with positive priority, and the owner's one exception to
	// "priority signatures are 40 to 60": 80 power at +1, a slicing knife throw (Maid's Trick).
	sakuyasworld: {
		num: -262, accuracy: 100, basePower: 80, category: 'Physical', name: "Sakuya's World", pp: 8, noPPBoosts: true, priority: 1,
		flags: { protect: 1, mirror: 1, metronome: 1, slicing: 1 },
		onPrepareHit: anim('Agility', 'Smart Strike'),
		secondary: null, target: 'normal', type: 'Steel',
		shortDesc: "Usually goes first. Slicing. Sakuya's signature.",
		desc: "Usually goes first: +1 priority, as the user stops time. Slicing move: Sharpness and Maid's Trick boost it. Sakuya Izayoi's signature move.",
	},
	// Her knife barrage, 20 knives of 10, each checking accuracy as Population Bomb's do.
	killingdoll: {
		num: -263, accuracy: 99, basePower: 10, category: 'Physical', name: 'Killing Doll', pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1, slicing: 1 },
		onPrepareHit: anim('Spikes', 'Smart Strike'),
		multihit: 20, multiaccuracy: true,
		// Loaded Dice: Population Bomb's 4 to 10 of its 10 hits, all landing, scaled to 20 knives.
		onModifyMove(move, pokemon) {
			if (pokemon.hasItem('loadeddice')) move.multihit = [8, 20];
		},
		secondary: null, target: 'normal', type: 'Steel',
		shortDesc: "Hits 20 times; each hit can miss. Slicing. Sakuya's signature.",
		desc: "Hits 20 times. Each hit checks accuracy (99%), and the move stops at the first miss. Skill Link makes every hit land; Loaded Dice makes it hit 8 to 20 times without checking accuracy, as it does for Population Bomb. Slicing move: Sharpness and Maid's Trick boost each hit. Sakuya Izayoi's signature move.",
	},
	presentlifeslash: {
		num: -264, accuracy: 100, basePower: 55, category: 'Physical', name: 'Present Life Slash', pp: 8, noPPBoosts: true, priority: 0,
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1, slicing: 1 },
		onPrepareHit: anim('Sacred Sword', 'Shadow Claw'),
		// The half-ghost's two swords, the Roukanken and the Hakurouken: a cut from each.
		multihit: 2,
		secondary: null, target: 'normal', type: 'Ghost',
		shortDesc: "Hits twice. Slicing. Youmu's signature.",
		desc: "Hits twice, once with each of the user's swords. If the first hit breaks the target's substitute, it will take damage from the second hit. Slicing move. Youmu Konpaku's signature move.",
	},
	mosessmiracle: {
		num: -265, accuracy: 100, basePower: 100, category: 'Special', name: "Moses's Miracle", pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Rain Dance', 'Surf'),
		// The sea parts: walls of screens part with it.
		onTryHit(target) {
			for (const id of ['reflect', 'lightscreen', 'auroraveil']) target.side.removeSideCondition(id);
		},
		secondary: { chance: 20, volatileStatus: 'flinch' },
		target: 'normal', type: 'Water',
		shortDesc: "Ends the target side's screens. 20% flinch. Sanae's signature.",
		desc: "If this attack does not miss, the effects of Reflect, Light Screen and Aurora Veil end for the target's side of the field before damage is calculated. Has a 20% chance to make the target flinch (40% with Serene Grace). Sanae Kochiya's signature move.",
	},
	lunaticredeyes: {
		num: -266, accuracy: 100, basePower: 90, category: 'Special', name: 'Lunatic Red Eyes', pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Glare', 'Psybeam'),
		secondary: { chance: 100, volatileStatus: 'confusion' },
		target: 'normal', type: 'Psychic',
		shortDesc: "Confuses the target. Reisen's signature.",
		desc: "Confuses the target: the moon rabbit's eyes drive whoever meets them mad. Reisen Udongein Inaba's signature move.",
	},
	occultball: {
		num: -267, accuracy: 100, basePower: 100, category: 'Special', name: 'Occult Ball', pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1, bullet: 1 },
		onPrepareHit: anim('Psycho Boost'),
		// She went collecting the Occult Balls: an empty-handed user takes the target's item, as Thief does.
		onAfterHit(target, source, move) {
			if (source.item || source.volatiles['gem']) return;
			const yourItem = target.takeItem(source);
			if (!yourItem) return;
			if (!this.singleEvent('TakeItem', yourItem, target.itemState, source, target, move, yourItem) || !source.setItem(yourItem)) {
				target.item = yourItem.id;
				return;
			}
			this.add('-enditem', target, yourItem, '[silent]', '[from] move: Occult Ball', '[of] ' + source);
			this.add('-item', source, yourItem, '[from] move: Occult Ball', '[of] ' + target);
		},
		secondary: null, target: 'normal', type: 'Psychic',
		shortDesc: "If the user has no item, it steals the target's. Sumireko's signature.",
		desc: "If this attack was successful and the user has not fainted, it steals the target's held item if the user is not holding one, as Thief does. Ball and bomb move. Sumireko Usami's signature move.",
	},
	perfectfreeze: {
		num: -268, accuracy: 100, basePower: 90, category: 'Special', name: 'Perfect Freeze', pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Sheer Cold'),
		// The strongest fairy freezes even water.
		onEffectiveness(typeMod, target, type) {
			if (type === 'Water') return 1;
		},
		secondary: { chance: 20, status: 'frz' },
		target: 'normal', type: 'Ice',
		shortDesc: "Super effective on Water. 20% to freeze. Cirno's signature.",
		desc: "This move's type effectiveness against Water is changed to be super effective no matter what this move's type is, as Freeze-Dry's is. Has a 20% chance to freeze the target. Cirno's signature move.",
	},
	// Hong Meiling's (the owner: "especially Meiling"): the Rainbow Sign of her chi arts, a kick
	// in the seven colours. Whichever of them hits hardest, counting her own types' bonus.
	rainbowwindchime: {
		num: -269, accuracy: 100, basePower: 110, category: 'Physical', name: 'Rainbow Wind Chime', pp: 8, noPPBoosts: true, priority: 0,
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Aura Sphere', 'High Jump Kick'),
		onModifyType(move, pokemon, target) {
			if (target) move.type = bestType(this, RAINBOW, pokemon, target);
		},
		secondary: null, target: 'normal', type: 'Fighting',
		shortDesc: "Takes the most damaging of the 7 rainbow types. Meiling's signature.",
		desc: "This move takes whichever of its seven rainbow types deals the most damage to the target: Fire, Fighting, Electric, Grass, Water, Dragon or Poison, counting same-type attack bonus and immunities; Fighting when they tie. Makes contact. Hong Meiling's signature move.",
	},
	royalflare: {
		num: -270, accuracy: 100, basePower: 100, category: 'Special', name: 'Royal Flare', pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1, defrost: 1 },
		onPrepareHit: anim('Sunny Day', 'Fusion Flare'),
		onAfterMoveSecondarySelf() {
			this.field.setWeather('sunnyday');
		},
		secondary: { chance: 10, status: 'brn' },
		target: 'normal', type: 'Fire',
		shortDesc: "Summons harsh sunlight after hitting. 10% burn. Patchouli's signature.",
		desc: "Has a 10% chance to burn the target. After the attack, the weather becomes Sunny Day for 5 turns (8 with Heat Rock). Thaws the user. Patchouli Knowledge's signature move.",
	},
	artfulsacrifice: {
		num: -271, accuracy: 100, basePower: 100, category: 'Special', name: 'Artful Sacrifice', pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1, bypasssub: 1 },
		onPrepareHit: anim('Explosion'),
		// A doll flung into the enemy lines and detonated: no wall of a substitute stops it.
		secondary: null, target: 'allAdjacentFoes', type: 'Steel',
		shortDesc: "Hits adjacent foes. Ignores substitutes. Alice's signature.",
		desc: "Hits all adjacent foes. Ignores a target's substitute: one of the user's dolls explodes among them, and the user does not faint. Alice Margatroid's signature move.",
	},
	resurrectionbutterfly: {
		num: -272, accuracy: 100, basePower: 90, category: 'Special', name: 'Resurrection Butterfly', pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1, heal: 1 },
		onPrepareHit: anim('Silver Wind', 'Giga Drain'),
		// The butterflies of death carry the life they take back to her.
		drain: [1, 2],
		secondary: null, target: 'normal', type: 'Ghost',
		shortDesc: "User recovers 50% of the damage dealt. Yuyuko's signature.",
		desc: "The user recovers 1/2 the HP lost by the target, rounded half up. If Big Root is held by the user, the HP recovered is 1.3x normal, rounded half down. Yuyuko Saigyouji's signature move.",
	},
	spiritingaway: {
		num: -273, accuracy: 100, basePower: 80, category: 'Special', name: 'Spiriting Away', pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1, noassist: 1, failcopycat: 1 },
		onPrepareHit: anim('Hyperspace Hole'),
		// A gap opens behind the target and it is gone. Not Dragon Tail's -6 priority: no drawback.
		forceSwitch: true,
		secondary: null, target: 'normal', type: 'Dark',
		shortDesc: "Forces the target to switch to a random ally. Yukari's signature.",
		desc: "If both the user and the target have not fainted, the target is forced to switch out and be replaced with a random unfainted ally. This effect fails if the target is under the effect of Ingrain, has the Suction Cups Ability, or this move hit a substitute. Unlike Dragon Tail, it has normal priority. Yukari Yakumo's signature move.",
	},
	ultimatebuddhist: {
		num: -274, accuracy: true, basePower: 100, category: 'Special', name: 'Ultimate Buddhist', pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Psystrike'),
		// The shikigami computes: it never misses, and strikes with whichever side of her is stronger.
		onModifyMove(move, pokemon) {
			if (pokemon.getStat('atk', false, true) > pokemon.getStat('spa', false, true)) move.category = 'Physical';
		},
		secondary: null, target: 'normal', type: 'Psychic',
		shortDesc: "Can't miss. Physical if Atk > Sp. Atk. Ran's signature.",
		desc: "Does not check accuracy. This move becomes a physical attack if the user's Attack is greater than its Special Attack, including stat stage changes, as Photon Geyser does. Ran Yakumo's signature move.",
	},
	pentagramflight: {
		num: -275, accuracy: 100, basePower: 80, category: 'Physical', name: 'Pentagram Flight', pp: 8, noPPBoosts: true, priority: 0,
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Extreme Speed', 'U-turn'),
		// The black cat darts along a pentagram and is back at her master's side.
		selfSwitch: true,
		secondary: null, target: 'normal', type: 'Normal',
		shortDesc: "User switches out after damaging the target. Chen's signature.",
		desc: "If this move is successful and the user has not fainted, the user switches out even if it is trapped and is replaced immediately by a selected party member. The user does not switch out if there are no unfainted party members, or if the target switched out using an Eject Button or through the effect of the Emergency Exit or Wimp Out Abilities. Chen's signature move.",
	},
	houraielixir: {
		num: -276, accuracy: true, basePower: 0, category: 'Status', name: 'Hourai Elixir', pp: 8, noPPBoosts: true, priority: 0,
		flags: { snatch: 1, heal: 1, metronome: 1 },
		onPrepareHit: anim('Life Dew', 'Aromatherapy'),
		// The genius pharmacist's elixir: half her health, and every ally's ailments cured.
		onHit(pokemon, source) {
			const healed = this.heal(this.modify(pokemon.maxhp, 0.5), pokemon, source);
			let cured = false;
			for (const ally of pokemon.side.pokemon) if (ally.status && ally.cureStatus()) cured = true;
			if (!healed && !cured) return this.NOT_FAIL;
		},
		secondary: null, target: 'self', type: 'Poison',
		shortDesc: "Heals 50% of max HP; cures the user's team of status. Eirin's signature.",
		desc: "The user restores 1/2 of its maximum HP, rounded half up, and every Pokemon in the user's party is cured of its non-volatile status condition. Eirin Yagokoro's signature move.",
	},
	impossiblerequest: {
		num: -277, accuracy: 100, basePower: 90, category: 'Special', name: 'Impossible Request', pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Dazzling Gleam', 'Power Gem'),
		// One of the five treasures she asked her suitors for, at random each time.
		secondary: {
			chance: 100,
			onHit(target, source) {
				switch (this.random(5)) {
				case 0: target.trySetStatus('brn', source); break;        // the robe of the fire-rat
				case 1: target.trySetStatus('par', source); break;        // the swallow's cowry shell
				case 2: target.addVolatile('confusion', source); break;   // the dragon's neck jewel
				case 3: this.boost({ def: -1 }, target, source); break;   // the Buddha's stone bowl
				default: this.boost({ spd: -1 }, target, source);         // the jewelled branch of Hourai
				}
			},
		},
		target: 'normal', type: 'Fairy',
		shortDesc: "Burns, paralyzes, confuses, or lowers Def or Sp. Def. Kaguya's signature.",
		desc: "Always has one of five effects on the target, chosen at random with equal odds: burn, paralysis, confusion, its Defense lowered by 1 stage, or its Special Defense lowered by 1 stage - the five impossible requests. Kaguya Houraisan's signature move.",
	},
	phoenixrebirth: {
		num: -278, accuracy: 100, basePower: 100, category: 'Physical', name: 'Phoenix Rebirth', pp: 8, noPPBoosts: true, priority: 0,
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1, defrost: 1, heal: 1 },
		onPrepareHit: anim('Sacred Fire'),
		// The immortal rises from her own flames.
		onAfterMoveSecondarySelf(pokemon) {
			if (pokemon.fainted) return;
			pokemon.cureStatus();
			this.heal(pokemon.baseMaxhp / 4, pokemon, pokemon);
		},
		secondary: null, target: 'normal', type: 'Fire',
		shortDesc: "User is cured of status and heals 25% of max HP. Mokou's signature.",
		desc: "After the attack, the user is cured of its non-volatile status condition and restores 1/4 of its maximum HP, rounded down. Thaws the user. Makes contact. Fujiwara no Mokou's signature move.",
	},
	illusionarydominance: {
		num: -279, accuracy: 100, basePower: 100, category: 'Physical', name: 'Illusionary Dominance', pp: 8, noPPBoosts: true, priority: 0,
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Brave Bird', 'Defog'),
		// The crow tengu's wind blows her own side clean as she passes.
		onAfterHit(target, pokemon) {
			if (pokemon.hp) clearHazards(this, pokemon);
		},
		onAfterSubDamage(damage, target, pokemon) {
			if (pokemon.hp) clearHazards(this, pokemon);
		},
		secondary: null, target: 'normal', type: 'Flying',
		shortDesc: "Clears hazards from the user's side. Aya's signature.",
		desc: "If this move is successful and the user has not fainted, the effects of Spikes, Toxic Spikes, Stealth Rock and Sticky Web end for the user's side. Makes contact. Aya Shameimaru's signature move.",
	},
	kappaspororoca: {
		num: -280, accuracy: 100, basePower: 110, category: 'Special', name: "Kappa's Pororoca", pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Hydro Pump'),
		// A tidal bore of the kappa's engineering: it is not drunk up, and is not drawn aside.
		tracksTarget: true,
		onModifyMove(move, pokemon, target) {
			if (target && ['waterabsorb', 'stormdrain', 'dryskin'].includes(target.getAbility().id)) move.ignoreAbility = true;
		},
		secondary: null, target: 'normal', type: 'Water',
		shortDesc: "Ignores Water Absorb, Storm Drain, Dry Skin. Nitori's signature.",
		desc: "Hits through the target's Water Absorb, Storm Drain or Dry Skin as if it had no Ability, and cannot be redirected by an ally's Storm Drain. Nitori Kawashiro's signature move.",
	},
	expandedonbashira: {
		num: -281, accuracy: 100, basePower: 100, category: 'Physical', name: 'Expanded Onbashira', pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Stone Axe'),
		// The pillars come down and stay standing.
		onAfterHit(target, source) {
			if (source.hp) target.side.addSideCondition('stealthrock', source);
		},
		onAfterSubDamage(damage, target, source) {
			if (source.hp) target.side.addSideCondition('stealthrock', source);
		},
		secondary: null, target: 'normal', type: 'Ground',
		shortDesc: "Sets Stealth Rock on the target's side. Kanako's signature.",
		desc: "If this move is successful and the user has not fainted, sets Stealth Rock on the target's side of the field. Kanako Yasaka's signature move.",
	},
	mishagujisama: {
		num: -282, accuracy: 100, basePower: 90, category: 'Special', name: 'Mishaguji-sama', pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Earth Power', 'Curse'),
		// The curse of the native gods: it stays on the target until it leaves the field.
		condition: {
			onStart(pokemon) {
				this.add('-start', pokemon, 'Mishaguji-sama');
			},
			onResidualOrder: 13,
			onResidual(pokemon) {
				this.damage(pokemon.baseMaxhp / 8);
			},
			onEnd(pokemon) {
				this.add('-end', pokemon, 'Mishaguji-sama');
			},
		},
		secondary: { chance: 100, volatileStatus: 'mishagujisama' },
		target: 'normal', type: 'Ground',
		shortDesc: "Curses the target: 1/8 max HP each turn. Suwako's signature.",
		desc: "Curses the target: it loses 1/8 of its maximum HP, rounded down, at the end of each turn until it switches out. Suwako Moriya's signature move.",
	},
	terriblesouvenir: {
		num: -283, accuracy: true, basePower: 100, category: 'Special', name: 'Terrible Souvenir', pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Psychic', 'Disable'),
		// She reads the mind and hands back the worst memory in it: the last move it used.
		onHit(target) {
			const last = target.lastMove;
			if (last && last.id !== 'struggle' && !last.isZOrMaxPowered && !last.isMax && !target.volatiles['disable']) target.addVolatile('disable');
		},
		secondary: null, target: 'normal', type: 'Psychic',
		shortDesc: "Can't miss. Disables the target's last move. Satori's signature.",
		desc: "Does not check accuracy. The move the target used last is disabled for 4 turns, as Disable does, unless it already has a disabled move. Satori Komeiji's signature move.",
	},
	subterraneanrose: {
		num: -284, accuracy: 100, basePower: 100, category: 'Special', name: 'Subterranean Rose', pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Petal Blizzard', 'Psychic'),
		// The closed eye: nothing the target is or does registers with her.
		ignoreAbility: true, ignoreDefensive: true, ignoreEvasion: true,
		secondary: null, target: 'normal', type: 'Psychic',
		shortDesc: "Ignores the target's Ability and stat changes. Koishi's signature.",
		desc: "This move and its effects ignore the Abilities of other Pokemon, and the target's stat stage changes, including evasiveness. Koishi Komeiji's signature move.",
	},
	gigaflare: {
		num: -285, accuracy: 100, basePower: 130, category: 'Special', name: 'Giga Flare', pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1, defrost: 1 },
		onPrepareHit: anim('Blast Burn'),
		// Nuclear fusion: the raw nuke. No Overheat drop, no recoil.
		secondary: { chance: 30, status: 'brn' },
		target: 'normal', type: 'Fire',
		shortDesc: "30% chance to burn. Okuu's signature.",
		desc: "Has a 30% chance to burn the target. No recoil and no drop of the user's stats: the hell raven's nuclear fire. Thaws the user. Utsuho Reiuji's signature move.",
	},
	rekindlingofdeadashes: {
		num: -286, accuracy: 100, basePower: 80, category: 'Special', name: 'Rekindling of Dead Ashes', pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1, defrost: 1 },
		onPrepareHit: anim('Inferno', 'Hex'),
		// The kasha who carries off corpses: every fallen Pokemon, on either side, feeds the fire.
		basePowerCallback(pokemon, target, move) {
			const fallen = this.sides.reduce((n, side) => n + side.totalFainted, 0);
			const bp = Math.min(130, move.basePower + 10 * fallen);
			if (bp > move.basePower) this.debug('BP ' + bp);
			return bp;
		},
		secondary: null, target: 'normal', type: 'Fire',
		shortDesc: "+10 power per fainted Pokemon on either side, up to 130. Orin's signature.",
		desc: "Power is 80, plus 10 for each Pokemon on either side that has fainted this battle, up to 130. Thaws the user. Rin Kaenbyou's signature move.",
	},
	superhumanhijiri: {
		num: -287, accuracy: 100, basePower: 85, category: 'Physical', name: 'Superhuman Hijiri', pp: 8, noPPBoosts: true, priority: 0,
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1, punch: 1 },
		onPrepareHit: anim('Bulk Up', 'Drain Punch'),
		// Her body-strengthening magic: every blow makes the next one stronger.
		secondary: { chance: 100, self: { boosts: { atk: 1 } } },
		target: 'normal', type: 'Fighting',
		shortDesc: "Raises the user's Attack by 1. Byakuren's signature.",
		desc: "Has a 100% chance to raise the user's Attack by 1 stage. Makes contact; punching move. Byakuren Hijiri's signature move.",
	},
	undefinedufo: {
		num: -288, accuracy: 100, basePower: 120, category: 'Special', name: 'Undefined UFO', pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Night Shade', 'Tri Attack'),
		// Unidentified: it has no type to resist, and no type to get her bonus from either.
		onModifyType(move) {
			move.type = '???';
		},
		secondary: null, target: 'normal', type: 'Dark',
		shortDesc: "Typeless: neutral damage on everything, no STAB. Nue's signature.",
		desc: "This move has no type in battle (???): it deals neutral damage to every target, which no type resists or is immune to, and gets no same-type attack bonus. Listed as Dark. Nue Houjuu's signature move.",
	},
	guseflash: {
		num: -289, accuracy: 100, basePower: 100, category: 'Special', name: 'Guse Flash', pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Flash', 'Dazzling Gleam'),
		// She hears ten desires at once: a target that means to use a status move this turn flinches.
		onHit(target) {
			const action = this.queue.willMove(target);
			if (action && action.choice === 'move' && action.move && action.move.category === 'Status') target.addVolatile('flinch');
		},
		secondary: null, target: 'normal', type: 'Fairy',
		shortDesc: "Target flinches if it was going to use a status move. Miko's signature.",
		desc: "If the target has not moved yet this turn and has chosen a status move, it flinches. Toyosatomimi no Miko's signature move.",
	},
	keystoneofheavenandearth: {
		num: -290, accuracy: 100, basePower: 90, category: 'Physical', name: 'Keystone of Heaven and Earth', pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Stone Edge'),
		// The masochist celestial: every hit she has taken makes the keystone fall harder.
		basePowerCallback(pokemon, target, move) {
			return Math.min(130, move.basePower + 20 * pokemon.timesAttacked);
		},
		secondary: null, target: 'normal', type: 'Rock',
		shortDesc: "+20 power per hit the user has taken, up to 130. Tenshi's signature.",
		desc: "Power is 90, plus 20 for each time the user has been hit by an attack this battle (counted as Rage Fist counts), up to 130. Tenshi Hinanawi's signature move.",
	},
	elekiterdragonpalace: {
		num: -291, accuracy: 100, basePower: 100, category: 'Special', name: 'Elekiter Dragon Palace', pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Thunder'),
		// Lightning from the dragon's palace above the clouds: the ground cannot hide from it.
		ignoreImmunity: { Electric: true },
		secondary: { chance: 10, status: 'par' },
		target: 'normal', type: 'Electric',
		shortDesc: "Hits Ground types. 10% to paralyze. Iku's signature.",
		desc: "Hits Ground types, which are normally immune to Electric moves. Has a 10% chance to paralyze the target. Iku Nagae's signature move.",
	},
	refloweringofgensokyo: {
		num: -292, accuracy: 100, basePower: 110, category: 'Physical', name: 'Reflowering of Gensokyo', pp: 8, noPPBoosts: true, priority: 0,
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Petal Blizzard', 'Grassy Terrain'),
		onAfterMoveSecondarySelf() {
			this.field.setTerrain('grassyterrain');
		},
		secondary: null, target: 'normal', type: 'Grass',
		shortDesc: "Sets Grassy Terrain after hitting. Yuuka's signature.",
		desc: "After the attack, the terrain becomes Grassy Terrain for 5 turns (8 with a Terrain Extender): every flower in Gensokyo blooms at once. Makes contact. Yuuka Kazami's signature move.",
	},
	narrowconfinesofavici: {
		num: -293, accuracy: 100, basePower: 130, category: 'Physical', name: 'Narrow Confines of Avici', pp: 8, noPPBoosts: true, priority: 0,
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1, slicing: 1 },
		onPrepareHit: anim('Spirit Break', 'Night Slash'),
		// The ferry toll is a life: the more of it the target has, the dearer the crossing.
		basePowerCallback(pokemon, target, move) {
			return 80 + Math.floor(50 * target.hp / target.maxhp);
		},
		secondary: null, target: 'normal', type: 'Ghost',
		shortDesc: "80 to 130 power: more the more HP the target has. Komachi's signature.",
		desc: "Power is 80 plus 50 times the target's remaining fraction of its maximum HP, rounded down: 130 at full HP. Slicing move. Komachi Onozuka's signature move.",
	},
	lastjudgement: {
		num: -294, accuracy: 100, basePower: 100, category: 'Special', name: 'Last Judgement', pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Judgment'),
		// The Yama weighs the sins: a target that has built itself up is judged guilty.
		basePowerCallback(pokemon, target, move) {
			if (Object.values(target.boosts).some(v => v > 0)) return move.basePower * 1.5;
			return move.basePower;
		},
		secondary: null, target: 'normal', type: 'Normal',
		shortDesc: "1.5x power if the target has a raised stat. Eiki's signature.",
		desc: "Power is multiplied by 1.5 (150) if any of the target's stat stages is above 0. Eiki Shiki, Yamaxanadu's signature move.",
	},
	missingpower: {
		num: -295, accuracy: 100, basePower: 120, category: 'Physical', name: 'Missing Power', pp: 8, noPPBoosts: true, priority: 0,
		// No `protect` flag, as Feint has none: Protect would block it before it could break it.
		flags: { contact: 1, mirror: 1, metronome: 1, punch: 1 },
		onPrepareHit: anim('Gigaton Hammer', 'Mega Punch'),
		// The oni grows to the size of a mountain: no shield holds that fist.
		breaksProtect: true,
		secondary: null, target: 'normal', type: 'Fighting',
		shortDesc: "Breaks the target's protection. Suika's signature.",
		desc: "If this move is successful, it breaks through the target's Baneful Bunker, Burning Bulwark, Detect, King's Shield, Protect, Silk Trap or Spiky Shield for this turn, allowing other Pokemon to attack the target normally, and the user takes none of their effects. If the target's side is protected by Crafty Shield, Mat Block, Quick Guard or Wide Guard, that protection is also broken for this turn. Makes contact; punching move. Suika Ibuki's signature move.",
	},
	tentransformations: {
		num: -296, accuracy: 100, basePower: 85, category: 'Physical', name: 'Ten Transformations', pp: 8, noPPBoosts: true, priority: 0,
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Transform', 'Body Slam'),
		// A leaf on the head, and the target is a plain tanuki's teakettle.
		onHit(target) {
			if (target.hp && !target.terastallized && target.getTypes().join() !== 'Normal' && target.setType('Normal')) {
				this.add('-start', target, 'typechange', 'Normal');
			}
		},
		secondary: null, target: 'normal', type: 'Normal',
		shortDesc: "Target becomes pure Normal type. Mamizou's signature.",
		desc: "If the target survives, it becomes pure Normal type, as Soak makes a Pokemon Water type, until it switches out. Fails on a Terastallized target, or one whose type cannot change. Makes contact. Mamizou Futatsuiwa's signature move.",
	},
	changeairbrave: {
		num: -297, accuracy: 100, basePower: 100, category: 'Physical', name: 'Change Air Brave', pp: 8, noPPBoosts: true, priority: 0,
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Topsy-Turvy', 'Foul Play'),
		// The amanojaku turns the world over: what resists it is weak to it, and the reverse.
		onEffectiveness(typeMod) {
			return -typeMod;
		},
		secondary: null, target: 'normal', type: 'Dark',
		shortDesc: "Type effectiveness is inverted. Seija's signature.",
		desc: "This move's type effectiveness is inverted, as in an Inverse Battle: it is super effective on Dark, Fighting and Fairy types, and resisted by Psychic and Ghost types. Seija Kijin's signature move.",
	},
	shiningneedlesword: {
		num: -298, accuracy: 100, basePower: 80, category: 'Physical', name: 'Shining Needle Sword', pp: 8, noPPBoosts: true, priority: 0,
		flags: { contact: 1, protect: 1, mirror: 1, metronome: 1, slicing: 1 },
		onPrepareHit: anim('Smart Strike', 'Sacred Sword'),
		// The inchling's needle: the bigger they are, the harder they fall.
		basePowerCallback(pokemon, target) {
			const kg = target.getWeight() / 10;
			if (kg >= 200) return 130;
			if (kg >= 100) return 120;
			if (kg >= 50) return 110;
			if (kg >= 25) return 100;
			if (kg >= 10) return 90;
			return 80;
		},
		secondary: null, target: 'normal', type: 'Steel',
		shortDesc: "80 to 130 power: more the heavier the target. Shinmyoumaru's signature.",
		desc: "Power is 80 if the target weighs less than 10 kg, 90 under 25 kg, 100 under 50 kg, 110 under 100 kg, 120 under 200 kg, and 130 at 200 kg or more. Slicing move. Shinmyoumaru Sukuna's signature move.",
	},
	purelightofthepalm: {
		num: -299, accuracy: 100, basePower: 100, category: 'Special', name: 'Pure Light of the Palm', pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1 },
		onPrepareHit: anim('Light of Ruin'),
		// Pure hatred, purified of everything else: nothing about the target softens it.
		ignoreImmunity: true,
		onEffectiveness(typeMod) {
			return Math.max(0, typeMod);
		},
		secondary: null, target: 'normal', type: 'Normal',
		shortDesc: "Never resisted: at least neutral on every type. Junko's signature.",
		desc: "This move cannot be resisted: types that would resist it or be immune to it take neutral damage instead. Junko's signature move.",
	},
	hiddenstarinallseasons: {
		num: -300, accuracy: 100, basePower: 110, category: 'Special', name: 'Hidden Star in All Seasons', pp: 8, noPPBoosts: true, priority: 0,
		flags: { protect: 1, mirror: 1, metronome: 1, bypasssub: 1 },
		onPrepareHit: anim('Secret Power', 'Dark Pulse'),
		// The god of the back door: the season she wears is the season she strikes with, and she
		// comes in from behind any substitute.
		onModifyType(move, pokemon) {
			const type = pokemon.getTypes()[0];
			move.type = type && type !== 'Normal' && type !== '???' ? type : 'Dark';
		},
		secondary: null, target: 'normal', type: 'Dark',
		shortDesc: "Type is the user's season. Ignores substitutes. Okina's signature.",
		desc: "This move's type is the user's first type - Water in spring, Fire in summer, Rock in autumn, Ice in winter - and Dark when that is Normal. Ignores a target's substitute. Okina Matara's signature move.",
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

const TMS = {
	// Reimu Hakurei's spell card, hers alone (the owner, 21 Oct 2026: a character's spell card
	// is that character's signature). It used to go to eight mystic birds.
	dreamseal: null,
	// The physical Steel and Dark types with a blade or claw (any slicing move), and
	// every Sharpness user. Not Chien-Pao or Kartana: a 97.5 power hit for outspeeding
	// is a free upgrade on the fastest blades in the game.
	silverdagger: {
		when: (s, k) => s.physical && (s.has('Steel') || s.has('Dark')) && k(SLICING) || s.physical && s.ability('Sharpness'),
		except: ['chienpao', 'kartana'],
	},
	// Flandre Scarlet's signature (the owner): never a machine.
	forbiddenbarrage: null,
	// Yukari Yakumo's, with her shikigami Ran: hers alone (the owner). It used to go to every
	// special Psychic type.
	shikigamirush: null,
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
	// Hecatia's: "100% signature" (the owner, 21 Oct 2026). It used to go to the Psychic and
	// Ghost types that heal half their HP, 63 of them.
	bodyswap: null,
	// The physical Fighting types and the physical dancers (any dance move but Swords
	// and Dragon Dance, which nearly everything knows), and every Dancer.
	// Not Annihilape or Urshifu (Ubers).
	dancingblow: {
		when: (s, k) => s.physical && (s.has('Fighting') || k(DANCES)) || s.ability('Dancer'),
		except: ['annihilape', 'urshifu'],
	},
	// Eika Ebisu's, at the Sanzu river, and now hers alone (the owner: a spell card is its
	// character's). It used to go to six slow stone-and-tomb Ghosts.
	stonestacking: null,
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
	// Yorihime's: she channels the gods, nobody else does (the owner). They used to go to the sword-bearers.
	invokeamaterasu: null,
	invokehonoikazuchi: null,
	// Yorihime's alone: it hands out Magic Bounce, which no TM should.
	invokeishikoridome: null,
};
/*
 * Every one of these moves is a character's own in the mod (Sculpted Armor is Keiki's, Silver
 * Dagger Sakuya's, Missile VIVIT's...), so none is a machine (the owner, 21 Oct 2026: "all
 * awakened moves taken from touhou signature taken away"). The rules above stay as a record of
 * how each was handed out, but nothing is distributed: OWNERS below decides who learns them.
 */
for (const id of Object.keys(TMS)) TMS[id] = null;
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
	// Shadow Strike: a CAP move in Showdown's data (num -2), which the owner hands the Boneka as an
	// Awakened move (Remilia, Flandre, the physical Ghosts). As CAP the validator refused it outright
	// ("made up for Smogon CAP"), so the Scarlets' grant never worked. Here it is an ordinary shared
	// move; build-buffs ships the corrected row so the builder lists it too.
	if (data.shadowstrike) data.shadowstrike = { ...data.shadowstrike, isNonstandard: null, gen: 9, velvetShared: true };
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
			// Once per use, though a spread move asks once per target (it took 3 PP off a
			// two-target hit). Said aloud, so the client's PP count can follow it.
			if (!move.anemicPaid) {
				move.anemicPaid = true;
				const slot = attacker.moveSlots.find(m => m.id === move.id && m.pp > 0);
				if (slot) {
					slot.pp--;
					this.add('-activate', attacker, 'ability: Anemic');
				}
			}
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
		// Her knives are sharp too (the owner, 21 Oct 2026): Sharpness's 1.5x, as vanilla does it.
		onBasePowerPriority: 19,
		onBasePower(basePower, attacker, defender, move) {
			if (move.flags['slicing']) return this.chainModify(1.5);
		},
		name: "Maid's Trick",
		shortDesc: 'Slicing moves: 1.5x power, and +1 priority at full HP.',
		desc: "This Pokemon's slicing moves have their power multiplied by 1.5, as Sharpness does. If this Pokemon is at full HP, its slicing moves also have their priority increased by 1.",
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
			const borrowed = [];
			for (const moveSlot of target.moveSlots.slice(0, 4)) {
				if (!moveSlot || source.moveSlots.some(m => m.id === moveSlot.id)) continue;
				const move = this.dex.moves.get(moveSlot.id);
				source.moveSlots.push({
					move: move.name, id: move.id, pp: 5, maxpp: 5, target: move.target,
					disabled: false, disabledSource: '', used: false,
				});
				borrowed.push(move.name);
			}
			// Named, so the client tracks them as borrowed moves at 5 PP rather than as her own
			// at full PP (client/js/velvet-data.js, installTouhouPP).
			if (borrowed.length) this.add('-activate', source, 'ability: Recollection', borrowed.join(', '), '[of] ' + target);
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
exports.SIGNATURES = SIGNATURES;
exports.TMS = TMS;
exports.UNIVERSAL = UNIVERSAL;
exports.TYPE_TMS = TYPE_TMS;
exports.THEMATIC = THEMATIC;
exports.grantsFor = grantsFor;
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
exports.CHANGED_MOVES = ['toxicspikes', 'stickyweb', 'hyperspacefury', 'shadowstrike'];
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
