'use strict';
/**
 * Work out what tier each Z-A Mega belongs in, once, and write it down.
 *
 *   node scripts/build-za-tiers.js
 *
 * Writes data/velvet/za-tiers.json, which data/velvet/za-megas.js reads.
 *
 * The tiering itself is src/paper-strength.js - read the sheet, score it, and
 * be honest that it is paper. What this file exists for is *when* that happens.
 * The scorer needs a working dex: a type chart to ask what resists what, and a
 * movepool to ask what the Pokemon can do. `applyZaMegas` runs in the middle of
 * the dex being built, where neither exists yet and asking for them is a loop.
 *
 * So it is measured here, on a machine with time to spare, and shipped as a
 * table. The server then reads fifty numbers instead of walking fifty movepools
 * on every boot, which on a host with 512MB is the difference that matters.
 *
 * Re-run it when the Megas change, when the scorer changes, or when a tier
 * decision turns out to be wrong - and the file says which of those it was,
 * because it records the score alongside the tier.
 */

const fs = require('fs');
const path = require('path');
const { Dex } = require('pokemon-showdown');
const { paperStrength, paperTier } = require('../src/paper-strength');

const OUT = path.join(__dirname, '..', 'data', 'velvet', 'za-tiers.json');
const dex = Dex.forFormat('gen9nationaldex');

/** The ladder, so "one above the base" has somewhere to step to. */
const LADDER = ['AG', 'Uber', 'OU', 'UUBL', 'UU', 'RUBL', 'RU', 'NUBL', 'NU', 'PUBL', 'PU', 'ZU'];
const RANK = ['AG', 'Uber', 'OU', 'UU', 'RU', 'NU', 'PU', 'ZU'];
const higher = (a, b) => {
	const x = RANK.indexOf(a), y = RANK.indexOf(b);
	if (x < 0) return b;
	if (y < 0) return a;
	return x <= y ? a : b;
};

const rows = {};
const listing = [];

for (const species of dex.species.all()) {
	if (!species.exists || !species.name.includes('-Mega')) continue;
	if (!species.baseSpecies || species.baseSpecies === species.name) continue;

	const base = dex.species.get(species.baseSpecies);
	const baseTier = String(base.natDexTier || base.tier || '').replace(/[()]/g, '');
	const bst = Object.values(species.baseStats || {}).reduce((n, stat) => n + stat, 0);
	const score = paperStrength(dex, species);

	/*
	 * Two answers, and the stronger one wins.
	 *
	 * The old rule - a step above the base form, or Uber at 700 - is a decent
	 * guess about a Mega in general and blind to this Mega in particular. The
	 * score reads the Pokemon. Taking the higher of the two errs upward, which
	 * is the right direction to err: a Mega too strong for its tier ruins that
	 * tier, and one too weak is merely unused.
	 */
	let byRules;
	if (baseTier === 'AG') byRules = 'AG';
	else if (baseTier === 'Uber' || bst >= 700) byRules = 'Uber';
	else {
		const at = LADDER.indexOf(baseTier);
		if (at >= 0) byRules = LADDER[Math.max(0, at - 1)].replace('BL', '');
		else if (bst >= 620) byRules = 'OU';
		else if (bst >= 570) byRules = 'UU';
		else byRules = 'RU';
	}
	/*
	 * The score promotes, it does not re-tier.
	 *
	 * Taking the higher of the two answers outright put forty-two of ninety-eight
	 * Megas into Ubers, which is not a tiering decision - it is deleting the
	 * Megas from every tier below it. The scorer is generous about a Mega
	 * because a Mega genuinely is a hundred base stats above its base form, and
	 * the thresholds were fitted to ordinary Pokemon.
	 *
	 * So it is used for the thing it is good at: spotting the handful that are a
	 * different weight class entirely. Ninety-two is a little above the strongest
	 * real Ubers score, and it catches Gengar, both Lucarios, Blaziken, Greninja,
	 * Chandelure, Magearna, Dragonite - which is the list anybody who plays these
	 * would write down. Everything else keeps the step-above-its-base rule.
	 */
	const PROMOTE = 92;
	const byPaper = paperTier(score);
	const tier = score >= PROMOTE ? higher(byRules, 'Uber') : byRules;

	rows[species.id] = { tier, score, bst, byRules, byPaper, base: base.name, baseTier: baseTier || null };
	listing.push({ name: species.name, ...rows[species.id] });
}

const file = {
	builtAt: new Date().toISOString(),
	how: 'the higher of: one tier above the base form, and src/paper-strength.js on the Mega itself',
	tiers: rows,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(file, null, 1));

listing.sort((a, b) => b.score - a.score);
const counts = {};
for (const row of listing) counts[row.tier] = (counts[row.tier] || 0) + 1;

console.log(`${listing.length} Mega formes -> ${OUT}`);
console.log('by tier: ' + Object.entries(counts).map(([tier, n]) => `${tier} ${n}`).join(', '));
console.log('\nwhere the two answers disagreed:');
let disagreed = 0;
for (const row of listing) {
	if (row.byRules === row.byPaper) continue;
	disagreed++;
	if (disagreed <= 18) {
		console.log(`  ${row.name.padEnd(26)} score ${String(row.score).padStart(6)}  ` +
			`rules said ${row.byRules.padEnd(5)} paper said ${row.byPaper.padEnd(5)} -> ${row.tier}`);
	}
}
console.log(`  (${disagreed} of ${listing.length} disagreed)`);
