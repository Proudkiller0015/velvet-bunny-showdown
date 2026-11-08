'use strict';
/**
 * Brings Showdown's own formats up to date with current Showdown, without touching RP.
 *
 * The npm package (0.11.11) is months behind Showdown's master: its Champions formats are
 * still Reg M-A and its tiers miss every shift since. What this takes from master, at the
 * commit pinned below:
 *
 *   - config/formats.ts            every official format's current definition
 *   - data/formats-data.ts         the tiers (the "tier shifted" metas)
 *   - data/mods/champions*         the Champions game's data and rules
 *   - data/random-battles/champions  its random sets
 *
 * They are transpiled to plain JS into upstream/ (committed), and scripts/setup-config.js
 * lays them into the package at every boot. Nothing else of the package changes: the base
 * Pokedex, moves, learnsets and rules stay as shipped.
 *
 * RP is pinned to how it was (data/frozen-base, config/frozen-official-formats.js): the RP
 * dex keeps the old tiers, and RP formats build on frozen copies of the official formats
 * they extend. Formats whose mod this package does not have are left out (upstream/SKIPPED).
 *
 * Usage: node scripts/sync-showdown.js [commit]   (default: the pinned one)
 */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const COMMIT = process.argv[2] || '567c1cedddeaa2f35576005d3bfd526cf4f8a13e';
const RAW = `https://raw.githubusercontent.com/smogon/pokemon-showdown/${COMMIT}/`;
const OUT = path.join(__dirname, '..', 'upstream');

const FILES = [
	'config/formats.ts',
	'data/formats-data.ts',
	...['abilities', 'conditions', 'formats-data', 'items', 'learnsets', 'moves', 'rulesets', 'scripts'].map(f => `data/mods/champions/${f}.ts`),
	...['formats-data', 'items', 'learnsets', 'moves', 'scripts'].map(f => `data/mods/championsregmb/${f}.ts`),
	'data/random-battles/champions/teams.ts',
	'data/random-battles/champions/sets.json',
	'data/random-battles/champions/doubles-sets.json',
];

/*
 * Engine calls current Showdown has and this package's engine does not, rewritten to what it has.
 * Found by listing every engine method the synced files call and checking it exists (7 Nov 2026).
 */
const COMPAT = [
	// resolveFaints({ lastFaintFirst, checkWinIfNoFaints, checkWin }) is the newer name of
	// faintMessages(lastFirst, forceCheck, checkWin), which does the same.
	[/this\.battle\.resolveFaints\(/g,
		'((o = {}) => this.battle.resolveFaints ? this.battle.resolveFaints(o) : this.battle.faintMessages(!!o.lastFaintFirst, !!o.checkWinIfNoFaints, o.checkWin !== false))('],
];

async function main() {
	fs.rmSync(OUT, { recursive: true, force: true });
	for (const file of FILES) {
		const res = await fetch(RAW + file);
		if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
		const text = await res.text();
		const dest = path.join(OUT, file.replace(/\.ts$/, '.js'));
		fs.mkdirSync(path.dirname(dest), { recursive: true });
		if (file.endsWith('.json')) {
			fs.writeFileSync(dest, text);
		} else {
			let { code } = await esbuild.transform(text, { loader: 'ts', format: 'cjs', platform: 'node', target: 'node18' });
			for (const [from, to] of COMPAT) code = code.replace(from, to);
			fs.writeFileSync(dest, `// Showdown ${COMMIT.slice(0, 8)}: ${file}, transpiled by scripts/sync-showdown.js. Do not edit.\n${code}`);
		}
		console.log(`${file} -> upstream/${file.replace(/\.ts$/, '.js')}`);
	}
	await baseAdditions();
	fs.writeFileSync(path.join(OUT, 'COMMIT'), `${COMMIT}\n`);
}

/** Loads one of current Showdown's base data files (plain data) without keeping it. */
async function upstreamTable(file, table) {
	const res = await fetch(`${RAW}data/${file}.ts`);
	if (!res.ok) throw new Error(`data/${file}.ts: HTTP ${res.status}`);
	const { code } = await esbuild.transform(await res.text(), { loader: 'ts', format: 'cjs', platform: 'node', target: 'node18' });
	const tmp = path.join(require('os').tmpdir(), `ps-upstream-${file}.js`);
	fs.writeFileSync(tmp, code);
	delete require.cache[tmp];
	return require(tmp)[table];
}

/*
 * The Champions mods are written against current Showdown's base data: an `inherit: true` entry
 * takes the rest from the base, and its Pokemon carry the base's abilities and stats. This
 * package's base predates some of it - Aura Guard did not exist, so Mega Lucario Z's ability came
 * out empty, and the Z-A Megas still had their pre-release guesses. So every base entry the
 * Champions data leans on that this package lacks or has differently is carried into the
 * Champions mod itself (base-additions.js), never into the base: RP and the other formats keep
 * the base they have.
 */
async function baseAdditions() {
	const ours = name => require(`pokemon-showdown/dist/data/${name}.js`);
	const dir = path.join(OUT, 'data', 'mods', 'champions');
	const modTables = { Abilities: 'abilities', Items: 'items', Moves: 'moves' };
	const out = { Pokedex: {}, Abilities: {}, Items: {}, Moves: {} };
	const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
	const upstream = {};
	for (const [table, file] of Object.entries({ ...modTables, Pokedex: 'pokedex' })) upstream[table] = await upstreamTable(file, table);
	// Entries the Champions mods inherit and this package's base does not have.
	for (const [table, file] of Object.entries(modTables)) {
		const base = ours(file)[table];
		for (const mod of ['champions', 'championsregmb']) {
			const p = path.join(OUT, 'data', 'mods', mod, `${file}.js`);
			if (!fs.existsSync(p)) continue;
			for (const [id, entry] of Object.entries(require(p)[table])) {
				if (entry.inherit && !base[id] && upstream[table][id]) out[table][id] = upstream[table][id];
			}
		}
	}
	// Pokemon whose abilities, stats or types current Showdown has differently, and the abilities they need.
	const dex = ours('pokedex').Pokedex;
	const abilities = ours('abilities').Abilities;
	for (const [id, entry] of Object.entries(upstream.Pokedex)) {
		if (!dex[id]) continue;
		const fields = {};
		for (const k of ['abilities', 'baseStats', 'types']) if (!same(entry[k], dex[id][k])) fields[k] = entry[k];
		if (!Object.keys(fields).length) continue;
		out.Pokedex[id] = { inherit: true, ...fields };
		for (const name of Object.values(entry.abilities)) {
			const aid = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
			if (!abilities[aid] && upstream.Abilities[aid]) out.Abilities[aid] = upstream.Abilities[aid];
		}
	}
	// Written as source: the entries hold functions.
	const source = obj => `{\n${Object.entries(obj).map(([id, e]) => `\t${JSON.stringify(id)}: ${entrySource(e)},`).join('\n')}\n}`;
	fs.writeFileSync(path.join(dir, 'base-additions.js'), [
		`// Showdown ${COMMIT.slice(0, 8)}: base data the Champions mods rely on that this package's base lacks or has`,
		'// differently (scripts/sync-showdown.js baseAdditions). Laid into the Champions mod only. Do not edit.',
		...Object.keys(out).map(t => `exports.${t} = ${source(out[t])};`),
		'',
	].join('\n'));
	// Each Champions data file takes them: a missing entry is added, an `inherit` one is completed from it.
	for (const [table, file] of Object.entries({ ...modTables, Pokedex: 'pokedex' })) {
		const p = path.join(dir, `${file}.js`);
		const head = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : `exports.${table} = {};\n`;
		fs.writeFileSync(p, `${head}
// Base data from current Showdown that this package lacks (base-additions.js, scripts/sync-showdown.js).
{
	const table = module.exports.${table};
	for (const [id, entry] of Object.entries(require('./base-additions.js').${table})) {
		if (!table[id]) table[id] = entry;
		else if (table[id].inherit && !entry.inherit) table[id] = { ...entry, ...table[id], inherit: undefined };
		else if (table[id].inherit) table[id] = { ...entry, ...table[id] };
	}
}
`);
	}
	console.log(`base additions -> ${Object.entries(out).map(([t, o]) => `${Object.keys(o).length} ${t}`).join(', ')}`);
}

/** An entry as source text, functions included. */
function entrySource(value) {
	if (typeof value === 'function') {
		const text = value.toString();
		// Methods print as `name(args) {...}`: make them function expressions.
		return /^(async\s+)?function\b|^\(|^[a-zA-Z_$][\w$]*\s*=>/.test(text) ? text : `function ${text.replace(/^(async\s+)?/, '')}`;
	}
	if (Array.isArray(value)) return `[${value.map(entrySource).join(', ')}]`;
	if (value && typeof value === 'object') return `{ ${Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${entrySource(v)}`).join(', ')} }`;
	return value === undefined ? 'undefined' : JSON.stringify(value);
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
