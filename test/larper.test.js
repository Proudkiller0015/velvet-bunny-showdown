'use strict';
/**
 * The Larper's troll teams, the random Larper on a route, and a trainer class
 * typed by staff that the list doesn't have (it used to call the battle off).
 *
 *   node test/larper.test.js
 */
const E = require('../src/encounters');
const { summoned } = require('../src/rp-server');
// Our dex: the server's own moves (Wave Charge, Crag Hammer) are real here.
const Dex = require('../src/rp-dex')();

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

// A seeded random, so a failure can be run again.
function rng(seed) {
	let s = seed;
	return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}

const place = { name: 'Route 1', trainers: ['youngster', 'lass', 'hiker'], types: [] };
const larper = E.findClass('larper');
check(larper && larper.troll && larper.avatar === 'harlequin', 'Larper is a class, with a troll flag and a sprite');
check(E.findClass('larp') === larper && E.findClass('troll') === larper, 'found by its aliases too');

const KEYS = {
	explosion: ['Explosion', 'Self-Destruct', 'Misty Explosion'],
	// At least two singers; the rest keep them in.
	perish: ['Perish Song', 'Mean Look', 'Block', 'Spider Web', 'Protect', 'Destiny Bond'],
	evasion: ['Double Team', 'Minimize'],
	memento: ['Memento', 'Healing Wish', 'Final Gambit', 'Destiny Bond'],
	ditto: ['Transform'],
	splash: ['Splash'],
	trap: ['Mean Look', 'Block', 'Spider Web'],
};
const seen = new Set();
let bad = 0;
let illegal = [];
for (let seed = 1; seed <= 120; seed++) {
	const badges = seed % 9;
	const t = E.rollTrainer({ place, badges, cls: larper, rng: rng(seed) });
	if (t.style !== 'troll' || t.team.length !== 6) { bad++; continue; }
	seen.add(t.theme);
	for (const set of t.team) {
		const species = Dex.species.get(set.species);
		if (!species.exists) illegal.push(`${set.species} doesn't exist`);
		for (const m of set.moves) if (!Dex.moves.get(m).exists) illegal.push(`${set.species}: ${m}`);
		if (set.moves.length > 4 || !set.moves.length) illegal.push(`${set.species}: ${set.moves.length} moves`);
	}
	// Every Pokemon carries the theme's move, except the splash team's evolved ace.
	// The splash team's evolved ace and a box-art legendary ace are the jokes on top.
	const legend = /^Wild /.test(t.team[t.team.length - 1].name || '') ? 1 : 0;
	const themed = t.team.filter(set => set.moves.some(m => KEYS[t.theme].includes(Dex.moves.get(m).name)));
	if (themed.length < t.team.length - Math.max(t.theme === 'splash' ? 1 : 0, legend)) bad++;
	if (t.theme === 'perish' && t.team.filter(set => set.moves.includes('Perish Song')).length < 2) bad++;
	if (t.team.some(set => set.moves.filter(m => KEYS[t.theme].includes(Dex.moves.get(m).name)).length > 1 && t.theme === 'explosion')) bad++;
}
check(bad === 0, `120 Larpers at 0-8 badges all bring six, a troll team built around one gimmick (${bad} not)`);
check(illegal.length === 0, `every Pokemon and move is real, four moves at most (${illegal.slice(0, 3).join('; ')})`);
check(seen.size >= 5, `the themes vary (${[...seen].join(', ')})`);
const boom = E.rollTrainer({ place, badges: 4, cls: larper, rng: rng(7) });
console.log(`     e.g. ${boom.name} (${boom.theme}): ${boom.team.map(s => `${s.species} Lv${s.level} [${s.moves.join(', ')}]`).join(' / ')}`);

check(E.rollTrainer({ place, badges: 2, cls: larper, rng: rng(3) }).ai === 'troll', 'a Larper plays on the troll AI, whatever the badges');

// Self-Destruct and Misty Explosion only where they average 80% on the route's common Pokemon.
let weak = 0, weakOk = 0;
for (let seed = 1; seed <= 60; seed++) {
	const t = E.rollTrainer({ place, badges: 1 + seed % 8, cls: E.findClass('terrorist'), rng: rng(seed * 13) });
	for (const set of t.team) if (set.moves.some(m => /^(Self-Destruct|Misty Explosion)$/.test(m))) weak++;
	for (const set of t.team) if (set.moves.includes('Explosion') && set.moves.includes('Self-Destruct')) weakOk++;
}
check(weakOk === 0, 'never Explosion and Self-Destruct on one Pokemon');
console.log(`     ${weak} weaker booms kept across 60 Terrorist teams`);

// The Terrorist: only ever the Explosion squad.
const terrorist = E.findClass('terrorist');
let squads = 0;
for (let seed = 1; seed <= 60; seed++) {
	const t = E.rollTrainer({ place, badges: 1 + seed % 8, cls: terrorist, rng: rng(seed) });
	if (t.theme === 'explosion' && t.ai === 'troll' && t.team.length === 6 && /^Terrorist /.test(t.name) &&
		t.team.filter(set => !/^Wild /.test(set.name || '')).every(set => set.moves.some(m => KEYS.explosion.includes(Dex.moves.get(m).name)))) squads++;
}
check(terrorist && squads === 60, `60 Terrorists at 1-8 badges all bring an Explosion squad on the troll AI (${squads})`);

// Trap sets stall (Block, Toxic, Protect, a heal); Perish singers bring their own trap; no Larper team carries a bomb.
{
	const theme = id => ({ ...larper, trollTheme: id });
	let stallSets = 0, trapSets = 0, singers = 0, trapped = 0, sneaky = 0, sneakTeams = 0;
	for (let seed = 1; seed <= 40; seed++) {
		const badges = 3 + seed % 6;
		const trap = E.rollTrainer({ place, badges, cls: theme('trap'), rng: rng(seed) });
		if (trap.theme === 'trap') for (const set of trap.team) {
			trapSets++;
			const ids = set.moves.map(m => Dex.moves.get(m).id);
			if (ids.some(m => ['toxic', 'leechseed', 'willowisp'].includes(m)) && ids.some(m => /protect|bunker|shield|detect/.test(m))) stallSets++;
		}
		const perish = E.rollTrainer({ place, badges, cls: theme('perish'), rng: rng(seed) });
		if (perish.theme === 'perish') for (const set of perish.team) if (set.moves.includes('Perish Song')) {
			singers++;
			if (set.moves.some(m => /^(Mean Look|Block|Spider Web)$/.test(m))) trapped++;
		}
		const evasion = E.rollTrainer({ place, badges, cls: theme('evasion'), rng: rng(seed) });
		if (evasion.theme === 'evasion') {
			sneakTeams++;
			if (evasion.team.some(set => set.moves.some(m => /^(Explosion|Self-Destruct|Misty Explosion)$/.test(m)))) sneaky++;
		}
	}
	check(trapSets > 0 && stallSets / trapSets >= 0.8, `trap sets stall: a status move and a Protect (${stallSets}/${trapSets})`);
	check(singers > 0 && trapped === singers, `every Perish singer can trap (${trapped}/${singers})`);
	check(sneakTeams > 0 && sneaky === 0, `Explosion is the Terrorist's: no Larper team carries a bomb (${sneaky}/${sneakTeams})`);
}

// One troll in twenty brings a box-art legendary, as "Wild <name>".
{
	const Rarity = require('../src/rarity');
	let legends = 0, named = 0;
	const N2 = 1000;
	for (let seed = 1; seed <= N2; seed++) {
		const t = E.rollTrainer({ place, badges: 1 + seed % 8, cls: seed % 2 ? larper : E.findClass('terrorist'), rng: rng(seed * 3) });
		const found = t.team.filter(set => Rarity.classOf(set.species) === 'boxart');
		if (found.length) legends++;
		if (found.length === 1 && found[0].name === `Wild ${found[0].species}`.slice(0, 18)) named++;
	}
	check(legends > N2 * 0.02 && legends < N2 * 0.09, `about one troll in twenty brings a box-art legendary (${legends} of ${N2})`);
	check(named === legends, `only ever one, and it goes out as "Wild <name>" (${named}/${legends})`);
}

// On a route, now and then.
let larpers = 0;
const N = 3000;
for (let seed = 1; seed <= N; seed++) if (E.findClass(E.rollTrainer({ place, badges: 3, rng: rng(seed * 7 + 1) }).classId).troll) larpers++;
check(larpers > N * 0.17 && larpers < N * 0.23, `about one route trainer in five is a Larper or a Terrorist (${larpers} of ${N})`);
const share = (types, id) => {
	let n = 0;
	for (let seed = 1; seed <= N; seed++) if (E.rollTrainer({ place: { ...place, types }, badges: 3, rng: rng(seed * 5 + 2) }).classId === id) n++;
	return n / N;
};
const fireBombers = share(['Fire', 'Rock'], 'terrorist'), mindLarpers = share(['Psychic'], 'larper');
check(fireBombers > 0.41 && fireBombers < 0.49, `Terrorists are 45% of trainers where it's Fire (${(fireBombers * 100).toFixed(0)}%)`);
check(mindLarpers > 0.41 && mindLarpers < 0.49, `Larpers are 45% of trainers where it's Psychic (${(mindLarpers * 100).toFixed(0)}%)`);
check(share(['Fire'], 'larper') < 0.13, 'and the other troll stays at its 10% there');
let inGym = 0;
for (let seed = 1; seed <= 600; seed++) if (E.findClass(E.rollTrainer({ place: { ...place, gymType: 'Fire' }, badges: 3, rng: rng(seed) }).classId).troll) inGym++;
check(inGym === 0, 'never a troll in a gym');
let early = 0;
for (let seed = 1; seed <= 600; seed++) if (E.findClass(E.rollTrainer({ place, badges: 0, rng: rng(seed) }).classId).troll) early++;
check(early > 600 * 0.15, `nobody is safe, not even at zero badges (${early} of 600)`);

// Arranged fights: by name, and a class the list doesn't have.
const byName = summoned({ kind: 'trainer', classId: 'larper', name: 'Bob' }, { place, badges: 3, levelCap: 40 });
check(!byName.error && byName.style === 'troll' && byName.name === 'Larper Bob', `a rigged Larper is a Larper (${byName.error || byName.name})`);
const typed = summoned({ kind: 'trainer', classId: 'teamrocketgrunt', classTitle: 'Rocket Grunt', name: 'Jess' }, { place, badges: 3, levelCap: 40 });
check(!typed.error && typed.className === 'Rocket Grunt' && typed.name === 'Rocket Grunt Jess' && typed.team.length > 0,
	`a typed class battles under the title typed (${typed.error || `${typed.name}, ${typed.team.length} Pokemon`})`);
const bare = summoned({ kind: 'trainer', classId: 'cosplayer' }, { place, badges: 2, levelCap: 30 });
check(!bare.error && bare.className === 'Cosplayer' && /^Cosplayer /.test(bare.name), `an old rig with only the class id still works (${bare.error || bare.name})`);
const withMon = summoned({ kind: 'trainer', classId: 'larper', with: ['Electrode'] }, { place, badges: 5, levelCap: 50 });
check(!withMon.error && withMon.team[0].species === 'Electrode', 'a rigged Pokemon still leads a Larper team');
const known = summoned({ kind: 'trainer', classId: 'gymleader', name: 'Brock' }, { place, badges: 1, levelCap: 20 });
check(!known.error && known.classId === 'gymleader' && /^Leader /.test(known.name), 'the classes the list has still work as before');

console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
