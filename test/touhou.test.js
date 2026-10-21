'use strict';
/**
 * Touhou (data/velvet/touhou.js): the Touhoumons solomod's characters (DH2, MIT), a guest
 * tier at the top of the ladder. Legal in RP Touhou and the RP Battle formats, refused by
 * every other RP format, RP Collab included; never in the wild, drafted by the bot only in
 * RP Touhou. Every species and forme has its sprites, every move, ability and item of
 * theirs has its descriptions, a handful of their mechanics do what they say, and random
 * Touhou teams play whole battles without the engine throwing.
 *
 * Reads the data installed in node_modules by scripts/setup-config.js: run that first.
 *
 *   node test/touhou.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Battle, Dex, Teams, TeamValidator } = require('pokemon-showdown');
const touhou = require('pokemon-showdown/dist/data/velvet/touhou.js');

const dex = Dex.mod('gen9rp');
const ROOT = path.join(__dirname, '..');
const ALL = [...touhou.SPECIES, ...touhou.FORMES];
let n = 0;
const ok = (cond, what) => { assert.ok(cond, what); n++; };

/** A set the validator takes: the first ability, four moves it learns, the item its forme needs. */
function setFor(id, extra = {}) {
	const s = dex.species.get(id);
	const learner = s.battleOnly ? dex.species.get(s.battleOnly).id : s.id;
	const moves = Object.keys(dex.species.getLearnsetData(learner).learnset || {}).slice(0, 4);
	return {
		name: s.name, species: s.name, ability: s.requiredAbility || Object.values(s.abilities)[0], item: s.requiredItem || '',
		moves, nature: 'Serious', evs: { hp: 4 }, level: 100, ...extra,
	};
}
const problems = (format, team) => new TeamValidator(format).validateTeam(team) || [];

// ---- They exist, all of them, in RP's dex and nowhere else.
ok(touhou.SPECIES.length === 129 && touhou.FORMES.length === 9, `129 species and 9 formes (${touhou.SPECIES.length}, ${touhou.FORMES.length})`);
for (const id of ALL) {
	const s = dex.species.get(id);
	ok(s.exists && s.num >= 2101 && s.tier === 'Touhou' && s.natDexTier === 'Touhou', `${id} exists, numbered past the real dex, tiered Touhou`);
}
ok(!Dex.species.get('Reimu Hakurei').exists, 'the official dex never sees them');
ok(dex.species.get('Hecatia').otherFormes.includes('Hecatia-Earth') && dex.species.get('Okina Matara-Winter').battleOnly === 'Okina Matara', 'formes hang off their bases');

// ---- Legal in RP Touhou and the RP Battle formats; refused everywhere else with the reason.
const OTHER = ['gen9rpag', 'gen9rpcollab', 'gen9rpubers', 'gen9rpou', 'gen9rplc', 'gen9rpdraft', 'gen8rpou'];
for (const id of ALL) {
	const set = setFor(id);
	ok(!problems('gen9rptouhou', [set]).length, `${id} legal in RP Touhou (${problems('gen9rptouhou', [set])})`);
	ok(!problems('gen9rpbattle', [set]).length, `${id} legal in RP Battle`);
	ok(!problems('gen9rpbattledoubles', [set, setFor('reimuhakurei')]).length, `${id} legal in RP Battle (Doubles)`);
	for (const f of ['gen9rpag', 'gen9rpcollab', 'gen9rpou', 'gen9rpdraft']) {
		const p = problems(f, [setFor(id)]);
		ok(p.some(x => /is a Touhou Pokémon: legal only in \[Gen 9\] RP Touhou/.test(x)), `${id} refused in ${f}, saying why`);
	}
}
for (const f of OTHER) ok(problems(f, [setFor('cirno')]).length, `refused in ${f}`);
ok(problems('gen9rptouhou', [{ name: 'Funerfly', species: 'Funerfly', ability: 'Qliphoth Counter', moves: ['Solemn Lament'], evs: { hp: 4 } }]).some(x => /Collab/.test(x)), 'RP Touhou takes no collab Pokemon');
// The Summer Backdoor makes Cirno Cirno-Tanned, as the Griseous Core does Giratina-Origin.
{
	const cirno = setFor('cirno', { item: 'Summer Backdoor', ability: 'Drought' });
	const p = problems('gen9rptouhou', [cirno]);
	ok(!p.length && cirno.species === 'Cirno-Tanned', `Cirno holding a Summer Backdoor is Cirno-Tanned (${p})`);
	ok(problems('gen9rptouhou', [setFor('cirnotanned', { item: '' })]).length, 'and Cirno-Tanned without one is refused');
}

// ---- The tier table: Touhou, at the top of the ladder.
{
	const tiers = require('../src/rp-tiers.json');
	for (const id of ALL) if (!dex.species.get(id).battleOnly) ok(tiers[id] === 'Touhou', `src/rp-tiers.json files ${id} under Touhou`);
	const formats = fs.readFileSync(path.join(ROOT, 'config', 'custom-formats.js'), 'utf8');
	ok(/const LOW_LADDER = \['Touhou', 'Collab', 'AG'/.test(formats), 'Touhou tops the RP ladder, above Collab');
}

// ---- Sprites: front, back, both shinies and an icon for every species and forme, and a row in the client.
{
	const dir = path.join(ROOT, 'client', 'sprites', 'touhou');
	const client = fs.readFileSync(path.join(ROOT, 'client', 'js', 'velvet-data.js'), 'utf8');
	const art = JSON.parse(/var TOUHOU_ART = (\[.*\]);/.exec(client)[1]);
	const iconOf = JSON.parse(/var TOUHOU_ICON_OF = (\{.*\});/.exec(client)[1]);
	for (const id of ALL) {
		for (const suffix of ['', '-back', '-shiny', '-back-shiny']) ok(fs.existsSync(path.join(dir, `${id}${suffix}.png`)), `sprite touhou/${id}${suffix}.png`);
		ok(fs.existsSync(path.join(dir, `${iconOf[id] || id}-icon.png`)), `icon for ${id}`);
		ok(art.includes(id), `${id} has a row in the client's sprite table`);
	}
	const buffs = fs.readFileSync(path.join(ROOT, 'client', 'js', 'velvet-buffs.js'), 'utf8');
	for (const id of ALL) ok(buffs.includes(`"${id}":{"num":`), `${id} ships to the client (newSpecies)`);
	ok(buffs.includes('"reimu","pokemon"') && buffs.includes('"patchy","pokemon"'), 'their nicknames are search aliases');
}

// ---- Every move, ability and item of theirs is ours, numbered and described.
for (const [kind, ids, table] of [['move', touhou.MOVE_IDS, dex.moves], ['ability', touhou.ABILITY_IDS, dex.abilities], ['item', touhou.ITEM_IDS, dex.items]]) {
	for (const id of ids) {
		const x = table.get(id);
		ok(x.exists && x.num < 0 && x.shortDesc && x.desc && x.desc !== 'No additional effect.', `${kind} ${x.name || id} exists with both descriptions`);
		ok(!Dex[kind === 'ability' ? 'abilities' : kind + 's'].get(id).exists, `${kind} ${id} is not an official id`);
	}
}

// ---- Never wild; drafted by the bot in RP Touhou only.
{
	const { encounterable } = require('../src/encounters');
	for (const id of ALL) ok(!encounterable(dex.species.get(id)), `${id} never spawns wild`);
	const { TeamBuilder } = require('../src/teambuilder');
	const tb = new TeamBuilder();
	for (const f of ['gen9rpag', 'gen9rpcollab', 'gen9rpou', 'gen9rpbattle', 'gen9rpbattledoubles']) {
		ok(!tb.context(f).pool.some(s => s.tier === 'Touhou'), `not in the bot's ${f} pool`);
	}
	ok(tb.context('gen9rptouhou').pool.filter(s => s.tier === 'Touhou').length > 100, 'in the bot\'s RP Touhou pool');
	for (let seed = 1; seed <= 3; seed++) {
		const team = Teams.unpack(tb.build('gen9rptouhou', seed));
		ok(team.some(s => dex.species.get(s.species).tier === 'Touhou') && !problems('gen9rptouhou', team).length, `the bot's RP Touhou team ${seed} brings one, legally`);
		ok(!Teams.unpack(tb.build('gen9rpag', seed)).some(s => dex.species.get(s.species).tier === 'Touhou'), `its RP AG team ${seed} does not`);
	}
}

// ---- A few of their mechanics.
const mon = (species, moves, extra = {}) => ({ name: species, species, ability: '', item: '', moves, nature: 'Serious', evs: { hp: 252 }, level: 100, ...extra });
const battle = (mine, theirs, seed = [1, 2, 3, 4]) => {
	const b = new Battle({ formatid: 'gen9rpcustomgame', seed });
	b.setPlayer('p1', { team: Teams.pack(mine) });
	b.setPlayer('p2', { team: Teams.pack(theirs) });
	b.choose('p1', 'team 1');
	b.choose('p2', 'team 1');
	return b;
};
const turn = (b, p1, p2) => { b.choose('p1', p1); b.choose('p2', p2); };
{
	// Hakkero: rain does not halve Marisa's Fire moves.
	const hit = ability => {
		const b = battle([mon('Marisa Kirisame', ['Flamethrower'], { ability })], [mon('Blissey', ['Splash'], { ability: 'Drizzle' })]);
		turn(b, 'move 1', 'move 1');
		return b.p2.active[0].maxhp - b.p2.active[0].hp;
	};
	const kept = hit('Hakkero');
	const halved = hit('Reckless');
	ok(kept > halved * 1.7, `Hakkero: Fire in rain is not halved (${kept} vs ${halved})`);
}
{
	// Body Swap: Otherworld -> Earth (a healing move, so it fails at full HP, as in the mod).
	const b = battle([mon('Hecatia', ['Body Swap'], { ability: 'Pressure' })], [mon('Blissey', ['Splash'])]);
	b.p1.active[0].sethp(100);
	turn(b, 'move 1', 'move 1');
	ok(b.p1.active[0].species.name === 'Hecatia-Earth', 'Body Swap: Hecatia becomes Hecatia-Earth');
}
{
	// Four Seasons: rain makes Okina Matara Spring.
	const b = battle([mon('Okina Matara', ['Splash'], { ability: 'Four Seasons' })], [mon('Pelipper', ['Splash'], { ability: 'Drizzle' })]);
	ok(b.p1.active[0].species.name === 'Okina Matara-Spring', `Four Seasons: rain is Spring (${b.p1.active[0].species.name})`);
}
{
	// Summon Nyuudou: Ichirin comes back with Unzan.
	const b = battle([mon('Ichirin Kumoi', ['Splash'], { ability: 'Summon Nyuudou' }), mon('Blissey', ['Splash'])], [mon('Chansey', ['Splash'])]);
	turn(b, 'switch 2', 'move 1');
	ok(b.p1.pokemon.find(p => p.baseSpecies.baseSpecies === 'Ichirin Kumoi').species.name === 'Ichirin Kumoi-Unzan', 'Summon Nyuudou: Ichirin Kumoi-Unzan after switching out');
}
{
	// Echo: immune to sound, and echoes it back.
	const b = battle([mon('Kyouko Kasodani', ['Splash'], { ability: 'Echo' })], [mon('Blissey', ['Hyper Voice'])]);
	const from = b.log.length;
	turn(b, 'move 1', 'move 1');
	const log = b.log.slice(from).join('\n');
	ok(/-immune\|p1a: Kyouko Kasodani\|\[from\] ability: Echo/.test(log), 'Echo: immune to Hyper Voice');
	ok(/\|move\|p1a: Kyouko Kasodani\|Hyper Voice/.test(log), 'Echo: and uses it back');
}
{
	// Junko can use Hyperspace Fury.
	const b = battle([mon('Junko', ['Hyperspace Fury'], { ability: 'Mold Breaker' })], [mon('Blissey', ['Splash'])]);
	turn(b, 'move 1', 'move 1');
	ok(b.p2.active[0].hp < b.p2.active[0].maxhp, 'Hyperspace Fury works for Junko');
}

// ---- Random Touhou teams play whole battles without the engine throwing.
function rngFrom(seed) {
	let s = seed >>> 0 || 1;
	return k => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return Math.floor((s / 0x100000000) * k); };
}
const ITEMS = ['Leftovers', 'Life Orb', 'Choice Scarf', 'Sitrus Berry', 'Booster Energy', 'Summer Backdoor', 'Jeweled Pagoda', 'Water Stone', 'Moon Stone', 'Heavy-Duty Boots', 'Draco Plate', ''];
const PICKABLE = ALL.filter(id => !dex.species.get(id).battleOnly);
function randomTeam(rng) {
	const team = [];
	while (team.length < 6) {
		const s = dex.species.get(PICKABLE[rng(PICKABLE.length)]);
		if (team.some(t => t.species === s.name)) continue;
		const pool = Object.keys(dex.species.getLearnsetData(s.id).learnset || {});
		const moves = [];
		while (moves.length < Math.min(4, pool.length)) { const m = pool[rng(pool.length)]; if (!moves.includes(m)) moves.push(m); }
		const abilities = Object.values(s.abilities);
		team.push({
			name: s.name, species: s.name, ability: abilities[rng(abilities.length)], item: s.requiredItem || ITEMS[rng(ITEMS.length)],
			moves, nature: 'Hardy', evs: { hp: 84, atk: 84, def: 84, spa: 84, spd: 84, spe: 84 }, level: 100, teraType: s.types[0],
		});
	}
	return team;
}
function randomChoice(req, rng, doubles) {
	if (req.wait) return null;
	if (req.teamPreview) return 'default';
	const bench = () => req.side.pokemon.map((p, i) => [p, i + 1]).filter(([p]) => !p.active && !/ fnt$/.test(p.condition));
	if (req.forceSwitch) {
		const free = bench();
		return req.forceSwitch.map(f => (f && free.length ? `switch ${free.splice(rng(free.length), 1)[0][1]}` : 'pass')).join(', ');
	}
	const free = bench();
	return req.active.map((a, k) => {
		if (req.side.pokemon[k] && / fnt$/.test(req.side.pokemon[k].condition)) return 'pass';
		if (!a.trapped && free.length && rng(8) === 0) return `switch ${free.splice(rng(free.length), 1)[0][1]}`;
		const moves = a.moves.map((m, i) => [m, i + 1]).filter(([m]) => !m.disabled);
		if (!moves.length) return 'move 1';
		const [m, i] = moves[rng(moves.length)];
		let c = `move ${i}`;
		if (doubles && ['normal', 'any', 'adjacentFoe'].includes(m.target)) c += ` ${1 + rng(2)}`;
		if (a.canTerastallize && rng(6) === 0) c += ' terastallize';
		return c;
	}).join(', ');
}
function play(formatid, seed) {
	const rng = rngFrom(seed * 7919);
	const doubles = formatid.includes('doubles');
	const b = new Battle({ formatid, seed: [seed, seed + 1, seed + 2, seed + 3] });
	b.setPlayer('p1', { team: Teams.pack(randomTeam(rng)) });
	b.setPlayer('p2', { team: Teams.pack(randomTeam(rng)) });
	for (let step = 0; step < 2000 && !b.ended; step++) {
		for (const side of b.sides) {
			const req = side.activeRequest;
			if (!req || side.isChoiceDone()) continue;
			const choice = randomChoice(req, rng, doubles);
			if (!choice) continue;
			if (!b.choose(side.id, choice)) b.choose(side.id, 'default');
		}
		if (b.turn > 300) b.tie();
	}
	return b;
}
{
	let games = 0;
	let turns = 0;
	for (let seed = 1; seed <= 30; seed++) {
		const b = play('gen9rpcustomgame', seed);
		ok(b.ended, `Custom Game ${seed} finished (turn ${b.turn})`);
		ok(!b.log.some(l => l.startsWith('|bigerror|')), `Custom Game ${seed}: no engine error in the log`);
		games++; turns += b.turn;
	}
	for (let seed = 101; seed <= 106; seed++) {
		const b = play('gen9rpbattledoubles', seed);
		ok(b.ended, `RP Battle (Doubles) ${seed} finished (turn ${b.turn})`);
		ok(!b.log.some(l => l.startsWith('|bigerror|')), `RP Battle (Doubles) ${seed}: no engine error in the log`);
		games++; turns += b.turn;
	}
	console.log(`  ${games} random Touhou battles, ${turns} turns, no throw`);
}

console.log(`touhou: ${n} checks passed`);
