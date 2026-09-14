'use strict';
/**
 * Does the paper scorer agree with the tiers we already know?
 *
 *   node scripts/check-strength.js            # how it lines up, and the Z-A Megas
 *   node scripts/check-strength.js Chandelure-Mega Zamazenta
 *
 * The scorer exists for Pokemon nobody has played, so it cannot be checked
 * against them. It can be checked against everybody else: Smogon has spent
 * twenty years deciding what is Uber and what is NU, and a scorer that puts
 * Blissey in Ubers is wrong however sensible its reasoning looked.
 *
 * This prints the average score per real tier - which should climb - and then
 * the Z-A Megas, which is the answer being bought.
 */

const { Dex } = require('pokemon-showdown');
const { paperStrength, paperTier } = require('../src/paper-strength');

const dex = Dex.forFormat('gen9nationaldex');
const named = process.argv.slice(2);

if (named.length) {
	for (const name of named) {
		const species = dex.species.get(name);
		if (!species.exists) { console.log(`${name}: no such Pokemon`); continue; }
		const score = paperStrength(dex, species);
		console.log(`${species.name.padEnd(24)} ${String(score).padStart(6)}  -> ${paperTier(score)}  ` +
			`(real tier: ${species.tier || '-'})`);
	}
	process.exit(0);
}

/* --------------------------------------------- against the tiers we do know */

const TIERS = ['AG', 'Uber', 'OU', 'UUBL', 'UU', 'RUBL', 'RU', 'NUBL', 'NU', 'PUBL', 'PU', 'ZU', 'NFE', 'LC'];
const buckets = new Map(TIERS.map(tier => [tier, []]));

for (const species of dex.species.all()) {
	if (!species.exists || species.isNonstandard) continue;
	const tier = String(species.tier || '').replace(/^\(|\)$/g, '');
	if (!buckets.has(tier)) continue;
	buckets.set(tier, [...buckets.get(tier), { name: species.name, score: paperStrength(dex, species) }]);
}

console.log('real tier   n     mean   median   what the scorer would call the median');
for (const tier of TIERS) {
	const rows = buckets.get(tier);
	if (!rows || rows.length < 5) continue;
	const scores = rows.map(r => r.score).sort((a, b) => a - b);
	const mean = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10;
	const median = scores[Math.floor(scores.length / 2)];
	console.log(
		tier.padEnd(12) + String(rows.length).padStart(4) + String(mean).padStart(8) +
		String(median).padStart(9) + '   ' + paperTier(median)
	);
}

/* ------------------------------------------------------------ the Z-A Megas */

const za = [];
for (const species of dex.species.all()) {
	if (!species.exists || !species.name.includes('-Mega')) continue;
	// The ones this server unlocked: they carry no real tier, because no ladder
	// has ever run them.
	const score = paperStrength(dex, species);
	za.push({ name: species.name, score, tier: species.tier || '', base: species.baseSpecies });
}
za.sort((a, b) => b.score - a.score);

console.log(`\n${za.length} Mega formes, strongest first (paper tier in brackets):`);
for (const row of za.slice(0, 20)) {
	console.log(`  ${row.name.padEnd(26)} ${String(row.score).padStart(6)}  [${paperTier(row.score)}]` +
		(row.tier ? `  Smogon says ${row.tier}` : ''));
}
console.log('  ...');
for (const row of za.slice(-8)) {
	console.log(`  ${row.name.padEnd(26)} ${String(row.score).padStart(6)}  [${paperTier(row.score)}]` +
		(row.tier ? `  Smogon says ${row.tier}` : ''));
}
