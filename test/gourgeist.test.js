'use strict';
/**
 * Gourgeist (data/velvet/gourgeist.js): Harvest Lantern makes the foe part Ghost and
 * resizes it each turn toward the biggest pumpkin that still outspeeds the foe, growing
 * when none can or under Trick Room; Lantern Lunge goes first; Phantom Pursuit hits a
 * switcher. NU in RP, and nothing of it in the frozen draft.
 */
const assert = require('assert');
const { Battle, Teams, TeamValidator } = require('pokemon-showdown');

let n = 0;
const ok = (cond, what) => { assert.ok(cond, what); n++; };
const mon = (species, moves, extra = {}) => ({ name: species, species, ability: '', item: '', moves, nature: 'Serious', evs: { hp: 252 }, level: 100, ...extra });
const G = species => mon(species, ['Splash', 'Lantern Lunge', 'Phantom Pursuit', 'Trick Room'], { ability: 'Harvest Lantern' });
const battle = (a, b) => {
	const x = new Battle({ formatid: 'gen9rpbattle' });
	x.setPlayer('p1', { team: Teams.pack(a) });
	x.setPlayer('p2', { team: Teams.pack(b) });
	x.choose('p1', 'team 1');
	x.choose('p2', 'team 1');
	return x;
};
const turn = (b, p1, p2) => { b.choose('p1', p1); b.choose('p2', p2); };
const sizes = (b, turns, p1 = 'move 1') => Array.from({ length: turns }, () => { turn(b, p1, 'move 1'); return b.p1.active[0].species.name; });

let b = battle([G('Gourgeist')], [mon('Blissey', ['Splash'])]);
ok(b.p2.active[0].getTypes().join() === 'Normal,Ghost', 'switching in makes the foe part Ghost');
ok(sizes(b, 3).join() === 'Gourgeist-Large,Gourgeist-Large,Gourgeist-Large', 'grows to the biggest size still faster than Blissey, and stops there');
ok(b.p1.active[0].ability === 'harvestlantern', 'keeps Harvest Lantern after resizing');
ok(b.p1.active[0].hp === b.p1.active[0].maxhp, 'growing at full HP stays at full HP');

b = battle([G('Gourgeist-Small')], [mon('Dragapult', ['Splash'], { nature: 'Jolly', evs: { spe: 252 } })]);
ok(sizes(b, 4).join() === 'Gourgeist,Gourgeist-Large,Gourgeist-Super,Gourgeist-Super', 'no size outspeeds Dragapult: grows toward Super, one size a turn');

b = battle([G('Gourgeist-Super')], [mon('Sylveon', ['Splash'], { evs: { spe: 252 } })]);
ok(sizes(b, 4).join() === 'Gourgeist-Large,Gourgeist,Gourgeist-Small,Gourgeist-Small', 'only Small outspeeds Sylveon: shrinks one size a turn to it');

b = battle([G('Gourgeist-Small')], [mon('Blissey', ['Splash'])]);
ok(sizes(b, 2, 'move 4').join() === 'Gourgeist,Gourgeist-Large', 'grows under Trick Room');

b = battle([G('Gourgeist-Small')], [mon('Blissey', ['Night Shade'])]);
turn(b, 'move 1', 'move 1');
const g = b.p1.active[0];
const share = (g.maxhp - 100 * (g.maxhp / 334)) / g.maxhp; // not needed exactly: check it was kept, not healed
ok(g.species.name === 'Gourgeist' && Math.abs(g.hp / g.maxhp - (314 - 100) / 314) < 0.01, `HP percentage kept on resizing (${g.hp}/${g.maxhp})`);
void share;

b = battle([G('Gourgeist-Super')], [mon('Dragapult', ['Splash']), mon('Blissey', ['Splash'])]);
turn(b, 'move 2', 'move 1');
const moves = b.log.filter(l => l.startsWith('|move|')).map(l => l.split('|')[3]);
ok(moves.join() === 'Lantern Lunge,Splash', 'Lantern Lunge goes before a faster foe');
const hp = b.p2.active[0].hp;
turn(b, 'move 3', 'switch 2');
ok(b.log.some(l => /\|move\|p1a: Gourgeist\|Phantom Pursuit\|\|\[from\] move: Phantom Pursuit/.test(l)) && b.p2.pokemon.find(p => p.name === 'Dragapult').hp < hp, 'Phantom Pursuit hits the switcher before it leaves');

const set = (species, extra = {}) => ({ species, ability: 'Harvest Lantern', moves: ['lanternlunge', 'phantompursuit', 'chillingmist', 'meanlook'], evs: { hp: 4 }, level: 100, ...extra });
for (const species of ['Gourgeist', 'Gourgeist-Small', 'Gourgeist-Large', 'Gourgeist-Super']) {
	ok(!new TeamValidator('gen9rpnu').validateTeam([set(species)]), `${species} legal in RP NU`);
	ok((new TeamValidator('gen9rppu').validateTeam([set(species, { ability: 'Frisk', moves: ['shadowsneak'] })]) || []).length, `${species} is above RP PU`);
	ok((new TeamValidator('gen9rpdraft').validateTeam([set(species)]) || []).length, `${species}: Harvest Lantern is not in the frozen draft`);
}
ok(!new TeamValidator('gen9rplc').validateTeam([set('Pumpkaboo-Super', { level: 5 })]), 'Pumpkaboo has it all too');
console.log(`gourgeist: ${n} checks passed`);
