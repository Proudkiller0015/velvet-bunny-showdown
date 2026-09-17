'use strict';
/**
 * The shared team building: role sets, the assembler, and the RP trainers.
 *
 *   node test/team-builders.test.js
 */

const { Dex } = require('pokemon-showdown');
const RS = require('../src/role-sets');
const A = require('../src/team-assembler');
const TL = require('../src/team-logic');
const E = require('../src/encounters');

let passed = 0, failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); ok ? passed++ : failed++; };
const seeded = seed => () => ((seed = seed * 16807 % 2147483647) / 2147483647);
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const has = (set, move) => set.moves.some(m => toID(m) === toID(move));

// Role sets: what the Pokemon is for, and this server's own kit.
const blissey = RS.buildSet(Dex, 'Blissey', { rng: seeded(1) });
check(has(blissey, 'Soft-Boiled') && ['Bold', 'Calm', 'Careful', 'Impish'].includes(blissey.nature), `Blissey is a Soft-Boiled wall (${blissey.nature}: ${blissey.moves})`);
const tomb = RS.buildSet(Dex, 'Spiritomb', { rng: seeded(2) });
check(tomb.ability === 'Keystone Legion' && has(tomb, 'Soul Toll'), `Spiritomb uses Keystone Legion and Soul Toll (${tomb.ability}: ${tomb.moves})`);
const kiss = RS.buildSet(Dex, 'Togekiss', { rng: seeded(3) });
check(kiss.ability === 'Serene Grace', `Togekiss has Serene Grace (${kiss.ability})`);
const ape = RS.buildSet(Dex, 'Infernape', { rng: seeded(4) });
check(ape.ability === 'Crown of Flame' && ape.moves.some(m => Dex.moves.get(m).num < 0), `Infernape uses its crown and its own moves (${ape.moves})`);
check(RS.buildSet(Dex, 'Alakazam', { role: 'Setup Sweeper', rng: seeded(5) }).moves.every(m => !['swordsdance', 'bulkup', 'dragondance'].includes(toID(m))), 'no physical setup on a special sweeper');

let broken = 0, species = 0;
for (const s of Dex.species.all()) {
	if (s.isNonstandard && s.isNonstandard !== 'Past') continue;
	species++;
	try {
		const set = RS.buildSet(Dex, s.name, { rng: seeded(species) });
		const learn = RS.learnable(Dex, s);
		if (!set || !set.moves.length || new Set(set.moves).size !== set.moves.length || set.moves.some(m => !learn.has(toID(m)))) broken++;
	} catch (e) { broken++; }
}
check(broken === 0, `every one of ${species} Pokemon gets a set of distinct moves it learns (${broken} broken)`);

// The assembler: a team, not the six biggest numbers.
const box = ['Spiritomb', 'Glaceon', 'Garchomp', 'Roserade', 'Togekiss', 'Lucario', 'Infernape', 'Torterra', 'Empoleon', 'Blissey', 'Dragonite', 'Kingambit']
	.map(name => ({ species: name, strength: 1 }));
const team = A.assemble(Dex, box, { rng: seeded(9) });
const report = TL.analyze(Dex, team);
check(team.length === 6, 'six picked from twelve');
check(report.stealthRock.length === 1, `exactly one Stealth Rock (${report.stealthRock})`);
check(!TL.issues(report, { stage: 'full' }).some(i => i.severity === 'hard'), `no hard checklist failure (${TL.issues(report).map(i => i.text).join('; ')})`);
const bagged = A.assemble(Dex, box, { rng: seeded(9), items: { bag: { leftovers: 1, pokeball: 3 } } });
check(bagged.filter(s => s.item).length === 1 && bagged.find(s => s.item).item === 'Leftovers', 'with a bag, only what is in it');

// RP trainers: legal moves by badges, a team by the checklist at six.
let legal = true, fullMoves = true, hard = 0, trainers = 0;
for (let b = 0; b <= 8; b++) {
	for (let i = 0; i < 6; i++) {
		const tr = E.rollTrainer({ place: null, badges: b, rng: seeded(100 + b * 10 + i) });
		trainers++;
		for (const mon of tr.team) {
			const learn = RS.learnable(Dex, Dex.species.get(mon.species));
			if (mon.moves.some(m => !learn.has(toID(m)))) legal = false;
			if (b >= 1 && mon.level >= 10 && mon.moves.length < 3) fullMoves = false;
			if (b < 6 && mon.item && !['Oran Berry'].includes(mon.item)) legal = false;
		}
		if (b >= 7) hard += TL.issues(TL.analyze(Dex, tr.team), { stage: 'full', themed: true }).filter(x => x.severity === 'hard').length;
	}
}
check(legal, 'trainer Pokemon only know moves they learn, and hold items only as badges allow');
check(fullMoves, 'trainer Pokemon past level 10 know at least three moves');
// Some trainers' Pokemon cannot learn Stealth Rock at all, so this is a rate, not a guarantee.
check(hard <= 12, `high-badge trainers seldom miss a hard checklist rule (${hard} across 12 teams)`);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
