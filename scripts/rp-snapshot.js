'use strict';
/**
 * A fingerprint of everything RP decides with: per RP dex, every species' tier fields and
 * legality; per RP / custom format, its whole rule table and the result of validating every
 * species' default set. Written before and after a Showdown update (scripts/sync-showdown.js)
 * to prove RP did not move: `node scripts/rp-snapshot.js out.json`, then `--compare a.json b.json`.
 */
const fs = require('fs');

if (process.argv[2] === '--compare') {
	const [a, b] = process.argv.slice(3).map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
	let diffs = 0;
	for (const section of new Set([...Object.keys(a), ...Object.keys(b)])) {
		const x = a[section] || {};
		const y = b[section] || {};
		for (const key of new Set([...Object.keys(x), ...Object.keys(y)])) {
			if (JSON.stringify(x[key]) === JSON.stringify(y[key])) continue;
			if (diffs++ < 40) console.log(`${section} ${key}:\n  before ${JSON.stringify(x[key])}\n  after  ${JSON.stringify(y[key])}`);
		}
	}
	console.log(diffs ? `${diffs} difference(s)` : 'identical');
	process.exit(diffs ? 1 : 0);
}

const { Dex, TeamValidator } = require('pokemon-showdown');
const out = { species: {}, rules: {}, legal: {} };
const mods = ['gen9rp', 'gen8rp', 'gen7rp', 'gen6rp', 'gen5rp', 'gen4rp', 'gen3rp', 'gen2rp', 'gen1rp', 'gen9draftrp'];
for (const mod of mods) {
	const dex = Dex.mod(mod);
	for (const s of dex.species.all()) {
		out.species[`${mod} ${s.id}`] = [s.tier, s.natDexTier, s.doublesTier, s.isNonstandard || '', s.rpLowTier || ''];
	}
}
// Every format that is not Showdown's own: RP, its drafts, and the rest of ours.
const custom = require('pokemon-showdown/dist/config/custom-formats.js').Formats.filter(f => f.name && !/ \(RP\)$/.test(f.name));
for (const f of custom) {
	const format = Dex.formats.get(f.name);
	const table = Dex.formats.getRuleTable(format);
	const plain = text => text.replace(/ \(RP\)/g, '').replace(/^(gen\d[a-z0-9]+?)rp=/, '$1=');
	out.rules[format.id] = [...table.entries()].map(([k, v]) => plain(`${k}=${v}`)).sort().concat(
		[...table.complexBans || []].map(b => plain(`cb:${JSON.stringify(b)}`)), [`min:${table.minSourceGen}`, `pick:${table.pickedTeamSize}`]);
	if (format.team) continue;
	const validator = new TeamValidator(format);
	const dex = validator.dex;
	const verdicts = {};
	for (const s of dex.species.all()) {
		if (s.gen > dex.gen) continue;
		const set = { species: s.name, ability: Object.values(s.abilities)[0], moves: [], item: '', level: 100, evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 } };
		const problems = validator.validateSet(set, {}) || [];
		// Only whether it is allowed, and why not: move/EV complaints say nothing about tiers.
		// The frozen official formats RP builds on are named "<official> (RP)"; a ban reads the same either way.
		verdicts[s.id] = problems.filter(p => /banned|tier|not allowed|does not exist|nonstandard|unreleased|illegal/i.test(p)).join(' | ').replace(/ \(RP\)/g, '');
	}
	out.legal[format.id] = verdicts;
}
fs.writeFileSync(process.argv[2] || 'rp-snapshot.json', JSON.stringify(out));
console.log(`${Object.keys(out.species).length} species entries, ${custom.length} formats`);
