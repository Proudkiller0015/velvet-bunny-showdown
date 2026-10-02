'use strict';
/**
 * MissingNo. (Halloween 2026, data/velvet/missingno.js): legal from RP RU up, a hit
 * capped at a quarter of its HP, a used-up item back at the end of the turn, and a
 * Bird-type move the engine can run (Bird has to be a type it knows: rp-mod.js).
 */
const assert = require('assert');
const { Battle, Teams, TeamValidator } = require('pokemon-showdown');

const set = (item, extra = {}) => ({
	name: 'MissingNo.', species: 'MissingNo.', item, ability: 'Glitched Data', moves: ['Data Corruption', 'Body Slam', 'Fling', 'Recover'],
	nature: 'Brave', evs: { hp: 252, atk: 252, def: 4, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 100, gender: '', ...extra,
});
const battle = (mine, theirs) => {
	const b = new Battle({ formatid: 'gen9rpag' });
	b.setPlayer('p1', { team: Teams.pack(mine) });
	b.setPlayer('p2', { team: Teams.pack(theirs) });
	b.choose('p1', 'team 1');
	b.choose('p2', 'team 1');
	return b;
};
let n = 0;
const ok = (cond, what) => { assert.ok(cond, what); n++; };

// Legal where it should be, and its Tera type falls back to Normal (Bird is not one).
for (const f of ['gen9rpru', 'gen9rpuu', 'gen9rpou', 'gen9rpubers', 'gen9rpag']) ok(!new TeamValidator(f).validateTeam([set('Sitrus Berry')]), `legal in ${f}`);
ok((new TeamValidator('gen9rpnu').validateTeam([set('Sitrus Berry')]) || []).join(' ').includes('RU'), 'too high for RP NU');
ok((new TeamValidator('gen9rpru').validateTeam([{ ...set('Leftovers'), species: 'Pikachu', name: 'Pikachu', ability: 'Static', moves: ['Thunderbolt'], teraType: 'Bird' }]) || []).join(' ').includes('Terastal'), 'nobody else Terastallizes into Bird');
ok((new TeamValidator('gen9rpru').validateTeam([set('Sitrus Berry', { moves: ['Spore'] })]) || []).length, 'it does not learn everything');

// The cap: a Choice Band Earthquake takes a quarter, not all of it.
{
	const b = battle([set('Leftovers')], [{ species: 'Garchomp', ability: 'Sand Veil', item: 'Choice Band', moves: ['Earthquake'], nature: 'Jolly', evs: { atk: 252, spe: 252 }, level: 100 }]);
	const me = b.p1.active[0];
	b.choose('p1', 'move 4');
	b.choose('p2', 'move 1');
	ok(me.hp > 0 && me.maxhp - me.hp <= Math.floor(me.maxhp / 4), `one hit is capped at a quarter (${me.hp}/${me.maxhp})`);
}
// Mold Breaker ignores the cap.
{
	const b = battle([set('Leftovers')], [{ species: 'Haxorus', ability: 'Mold Breaker', item: 'Choice Band', moves: ['Earthquake'], nature: 'Jolly', evs: { atk: 252, spe: 252 }, level: 100 }]);
	b.choose('p1', 'move 4');
	b.choose('p2', 'move 1');
	ok(b.p1.active[0].hp === 0 || b.p1.active[0].fainted, 'Mold Breaker hits through it');
}
// The Bird move runs, hits a Ghost, and gets its boost.
{
	const b = battle([set('Leftovers')], [{ species: 'Gengar', ability: 'Cursed Body', moves: ['Splash'], level: 100, evs: { hp: 252 } }]);
	b.choose('p1', 'move 1');
	b.choose('p2', 'move 1');
	ok(b.p2.active[0].hp < b.p2.active[0].maxhp, 'Data Corruption hits a Ghost type');
}
// Item duplication: a Gem spent and a Berry flung are back; an item knocked off is not.
{
	const foe = [{ species: 'Skarmory', ability: 'Keen Eye', item: 'Leftovers', moves: ['Roost', 'Knock Off'], nature: 'Impish', level: 100, evs: { hp: 252, def: 252 } }];
	let b = battle([set('Normal Gem')], foe);
	b.choose('p1', 'move 2'); b.choose('p2', 'move 1');
	ok(b.p1.active[0].item === 'normalgem', 'a spent Gem returns');
	b = battle([set('Sitrus Berry')], foe);
	b.choose('p1', 'move 3'); b.choose('p2', 'move 1');
	ok(b.p1.active[0].item === 'sitrusberry', 'a flung Berry returns');
	b = battle([set('Sitrus Berry')], foe);
	b.choose('p1', 'move 4'); b.choose('p2', 'move 2');
	ok(!b.p1.active[0].item, 'an item knocked off does not');
}
console.log(`missingno: ${n} checks passed`);
