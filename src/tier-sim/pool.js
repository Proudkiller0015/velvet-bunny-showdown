'use strict';
/**
 * Who gets tiered: every Pokemon a player could bring, and the tier it is in now.
 *
 * "Every Pokemon" is narrower than every entry in the dex, and each cut has a
 * reason:
 *
 *   - Illegal everywhere (natDexTier Illegal, our Custom joke entries like
 *     Samantha, CAP, Let's Go, Gigantamax): nobody can bring them to a tiered
 *     battle, so a tier for them answers nothing.
 *   - AG: already above Ubers. Placing them is a ban-list decision, and every
 *     game they are in is decided by them, which teaches the model nothing
 *     about the other eleven Pokemon.
 *   - Battle-only formes (Mimikyu-Busted, Darmanitan-Zen, Zacian-Crowned) are
 *     the same Pokemon as their base, which is what gets brought. Megas and
 *     Primals are the exception: they are battle-only too, but the owner asked
 *     for them as entries of their own, and "Garchomp with Garchompite" really
 *     is a different Pokemon to plain Garchomp.
 *   - Arceus and Silvally type formes are one Pokemon with a different plate or
 *     memory; seventeen near-copies of an Uber would spend a sixth of the whole
 *     budget on one line. The base forme stands for them.
 *   - Not-fully-evolved Pokemon unless viable (below).
 *
 * The current tier is the one the RP ladders already use, computed the same way
 * as lowTierOf() in config/custom-formats.js: National Dex's tier when it is
 * RU or above, otherwise Smogon's own lower tier from the newest generation
 * that has one. That function is not exported (the file is copied into the
 * package and loaded by the simulator), so it is mirrored here; the unit test
 * pins a few Pokemon so the two cannot drift silently.
 */

const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const LOW_LADDER = ['AG', 'Uber', 'OU', 'UUBL', 'UU', 'RUBL', 'RU', 'NUBL', 'NU', 'PUBL', 'PU', 'ZUBL', 'ZU', 'NFE', 'LC'];

/** "(PU)" means ranked below PU: two rungs down, as lowTierOf() does it. */
function unparen(tier) {
	if (!tier || !tier.startsWith('(') || !tier.endsWith(')')) return tier;
	const i = LOW_LADDER.indexOf(tier.slice(1, -1));
	return i >= 0 ? LOW_LADDER[Math.min(i + 2, LOW_LADDER.indexOf('ZU'))] : '';
}

function currentTier(dex, species) {
	const nd = unparen(species.natDexTier);
	if (LOW_LADDER.indexOf(nd) >= 0 && LOW_LADDER.indexOf(nd) < LOW_LADDER.indexOf('RU')) return nd;
	for (let g = 9; g >= 1; g--) {
		let s;
		try { s = g === dex.gen ? species : dex.mod(`gen${g}`).species.get(species.id); } catch (e) { s = null; }
		if (!s || !s.exists) continue;
		const tier = unparen(s.tier || '');
		if (LOW_LADDER.includes(tier)) return tier;
	}
	return species.nfe ? 'NFE' : 'RU';
}

/**
 * The tiers as the report speaks of them. A BL tier is played in the tier above
 * (UUBL Pokemon are banned from UU, so they are OU Pokemon), which is where its
 * "current" place is compared - but its prior sits between the two, because
 * being the weakest of the OU Pokemon is exactly what UUBL says.
 */
const MAIN_TIERS = ['Uber', 'OU', 'UU', 'RU', 'NU', 'PU', 'ZU', 'NFE'];
const PLAYED_IN = { UUBL: 'OU', RUBL: 'UU', NUBL: 'RU', PUBL: 'NU', ZUBL: 'PU', LC: 'NFE' };
const RANK = { Uber: 7, OU: 6, UUBL: 5.5, UU: 5, RUBL: 4.5, RU: 4, NUBL: 3.5, NU: 3, PUBL: 2.5, PU: 2, ZUBL: 1.5, ZU: 1, NFE: 0, LC: 0 };
const playedIn = tier => PLAYED_IN[tier] || tier;

const EXCLUDED_NONSTANDARD = new Set(['CAP', 'LGPE', 'Gigantamax', 'Custom', 'Future', 'Unobtainable']);
const TYPE_FORMES = new Set(['arceus', 'silvally']);

/**
 * Worth tiering while not fully evolved: what an Eviolite makes of it.
 *
 * Eviolite is 1.5x to both defences, so the useful measure is how much damage
 * it takes to remove: HP times each defence, boosted. The line is set so the
 * NFEs Smogon plays (Porygon2, Dusclops, Chansey, Doublade, Gligar, Rhydon,
 * Piloswine, Magneton, Vigoroth, Scyther...) are in and the first stages are
 * out. A Pokemon Smogon ranked above NFE on its own is in whatever its stats.
 */
function evioliteViable(species) {
	const b = species.baseStats;
	const bst = b.hp + b.atk + b.def + b.spa + b.spd + b.spe;
	const bulk = (b.hp + 60) * (b.def + b.spd) * 1.5;   // +60 stands in for level-100 HP's flat part
	const power = Math.max(b.atk, b.spa);
	return (bst >= 405 && bulk >= 35000) || (bst >= 420 && bulk >= 31000) || (bst >= 450 && (power >= 90 || bulk >= 29000));
}

/** One entry of the pool: what gets rated, and how to bring it. */
function entryFor(dex, species, tier) {
	const mega = !!(species.isMega || species.isPrimal);
	// battleOnly can be a list (Zygarde-Mega comes from Zygarde or Zygarde-10%): the first will do.
	const from = Array.isArray(species.battleOnly) ? species.battleOnly[0] : species.battleOnly;
	const base = mega ? dex.species.get(from || species.baseSpecies) : species;
	return {
		name: species.name,
		id: species.id,
		// What goes on the team sheet: the base Pokemon, holding its stone.
		species: base.name,
		item: species.requiredItem || (mega && species.requiredItems && species.requiredItems[0]) || null,
		mega,
		num: species.num,
		tier,
		played: playedIn(tier),
		nfe: !!species.nfe,
		types: species.types.slice(),
		bst: Object.values(species.baseStats).reduce((a, b) => a + b, 0),
	};
}

function buildPool(dex, { includeNfe = true } = {}) {
	const out = [];
	const seen = new Set();
	const seenSig = new Set();
	for (const species of dex.species.all()) {
		if (!species.exists || seen.has(species.id)) continue;
		seen.add(species.id);
		if (EXCLUDED_NONSTANDARD.has(species.isNonstandard)) continue;
		if (species.natDexTier === 'Illegal' || species.tier === 'CAP' || /^Pokestar/.test(species.name)) continue;
		if (species.battleOnly && !species.isMega && !species.isPrimal) continue;
		if (TYPE_FORMES.has(toID(species.baseSpecies)) && species.forme) continue;
		if (/Totem|Gmax|Starter/.test(species.forme || '')) continue;
		const tier = currentTier(dex, species);
		if (tier === 'AG') continue;
		if (species.nfe) {
			if (!includeNfe) continue;
			if (RANK[tier] <= 0 && !evioliteViable(species)) continue;
		}
		// A Mega whose stone the dex cannot find cannot be brought.
		const entry = entryFor(dex, species, tier);
		if (entry.mega && (!entry.item || !dex.items.get(entry.item).exists)) continue;
		/*
		 * One entry per Pokemon that actually plays differently. Twenty Vivillon
		 * patterns, the Alcremie flavours, Minior's colours, the Pikachu caps and
		 * the three Tatsugiri Megas have the same stats, types and abilities as a
		 * sibling: separate entries would only split one Pokemon's games twenty
		 * ways. The first seen stands for the rest (the base forme comes first).
		 */
		const sig = [species.num, entry.mega, Object.values(species.baseStats).join(','), species.types.join('/'),
			Object.values(species.abilities).slice().sort().join('/')].join('|');
		if (seenSig.has(sig)) continue;
		seenSig.add(sig);
		out.push(entry);
	}
	return out.sort((a, b) => RANK[b.tier] - RANK[a.tier] || a.name.localeCompare(b.name));
}

module.exports = { buildPool, currentTier, evioliteViable, LOW_LADDER, MAIN_TIERS, RANK, PLAYED_IN, playedIn, unparen };
