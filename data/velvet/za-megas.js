'use strict';
/**
 * The Legends Z-A Mega Evolutions, switched on and given tiers.
 *
 * Showdown ships all forty-nine of them, plus their stones, marked
 * `isNonstandard: 'Future'` and tiered `Illegal` - present in the data and
 * refused by every format, which is the right default for a game that is not
 * out yet and the wrong one for a server that wants to play with them.
 *
 * Two things are wrong with them and only one is a ban:
 *
 *   1. the 'Future' tag, which the validator reads as "does not exist in this
 *      generation" - and which is simply not true here. They exist on this
 *      server, so the tag comes off rather than being argued with per format.
 *   2. `natDexTier: 'Illegal'`, which is a missing tier rather than a ban. The
 *      answer to that is to give them one, which is most of this file.
 *
 * The first was tried the other way round first, with `+Future` in the RP
 * rules, and it is worth writing down why that failed: an unbanned tag is
 * checked before every other tag rule and returns "allowed" immediately, so the
 * Megas sailed past the tier bans as well. A Pokemon that a format has been
 * told to allow is allowed - including one its own tier forbids. Taking the tag
 * off instead leaves every banlist in place.
 *
 * Nothing here makes a Pokemon legal by fiat. Giving a Mega a real tier is what
 * places it: an Uber Mega is refused by RP OU, a UUBL one by RP RU, and not a
 * line of ours decides either.
 */

/**
 * The stones.
 *
 * Listed rather than derived because the Pokemon and the items are two separate
 * data files and only one of them says which stone belongs to which Mega - and
 * a Mega whose stone is still refused is worse than one that is refused
 * outright, because the Pokemon validates and the set does not.
 *
 * checkStones() runs once the item data is in and says so if the game has
 * gained a Z-A stone this list has not, so the next one is a log line rather
 * than a mystery.
 */
const ZA_STONES = [
	'absolitez', 'barbaracite', 'baxcalibrite', 'chandelurite',
	'chesnaughtite', 'chimechite', 'clefablite', 'crabominite',
	'darkranite', 'delphoxite', 'dragalgite', 'dragoninite',
	'drampanite', 'eelektrossite', 'emboarite', 'excadrite',
	'falinksite', 'feraligite', 'floettite', 'froslassite',
	'garchompitez', 'glimmoranite', 'golisopite', 'golurkite',
	'greninjite', 'hawluchanite', 'heatranite', 'lucarionitez',
	'magearnite', 'malamarite', 'meganiumite', 'meowsticite',
	'pyroarite', 'raichunitex', 'raichunitey', 'scolipite',
	'scovillainite', 'scraftinite', 'skarmorite', 'staraptite',
	'starminite', 'tatsugirinite', 'victreebelite', 'zeraorite',
	'zygardite',
];

/**
 * Let the stones exist too, and say so if the game has gained one.
 *
 * National Dex reads `item.isNonstandard` directly rather than through the tag
 * system, so a stone still marked 'Future' is refused however legal its Mega
 * is - the Pokemon validates, the set does not, and it reads as though Megas
 * were half switched on.
 */
exports.applyZaStones = (Items, log = () => {}) => {
	const known = new Set(ZA_STONES);
	const missing = [];
	for (const [id, item] of Object.entries(Items)) {
		if (item.isNonstandard !== 'Future') continue;
		if (known.has(id)) item.isNonstandard = null;
		else missing.push(id);
	}
	if (missing.length) {
		log(`data/velvet/za-megas.js has not heard of ${missing.join(', ')} - ` +
			`those Megas will be refused until the stones are added to ZA_STONES.`);
	}
	return missing;
};

/** Smogon's tiers, strongest first, which is the only order that matters here. */
const LADDER = [
	'AG', 'Uber', 'OU', 'UUBL', 'UU', 'RUBL', 'RU',
	'NUBL', 'NU', 'PUBL', 'PU', 'ZUBL', 'ZU',
];

/**
 * Where a Z-A Mega goes.
 *
 * Two rules, and both are measured rather than chosen:
 *
 *   - anything at 700 base stats or standing on an Uber base is Uber. At that
 *     point the Mega is not a better version of a Pokemon, it is a different
 *     weight class.
 *   - everything else moves one tier above its base form. That is the median
 *     step National Dex actually gives a Mega: of the forty-eight already
 *     tiered, the middle one gains exactly one tier, and they run from zero to
 *     five. One is the honest guess when there is no usage to look at.
 *
 * Erring upward is deliberate. A Mega that turns out to be too strong for the
 * tier it was put in ruins that tier; one that turns out to be too weak for the
 * tier above is merely unused, and moves down the moment anyone notices.
 *
 * These are starting positions, not verdicts. Edit the table and redeploy.
 */
const UBER_BST = 700;

function tierFor(megaBst, baseTier) {
	if (baseTier === 'AG') return 'AG';
	if (baseTier === 'Uber' || megaBst >= UBER_BST) return 'Uber';
	const at = LADDER.indexOf(String(baseTier || '').replace(/[()]/g, ''));
	// A base with no tier at all - an unevolved forme, something untiered - is
	// treated as bottom of the ladder, so its Mega starts in RU rather than in a
	// tier nothing else it could face is in.
	if (at < 0) return 'RU';
	return LADDER[Math.max(0, at - 1)];
}

/**
 * Put the tiers in.
 *
 * `tier` and `natDexTier` are both set: the first is what a ninth-generation
 * format reads and the second is what National Dex reads, and the RP tiers are
 * built on National Dex, so the one that matters here is the second. They are
 * kept the same rather than allowed to drift, because two numbers describing
 * one Pokemon is how a Pokemon ends up legal in one place and not its mirror.
 */
exports.applyZaMegas = (Pokedex, FormatsData) => {
	const assigned = {};
	for (const [id, species] of Object.entries(Pokedex)) {
		const data = FormatsData[id];
		if (!data || data.isNonstandard !== 'Future') continue;
		if (!species.baseSpecies || species.baseSpecies === species.name) continue;

		const baseId = String(species.baseSpecies).toLowerCase().replace(/[^a-z0-9]+/g, '');
		const base = FormatsData[baseId];
		const bst = Object.values(species.baseStats || {}).reduce((total, stat) => total + stat, 0);
		const tier = tierFor(bst, base && base.natDexTier);

		data.tier = tier;
		data.natDexTier = tier;
		// The tag comes off last, so a Mega is never briefly legal and untiered.
		data.isNonstandard = null;
		assigned[id] = tier;
	}
	return assigned;
};

exports.ZA_STONES = ZA_STONES;
exports.tierFor = tierFor;
exports.LADDER = LADDER;
