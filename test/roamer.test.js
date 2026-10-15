'use strict';
/**
 * The roaming Suicune (src/roamer.js), in real battles of the real wild format.
 *
 *   node test/roamer.test.js
 *
 * Its HP carries from battle to battle, a knockout sends it away for 12 hours, it roars and
 * leaves at half HP or more and heals below, it acts after the player, a
 * Master Ball and Knock Off do nothing to it, a trap doesn't hold it, a ball
 * holds 1% to 5% of the time, and it turns up once for the owner, then roams
 * one place at a time, for one player at a time.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
process.env.PS_ROAMER_FILE = path.join(os.tmpdir(), `roamer-test-${process.pid}.json`);
require('../scripts/setup-config');
const { Battle, Teams, Dex } = require('pokemon-showdown');
const R = require('../src/roamer');
const E = require('../src/encounters');

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

const fresh = (extra = {}) => R.write({ species: 'Suicune', individual: { nature: 'Bold' }, seed: 'test', moves: 0, awayUntil: 0, hp: null, seen: 1, caught: null, holder: { encounter: 'e1', userid: 'ash', at: Date.now() }, ...extra });

function mine(species, moves, level = 50) {
	return Teams.pack([{ species, level, moves, ability: Dex.species.get(species).abilities[0], evs: {}, ivs: {} }]);
}

function battle(p1team = mine('Pikachu', ['Splash', 'Thunder Wave']), seed = [1, 2, 3, 4], player = 'Ash') {
	const b = new Battle({ formatid: E.WILD_FORMAT, seed });
	b.setPlayer('p1', { name: player, team: p1team });
	b.setPlayer('p2', { name: 'Wild Suicune', team: Teams.pack([R.set()]) });
	b.makeChoices('default', 'default');
	return b;
}
const log = b => b.log.join('\n');
// The wild side picks Recover, its first move, every time: the format decides what it really does.
const turn = (b, p1 = 'move 1') => { b.choose('p1', p1); if (!b.ended) b.choose('p2', 'move 1'); };

// 1. The set.
{
	fresh();
	const s = R.set();
	check(s.level === 50 && s.shiny && s.item === 'Shed Shell', `Lv. 50, shiny, Shed Shell (${s.level}, ${s.shiny}, ${s.item})`);
	check(s.moves.join() === 'Recover,Roar', `knows Recover and Roar (${s.moves})`);
	check(Object.values(s.ivs).every(v => v === 31) && s.evs.hp === 252 && s.evs.spe === 252, 'perfect IVs, max HP and Speed');
}

// 2. Full HP: it roars after the player's move and is gone, HP as the hit left it.
{
	fresh();
	const b = battle(mine('Pikachu', ['Thunderbolt']));
	const wild = b.p2.active[0];
	turn(b);
	const l = log(b);
	check(b.ended && !b.winner, 'it fled on turn 1 and nobody won');
	check(l.indexOf('|move|p1a: Pikachu|Thunderbolt') >= 0 && l.indexOf('|move|p1a: Pikachu|Thunderbolt') < l.indexOf('fled'), 'the player hit it first');
	const st = R.load();
	check(st.hp === wild.hp && wild.hp < wild.maxhp && !st.holder, `its HP is kept (${st.hp}/${wild.maxhp}) and it is free again`);
}

// 3. The next battle starts where that one left it.
{
	fresh({ hp: 120 });
	const b = battle();
	check(b.p2.active[0].hp === 120, `starts at the HP it was left on (${b.p2.active[0].hp})`);
}

// 4. Below half: Recover, and it stays.
{
	fresh({ hp: 40 });
	const b = battle();
	const wild = b.p2.active[0];
	turn(b);
	check(!b.ended && /\|move\|p2a: Sparkles\|Recover/.test(log(b)), 'below half HP it uses Recover and stays');
	check(wild.hp > 40 && R.load().hp === wild.hp, `the heal is kept as well (${R.load().hp})`);
	turn(b);
	check(b.ended && /fled/.test(log(b)), 'back over half, it roars and leaves the next turn');
}

// 5. Knocked out: gone for twelve hours, then back at full HP.
{
	fresh({ hp: 30 });
	const b = battle(mine('Mewtwo', ['Electro Ball', 'Thunderbolt'], 100));
	b.choose('p1', 'move 2');
	b.choose('p2', 'move 1');
	const st = R.load();
	check(/\|faint\|p2a: Sparkles/.test(log(b)) && b.winner === 'Ash', 'a knockout ends the battle for the player');
	check(st.awayUntil > Date.now() + R.KO_AWAY_MS - 60000 && !st.holder && st.hp === null, 'it is away for twelve hours, and will be back at full HP');
	check(!R.available(() => false) && R.available(() => false, st.awayUntil + 1), 'nobody can meet it until then, and anybody can after');
	const places = Object.keys(require('../src/encounter-tables/kagura').locations);
	let t = Date.now();
	while (!R.where(places, st, t)) t += R.MOVE_MS;
	check(R.roll({ encounterId: 'k', userid: 'brock', discord: '1', badges: 1, place: R.where(places, st, t), places, isOpen: () => false, now: t, wildFormat: E.WILD_FORMAT }) === null, 'not even where it would be');
}

// 6. A Master Ball is turned away, without being thrown.
{
	fresh();
	const b = battle();
	const ok = b.choose('p1', 'ball master');
	check(!ok && !/threw a Master Ball/.test(log(b)), 'a Master Ball cannot be thrown at it');
	check(b.choose('p1', 'ball ultra'), 'any other ball can');
}

// 7. Knock Off takes nothing, and a trap doesn't hold it.
{
	fresh();
	const b = battle(mine('Gengar', ['Mean Look', 'Knock Off']));
	turn(b, 'move 2');
	check(b.p2.active[0].item === 'shedshell', 'Knock Off leaves its Shed Shell');
	check(/keeps its Shed Shell in place/.test(log(b)), 'and the aura says so');
	fresh();
	const t = battle(mine('Gengar', ['Mean Look', 'Knock Off']));
	turn(t, 'move 1');
	check(t.ended && /fled/.test(log(t)), 'Mean Look does not stop it leaving');
}

// 8. The odds: 1% at full HP, 5% at 1 HP, whatever the ball.
{
	check(R.catchChance(200, 200) === 0.01, '1% at full HP');
	check(Math.abs(R.catchChance(1, 200) - 0.05) < 1e-12, '5% at 1 HP');
	let caught = null;
	for (let i = 1; i < 400 && !caught; i++) {
		fresh({ hp: 1 });
		const b = battle(undefined, [i, i + 1, i + 2, i + 3]);
		turn(b, 'ball poke');
		if (/Gotcha! Sparkles was caught!/.test(log(b))) caught = { b, i };
	}
	check(!!caught, `a ball holds some of the time at 1 HP (seed ${caught && caught.i})`);
	if (caught) {
		check(caught.b.winner === 'Ash', 'the catch wins the battle');
		check(!!R.load().caught && R.load().caught.userid === 'ash', 'and it is caught for good');
		check(!R.available(), 'so it never turns up again');
	}
}

// 9. Running is allowed, unlike from other legendaries.
{
	fresh();
	const b = battle(mine('Pikachu', ['Splash'], 100));
	b.choose('p1', 'run');
	check(!/not letting anyone leave/.test(log(b)), 'you can run from it');
}

// 10. Turning up: the owner first, wherever she is; then wherever it roams, one player at a time.
{
	R.write({ species: 'Suicune', individual: null, seed: null, moves: 0, hp: null, seen: 0, caught: null, holder: null });
	const places = Object.keys(require('../src/encounter-tables/kagura').locations);
	const args = (o = {}) => ({ encounterId: 'x', userid: 'misty', discord: '123', badges: 2, place: places[0], places, isOpen: () => true, wildFormat: E.WILD_FORMAT, ...o });
	check(places.every(p => R.roll(args({ place: p })) === null), 'before her encounter, it is nowhere');
	const first = R.roll(args({ userid: 'samantha', discord: R.FIRST_FOR, place: places[5] }));
	check(!!first && first.team[0].species === 'Suicune' && first.team[0].name === 'Sparkles', "the owner's next encounter is Sparkles, wherever she is");
	const nature = R.load().individual.nature;
	const now = Date.now();
	const here = R.where(places, R.load(), now);
	if (here) check(R.roll(args({ place: here, now })) === null, 'while she has it in front of her, nobody else meets it, even where it is');
	R.release(100, 200);
	const st = R.load();
	// Where it goes, over a long stretch: about 1 slot in 100 per place, and nowhere the rest.
	const counts = {};
	let nowhere = 0;
	const N = 20000;
	for (let i = 0; i < N; i++) {
		const at = R.where(places, st, now + i * R.MOVE_MS);
		if (at) counts[at] = (counts[at] || 0) + 1; else nowhere++;
	}
	const avg = (N - nowhere) / N / places.length;
	check(Math.abs(avg - 0.01) < 0.001, `on average it is in any one place ${(avg * 100).toFixed(2)}% of the time`);
	check(Object.keys(counts).length === places.length, `and it gets everywhere (${Object.keys(counts).length}/${places.length} places)`);
	let changes = 0;
	for (let i = 1; i < 200; i++) if (R.where(places, st, now + i * R.MOVE_MS) !== R.where(places, st, now + (i - 1) * R.MOVE_MS)) changes++;
	check(changes > 150, `it moves on most ten-minute marks (${changes}/199), so it comes and goes from a place`);
	const at = R.where(places, st, now);
	const there = at || places.find(() => false);
	if (at) {
		check(!!R.roll(args({ place: at, now })), 'anybody looking where it is meets it, every time');
		check(R.roll(args({ place: at, userid: 'brock', now })) === null, 'and only one trainer at a time');
		R.release(100, 200);
		check(R.where(places, R.load(), now) !== at, 'once it gets away, it is somewhere else at once');
	} else {
		// Nowhere right now: find the next ten minutes it is somewhere.
		let t = now;
		while (!R.where(places, st, t)) t += R.MOVE_MS;
		const p = R.where(places, st, t);
		check(!!R.roll(args({ place: p, now: t })), 'anybody looking where it is meets it, every time');
		check(R.roll(args({ place: p, userid: 'brock', now: t })) === null, 'and only one trainer at a time');
	}
	const elsewhere = places.find(p => p !== R.where(places, R.load(), now));
	check(R.roll(args({ place: elsewhere, now, isOpen: () => false })) === null, 'nobody meets it anywhere else');
	check(R.load().individual.nature === nature, `and it is the same Suicune throughout (${nature})`);
	void there;
}

// 11. Its own theme.
{
	const rp = require('../src/rp-server');
	const music = rp.musicFor({ kind: 'wild', team: [R.set()] });
	check(music && music.kind === 'legend' && /suicune/.test(music.file), `it plays Suicune's theme (${music && music.file})`);
	check(fs.existsSync(path.join(__dirname, '..', 'client', 'audio', music.file + (path.extname(music.file) ? '' : '.mp3'))) ||
		fs.existsSync(path.join(__dirname, '..', 'client', 'audio', 'legends', 'suicune.mp3')), 'and the track exists');
}

try { fs.unlinkSync(process.env.PS_ROAMER_FILE); } catch (e) {}
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
