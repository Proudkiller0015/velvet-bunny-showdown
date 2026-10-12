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
	perish: ['Perish Song'],
	evasion: ['Double Team', 'Minimize'],
	memento: ['Memento', 'Healing Wish', 'Final Gambit', 'Destiny Bond'],
	ditto: ['Transform'],
	splash: ['Splash'],
};
const seen = new Set();
let bad = 0;
let illegal = [];
for (let seed = 1; seed <= 120; seed++) {
	const badges = seed % 9;
	const t = E.rollTrainer({ place, badges, cls: larper, rng: rng(seed) });
	if (t.style !== 'troll' || !t.team.length) { bad++; continue; }
	seen.add(t.theme);
	for (const set of t.team) {
		const species = Dex.species.get(set.species);
		if (!species.exists) illegal.push(`${set.species} doesn't exist`);
		for (const m of set.moves) if (!Dex.moves.get(m).exists) illegal.push(`${set.species}: ${m}`);
		if (set.moves.length > 4 || !set.moves.length) illegal.push(`${set.species}: ${set.moves.length} moves`);
	}
	// Every Pokemon carries the theme's move, except the splash team's evolved ace.
	const themed = t.team.filter(set => set.moves.some(m => KEYS[t.theme].includes(Dex.moves.get(m).name)));
	if (themed.length < t.team.length - (t.theme === 'splash' ? 1 : 0)) bad++;
	if (t.team.some(set => set.moves.filter(m => KEYS[t.theme].includes(Dex.moves.get(m).name)).length > 1 && t.theme === 'explosion')) bad++;
}
check(bad === 0, `120 Larpers at 0-8 badges all bring a troll team built around one gimmick (${bad} not)`);
check(illegal.length === 0, `every Pokemon and move is real, four moves at most (${illegal.slice(0, 3).join('; ')})`);
check(seen.size >= 5, `the themes vary (${[...seen].join(', ')})`);
const boom = E.rollTrainer({ place, badges: 4, cls: larper, rng: rng(7) });
console.log(`     e.g. ${boom.name} (${boom.theme}): ${boom.team.map(s => `${s.species} Lv${s.level} [${s.moves.join(', ')}]`).join(' / ')}`);

// On a route, now and then.
let larpers = 0;
const N = 3000;
for (let seed = 1; seed <= N; seed++) if (E.rollTrainer({ place, badges: 3, rng: rng(seed * 7 + 1) }).classId === 'larper') larpers++;
check(larpers > N / 60 && larpers < N / 15, `about one route trainer in thirty is a Larper (${larpers} of ${N})`);
let early = 0;
for (let seed = 1; seed <= 600; seed++) if (E.rollTrainer({ place, badges: 0, rng: rng(seed) }).classId === 'larper') early++;
check(early === 0, 'none before the first badge');

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
