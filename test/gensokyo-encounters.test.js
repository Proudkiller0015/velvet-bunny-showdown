'use strict';
/**
 * Gensokyo's encounter tables and the Boneka (src/encounter-tables/gensokyo.js).
 *
 * The owner's rules (21 Oct 2026): normal Pokemon that fit each place, and every Touhou
 * Pokemon (a "Boneka") a 1% encounter at its canon home - the legendary ones excluded,
 * and Touhou Pokemon in Gensokyo only. This checks the table against the map, every
 * species against the rules, the weights against the 1%, a thousand rolls a place
 * against the weights, and real wild battles against a Boneka, ball and all.
 *
 *   node test/gensokyo-encounters.test.js
 */

require('../scripts/setup-config');
const fs = require('fs');
const path = require('path');
const { BattleStream, getPlayerStreams, Teams } = require('pokemon-showdown');
const E = require('../src/encounters');
const R = require('../src/rarity');
const S = require('../src/rp-server');
const Dex = require('../src/rp-dex')();
const G = require('../src/encounter-tables/gensokyo');
const K = require('../src/encounter-tables/kagura');
const SINNOH = require('../src/encounter-tables/sinnoh');
const touhou = require('pokemon-showdown/dist/data/velvet/touhou.js');

let failed = 0;
let passed = 0;
const check = (ok, what) => { if (ok) passed++; else { failed++; console.log(`FAIL ${what}`); } };

/* A seeded generator, so the thousand-roll counts are the same every run. */
function mulberry32(seed) {
	return () => {
		seed |= 0; seed = seed + 0x6D2B79F5 | 0;
		let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}

const places = Object.entries(G.locations);
/** Every place and spot as the wild sees it: { where, place } with the spot's lists swapped in (rp-server). */
function wildViews() {
	const out = [];
	for (const [id, place] of places) {
		const spotChannels = Object.keys(place.spots || {});
		if ((place.wild || []).some(ch => !spotChannels.includes(ch))) out.push({ where: id, place });
		for (const [ch, spot] of Object.entries(place.spots || {})) {
			out.push({ where: `${id}#${ch}`, place: { ...place, types: spot.types || place.types, common: spot.common || place.common, rare: spot.rare || place.rare, boneka: spot.boneka || place.boneka } });
		}
	}
	return out;
}

// ------------------------------------------------------------------ the map

{
	check(G.region === 'gensokyo', 'the table says it is Gensokyo');
	const mapFile = path.join(__dirname, '..', '..', 'rp-bot', 'data', 'map-places.json');
	const expected = ['village', 'myouren', 'hakurei', 'forestofmagic', 'kourindou', 'mistylake', 'scarletmansion', 'bamboo', 'eientei',
		'genbu', 'tenguvillage', 'moriya', 'netherworld', 'hakugyokurou', 'windcave', 'formercapital', 'chireiden', 'gardenofsun',
		'namelesshill', 'muenzuka', 'r301', 'r302', 'r303', 'r304', 'r305', 'r306'];
	const key = id => id.replace(/^r(\d+)$/, 'route-$1');   // the map calls routes r301, the tables route-301
	for (const id of expected) check(!!G.locations[key(id)], `a table for ${id}`);
	check(places.length === expected.length, `no table for a place the map does not have (${places.length})`);
	// The bot's map, when it is beside this checkout: every Gensokyo channel is in its place's table.
	if (fs.existsSync(mapFile)) {
		const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
		for (const [ch, p] of Object.entries(map)) {
			if (p.region !== 'gensokyo') continue;
			const place = G.locations[key(p.id)];
			check(!!place && place.channels.includes(ch), `#${ch} is in ${p.id}'s table`);
		}
	}
	for (const [id, place] of places) {
		check(place.wild.length > 0, `${id} has wild channels`);
		for (const ch of [...place.wild, ...(place.noTrainers || []), ...Object.keys(place.spots || {})]) check(place.channels.includes(ch), `${id}: #${ch} is one of its channels`);
		for (const c of place.trainers) check(!!E.findClass(c), `${id}: trainer class ${c}`);
		for (const t of place.types) check(Dex.types.get(t).exists, `${id}: type ${t}`);
		// The server finds the place from any of its channels, whatever region the bot names.
		for (const ch of place.channels) {
			const found = S.placeFor('kagura', ch);
			check(!!found && found.id === id && found.region === 'gensokyo', `#${ch} finds ${id} in Gensokyo`);
		}
	}
	// Kagura's channels still find Kagura.
	check(S.placeFor('kagura', 'route-1').region === 'kagura' && S.placeFor('kagura', 'sakura-beach').id === 'sakura', 'Kagura channels find Kagura');
}

// ------------------------------------------------------------- the species

const HEADLINE = ['starter', 'pseudo'];
const NEVER = ['ub', 'paradox', 'legendary', 'mythical', 'boxart'];
const headliners = new Map();
for (const { where, place } of wildViews()) {
	for (const key of ['common', 'rare']) {
		for (const name of place[key] || []) {
			const s = Dex.species.get(name);
			check(s.exists, `${where}: ${name} exists`);
			if (!s.exists) continue;
			check(E.encounterable(s), `${where}: ${name} can be met in the wild`);
			check(!E.isLegendary(s) && s.tier !== 'Touhou', `${where}: ${name} is an ordinary Pokemon`);
			const root = E.rootOf(s);
			check(E.lineOf(root).length > 0, `${where}: ${name}'s line is in the wild`);
			const cls = R.classOf(root.name);
			check(!NEVER.includes(cls) && !R.PARADOXES.has(s.id), `${where}: ${name} is no legendary, mythical, Ultra Beast or Paradox (${cls})`);
			if (key === 'common') check(!HEADLINE.includes(cls), `${where}: ${name} (${cls}) belongs in rare, not common`);
			if (HEADLINE.includes(cls)) headliners.set(root.id, new Set([...(headliners.get(root.id) || []), where.split('#')[0]]));
		}
		check(new Set(place[key] || []).size === (place[key] || []).length, `${where}: no species twice in ${key}`);
	}
}
for (const [id, at] of headliners) check(at.size <= 2, `starter/pseudo ${id} at two places at most (${[...at]})`);

// ---------------------------------------------------------------- the Boneka

const LEGENDS = new Set(touhou.LEGENDS);
const bases = touhou.SPECIES;
const homes = new Map();
for (const { where, place } of wildViews()) {
	for (const name of place.boneka || []) {
		const s = Dex.species.get(name);
		check(s.exists && s.tier === 'Touhou' && s.baseSpecies === s.name, `${where}: ${name} is a Touhou Pokemon's base species`);
		check(E.isBoneka(s), `${where}: ${name} is a Boneka (not legendary)`);
		check(E.encounterable(s, { region: 'gensokyo' }) && !E.encounterable(s) && !E.encounterable(s, { region: 'kagura' }), `${where}: ${name} is met in Gensokyo only`);
		homes.set(s.id, [...(homes.get(s.id) || []), where]);
	}
	check(new Set(place.boneka || []).size === (place.boneka || []).length, `${where}: no Boneka twice`);
}
for (const id of bases) {
	if (LEGENDS.has(id)) check(!homes.has(id), `legendary ${id} is nowhere in the wild`);
	else check(homes.has(id), `Boneka ${id} lives somewhere`);
}
// The legendary list: tagged in the dex, the same in rarity.js (the RP bot's copy), base species only.
check([...LEGENDS].every(id => bases.includes(id)), 'every legendary is a Touhou base species');
check(LEGENDS.size === R.TOUHOU_LEGENDS.size && [...LEGENDS].every(id => R.TOUHOU_LEGENDS.has(id)), 'touhou.js LEGENDS and rarity.js TOUHOU_LEGENDS agree');
for (const id of Object.keys(require('pokemon-showdown/dist/data/velvet/touhou-data.json').species)) {
	const s = Dex.species.get(id);
	const legend = LEGENDS.has(E.toID(s.baseSpecies));
	check(E.isLegendary(s) === legend, `${s.name}: isLegendary ${legend}`);
	check(R.classOf(s.name) === (legend ? 'legendary' : 'touhou'), `${s.name}: rarity class ${legend ? 'legendary' : 'touhou'}`);
	check(E.catchRate(s) === E.BONEKA_CATCH_RATE, `${s.name}: the Boneka catch rate`);
}
// The rarity ladder reads the same without the server's dex (the RP bot's case).
check(R.touhouClass(null, 'Cirno') === 'touhou' && R.touhouClass(null, 'Hecatia-Earth') === 'legendary' && R.touhouClass(null, 'Pikachu') === null, 'rarity works from names alone');

// -------------------------------------------------------- nowhere but Gensokyo

for (const [region, tables] of [['kagura', K], ['sinnoh', SINNOH]]) {
	for (const [id, place] of Object.entries(tables.locations)) {
		const views = [place, ...Object.values(place.spots || {})];
		const names = views.flatMap(v => [...(v.common || []), ...(v.rare || []), ...(v.boneka || [])]);
		check(!names.some(n => Dex.species.get(n).tier === 'Touhou'), `${region}/${id} names no Touhou Pokemon`);
		check(views.every(v => !v.boneka), `${region}/${id} has no Boneka list`);
	}
}
// Even a table that named one would not get it outside Gensokyo, nor would the type pools.
check(E.bonekaOf({ boneka: ['Cirno', 'Reimu Hakurei'] }, 'kagura').length === 0, 'a Kagura table cannot hold Boneka');
check(E.bonekaOf({ boneka: ['Cirno', 'Yukari Yakumo'] }, 'gensokyo').map(s => s.id).join() === 'cirno', 'a legendary is dropped even from a Gensokyo list');
{
	const rng = mulberry32(7);
	let touhouSeen = 0;
	for (const [, place] of Object.entries(K.locations).filter(([, p]) => p.wild.length).slice(0, 12)) {
		for (let i = 0; i < 60; i++) {
			const w = E.rollWild({ place: { ...place, boneka: ['Cirno'] }, badges: 4, rng, region: 'kagura' });
			if (w.team.some(m => Dex.species.get(m.species).tier === 'Touhou')) touhouSeen++;
		}
	}
	check(touhouSeen === 0, 'no Touhou Pokemon in 720 Kagura rolls');
	// Kagura's trainers never bring one either (they draw from the same line pools), the Gap Wanderer aside.
	let inTeams = 0;
	for (let i = 0; i < 30; i++) {
		const t = E.rollTrainer({ place: K.locations.ghost, badges: 8, rng, region: 'kagura' });
		if (t.classId !== 'gapwanderer' && t.team.some(m => Dex.species.get(m.species).tier === 'Touhou')) inTeams++;
	}
	check(inTeams === 0, 'no Touhou Pokemon on Kagura route trainers');
}

// ---------------------------------------------------------- the weights: 1% each

for (const { where, place } of wildViews()) {
	const boneka = place.boneka || [];
	for (const badges of [0, 4, 8]) {
		for (const now of [Date.parse('2026-10-28T23:00:00Z'), Date.parse('2026-05-10T12:00:00Z')]) {
			const pool = E.wildPool({ place, badges, now, region: 'gensokyo' });
			const total = pool.entries.reduce((n, e) => n + e.w, 0);
			check(Math.abs(total - 1) < 1e-9, `${where} b${badges}: weights add up to 1 (${total})`);
			const each = pool.entries.filter(e => pool.boneka.has(e.item.id));
			check(each.length === boneka.length, `${where} b${badges}: all ${boneka.length} Boneka in the pool`);
			check(each.every(e => Math.abs(e.w - 0.01) < 1e-12), `${where} b${badges}: each Boneka is exactly 1%`);
			check(pool.entries.every(e => e.w >= 0), `${where} b${badges}: no negative weight`);
		}
	}
}

// ---------------------------------------------------- a thousand rolls a place

for (const { where, place } of wildViews()) {
	const n = (place.boneka || []).length;
	const rng = mulberry32(where.length * 7919 + n);
	const ROLLS = 1000;
	let met = 0;
	let doubles = 0;
	for (let i = 0; i < ROLLS; i++) {
		const w = E.rollWild({ place, badges: 3, rng, region: 'gensokyo' });
		if (w.team.some(m => m.boneka)) {
			met++;
			if (w.team.length !== 1) doubles++;
		}
	}
	// Binomial: n% of 1000, within four standard deviations (and a count of slack).
	const p = n / 100;
	const sd = Math.sqrt(ROLLS * p * (1 - p));
	const ok = Math.abs(met - ROLLS * p) <= 4 * sd + 1;
	check(ok, `${where}: ${met}/${ROLLS} Boneka against ${n}% expected`);
	check(doubles === 0, `${where}: a Boneka is always met alone`);
}

// ------------------------------------------------------------ the server's roll

{
	const deps = { isOnline: () => true, spawn: () => true };
	const ask = (extra) => S.requestEncounter({ showdown: `GensoTester${Math.random()}`, region: 'kagura', badges: 2, kind: 'wild', ...extra }, deps);
	const a = ask({ channel: 'misty-lake' });
	check(a.ok && a.encounter.place === 'Misty Lake', 'the server rolls Misty Lake for #misty-lake, whatever region the bot names');
	const summon = ask({ channel: 'voile-library', summon: { kind: 'wild', species: 'Patchouli Knowledge', level: 20 } });
	check(summon.ok && summon.encounter.pokemon[0].species === 'Patchouli Knowledge', 'staff can summon a Boneka in Gensokyo');
	check(summon.ok && summon.encounter.rare === true, 'a Boneka is a rare encounter (the bot shows the 🌟 line)');
	const kagura = ask({ channel: 'route-1', summon: { kind: 'wild', species: 'Cirno', level: 20 } });
	check(!kagura.ok, 'but not in Kagura');
	check(S.freeCatch({ caught: 0 }, Dex.species.get('Cirno')) === false, "a new player's free catches never land on a Boneka");
	// Caught, it can go on a team: the box check knows the Touhou Pokemon and their formes.
	const enc = { box: [{ species: 'Keine', level: 30 }, { species: 'Cirno', level: 30 }], badges: 2 };
	check(S.checkTeam(enc, [{ species: 'Keine-Hakutaku', level: 30 }, { species: 'Cirno', level: 30 }]).ok, 'a caught Keine covers Keine-Hakutaku');
	check(!S.checkTeam(enc, [{ species: 'Reimu Hakurei', level: 30 }]).ok, 'a Boneka not in the box is refused');
}

// ------------------------------------------------------------------ trainers

{
	const rng = mulberry32(306);
	const isB = m => E.isBoneka(m.species);
	// Gensokyo is hard mode: every trainer brings six, at least one a Boneka, none legendary.
	const gensokyo = places.filter(([, p]) => p.trainers.length);
	const gyms = Object.keys(E.GYM_TYPES).filter(ch => places.some(([, p]) => p.channels.includes(ch)));
	check(gyms.length === 8, `Gensokyo's eight gyms have types (${gyms.length})`);
	let ok6 = 0, okB = 0, legend = 0, n = 0;
	for (let i = 0; i < 100; i++) {
		const [, place] = gensokyo[i % gensokyo.length];
		const gym = i % 5 === 0 ? gyms[(i / 5) % gyms.length] : null;
		const at = gym ? E.gymPlace(G.locations[places.find(([, p]) => p.channels.includes(gym))[0]], gym) : place;
		const t = E.rollTrainer({ place: at, badges: i % 9, rng, region: 'gensokyo' });
		n++;
		if (t.team.length === 6) ok6++;
		if (t.team.some(isB)) okB++;
		if (t.team.some(m => E.isLegendary(m.species) && Dex.species.get(m.species).tier === 'Touhou')) legend++;
	}
	check(ok6 === n, `every Gensokyo trainer has six Pokemon (${ok6}/${n})`);
	check(okB === n, `every Gensokyo trainer has a Boneka (${okB}/${n})`);
	check(legend === 0, 'no legendary Touhou Pokemon on a trainer');
	// A gym trainer's Boneka fits the gym where one can: the Hakurei gym (Fairy) brings a Fairy one.
	{
		const t = E.rollTrainer({ place: E.gymPlace(G.locations.hakurei, 'hakurei-gym'), badges: 3, rng, region: 'gensokyo' });
		check(t.team.filter(isB).some(m => Dex.species.get(m.species).types.includes('Fairy')), 'the Hakurei gym brings a Fairy Boneka');
	}
	// Kagura: no Boneka, except on a Gap Wanderer; team sizes as ever.
	const kagura = Object.values(K.locations).filter(p => p.trainers.length);
	let kB = 0, kGap = 0, kSmall = 0;
	for (let i = 0; i < 100; i++) {
		const t = E.rollTrainer({ place: kagura[i % kagura.length], badges: i % 3, rng, region: 'kagura' });
		if (t.classId === 'gapwanderer') { kGap++; continue; }
		if (t.team.some(isB)) kB++;
		if (t.team.length < 6) kSmall++;
	}
	check(kB === 0, `no Boneka on Kagura trainers (${kB})`);
	check(kSmall > 0, 'Kagura trainers keep their badge-sized teams');
	// The Gap Wanderer: six different Boneka, none legendary, in either region.
	for (const region of ['kagura', 'gensokyo']) {
		for (const badges of [0, 8]) {
			const place = region === 'kagura' ? K.locations['route-1'] : G.locations['route-301'];
			const t = E.rollTrainer({ place, badges, rng, region, classId: 'gapwanderer' });
			check(t.className === 'Gap Wanderer' && t.team.length === 6 && t.team.every(isB), `${region} b${badges}: a Gap Wanderer brings six Boneka`);
			check(new Set(t.team.map(m => m.species)).size === 6, `${region} b${badges}: six different ones`);
			check(!!t.intro, `${region}: the Gap Wanderer has an opening line`);
		}
	}
	// Its odds: off the routes' class roll, rising with badges, and never in a gym.
	const rate = (badges, place) => {
		const r = mulberry32(badges * 101 + 7);
		let gap = 0;
		for (let i = 0; i < 20000; i++) if (E.trainerClassFor({ place, badges, rng: r }).id === 'gapwanderer') gap++;
		return gap / 20000;
	};
	const [r0, r4, r8] = [0, 4, 8].map(b => rate(b, K.locations['route-1']));
	check(r0 < r4 && r4 < r8, `the Gap Wanderer gets likelier with badges (${r0}, ${r4}, ${r8})`);
	check(Math.abs(r0 - 0.003) < 0.0015 && Math.abs(r8 - 0.027) < 0.005, 'about 0.3% at no badges, 2.7% at eight');
	check(rate(8, G.locations['route-301']) > 0.015, 'it wanders Gensokyo too');
	check(rate(8, E.gymPlace(G.locations.hakurei, 'hakurei-gym')) === 0, 'never in a gym');
	// Kagura's wild tables still never hold a Boneka (the Gap Wanderer is the one exception).
	check(Object.values(K.locations).every(p => !E.bonekaOf(p, 'kagura').length), 'Kagura wild tables: no Boneka');
}

// --------------------------------------------------------- real wild battles

function mine(species = 'Pikachu', level = 40, moves = ['Thunder Wave', 'Quick Attack', 'Thunderbolt']) {
	return Teams.pack([{ species, level, moves, ability: Dex.species.get(species).abilities[0], evs: {}, ivs: {} }]);
}
/* catching.test.js's harness: p1 follows `plan`, the wild side uses its first move. */
async function play({ wild, plan, turns = 30, seed }) {
	const stream = new BattleStream();
	const streams = getPlayerStreams(stream);
	const log = [];
	const errors = [];
	let turn = 0;
	void (async () => { for await (const chunk of streams.spectator) log.push(chunk); })();
	void (async () => {
		for await (const chunk of streams.p1) {
			for (const line of chunk.split('\n')) {
				if (line.startsWith('|error|')) errors.push(line);
				if (!line.startsWith('|request|')) continue;
				const request = JSON.parse(line.slice(9));
				if (request.wait) continue;
				if (request.teamPreview || request.forceSwitch) { void streams.p1.write('default'); continue; }
				turn++;
				void streams.p1.write(turn > turns ? 'move 1' : plan(turn, request));
			}
		}
	})();
	void (async () => {
		for await (const chunk of streams.p2) {
			for (const line of chunk.split('\n')) {
				if (!line.startsWith('|request|')) continue;
				const request = JSON.parse(line.slice(9));
				if (request.wait) continue;
				if (request.teamPreview) { void streams.p2.write('default'); continue; }
				void streams.p2.write('move 1');
			}
		}
	})();
	void streams.omniscient.write(`>start ${JSON.stringify({ formatid: E.WILD_FORMAT, seed })}\n` +
		`>player p1 ${JSON.stringify({ name: 'Mira', team: mine() })}\n` +
		`>player p2 ${JSON.stringify({ name: E.wildName(), team: Teams.pack([wild]) })}`);
	for (let i = 0; i < 400; i++) {
		await new Promise(r => setTimeout(r, 10));
		const text = log.join('');
		if (text.includes('|win|') || text.includes('|tie')) break;
	}
	return { log: log.join('\n'), errors };
}

(async () => {
	const rng = mulberry32(2101);
	// A Master Ball catches a wild Boneka, as it catches anything else.
	{
		const wild = E.bonekaSet(Dex.species.get('Cirno'), 15, rng);
		const { log, errors } = await play({ wild, plan: () => 'ball master', seed: [1, 2, 3, 4] });
		check(log.includes('Gotcha! Cirno was caught!'), 'a Master Ball catches a wild Cirno');
		check(log.includes('((Caught Cirno, Lv. 15, with a Master Ball))'), 'the RP line names Cirno');
		check(!errors.length, `no choice errors (${errors[0] || ''})`);
	}
	// Ultra Balls against a full-HP Boneka: thrown, mostly missed, the battle goes on to an end.
	for (const [name, level] of [['Reimu Hakurei', 20], ['Patchouli Knowledge', 35], ['Utsuho Reiuji', 55]]) {
		const wild = E.bonekaSet(Dex.species.get(name), level, rng);
		const { log, errors } = await play({ wild, plan: t => (t <= 3 ? 'ball ultra' : 'move 3'), seed: [5, 6, 7, level] });
		check((log.match(/threw an Ultra Ball/g) || []).length >= 1, `${name}: Ultra Balls are thrown`);
		check(/\|win\||\|tie/.test(log), `${name}: the battle ends`);
		check(!errors.length, `${name}: no choice errors (${errors[0] || ''})`);
	}
	// A legendary Touhou Pokemon is never caught on Showdown.
	{
		const wild = E.wildSet(Dex.species.get('Yukari Yakumo'), 30, rng);
		const { errors } = await play({ wild, plan: t => (t === 1 ? 'ball ultra' : 'move 3'), turns: 2, seed: [9, 9, 9, 9] });
		check(errors.some(e => /can't be caught on Showdown/.test(e)), 'a ball at Yukari is refused');
	}
	console.log(`gensokyo encounters: ${passed} checks passed${failed ? `, ${failed} FAILED` : ''}`);
	process.exit(failed ? 1 : 0);
})();
