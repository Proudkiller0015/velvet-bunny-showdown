'use strict';
/**
 * The RP team check and the gimmick lock, without a server.
 *
 *   node test/team-check.test.js
 */

const rp = require('../src/rp-server');

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

const enc = { character: 'Mira', box: [{ species: 'Chikorita', level: 5 }, { species: 'Charizard', level: 40 }, { species: 'Pikachu', level: 12 }, { species: 'Pikachu', level: 20 }] };
const team = (...sets) => sets.map(([species, level]) => ({ species, level }));

check(rp.checkTeam(enc, team(['Chikorita', 5], ['Charizard', 40])).ok, 'Pokémon from the box at their levels are fine');
check(rp.checkTeam(enc, team(['Chikorita', 3])).ok, 'a lower level is fine');
let r = rp.checkTeam(enc, team(['Chikorita', 6]));
check(!r.ok && /Chikorita\*\* is Lv\. 6 on your team but Lv\. 5/.test(r.problems[0]), `too high a level is refused (${r.problems[0]})`);
r = rp.checkTeam(enc, team(['Chikorita', undefined]));
check(!r.ok && /Lv\. 100/.test(r.problems[0]), 'a level left blank counts as 100');
r = rp.checkTeam(enc, team(['Darkrai', 50]));
check(!r.ok && /doesn't have a \*\*Darkrai/.test(r.problems[0]), 'a Pokémon not in the box is refused');
check(rp.checkTeam(enc, team(['Pikachu', 12], ['Pikachu', 20])).ok, 'two of the same, each matched to one in the box');
r = rp.checkTeam(enc, team(['Pikachu', 20], ['Pikachu', 20]));
check(!r.ok, 'but one box Pokémon cannot be on the team twice');
check(rp.checkTeam(enc, team(['Charizard-Mega-X', 40])).ok, 'a battle-only forme counts as its base Pokémon');
check(rp.checkTeam({ box: null }, team(['Darkrai', 100])).ok, 'no box sent (an older bot): no check');
r = rp.checkTeam({ box: [{ species: 'Eevee', level: 10, away: 'fainted' }, { species: 'Ditto', level: 10, away: 'daycare' }] }, team(['Eevee', 10], ['Ditto', 10]));
check(!r.ok && /Eevee\*\* has fainted/.test(r.problems[0]) && /Ditto\*\* is at the daycare/.test(r.problems[1]), 'fainted and daycare Pokémon can\'t be on the team');

// Who fainted, read off a battle log.
const log = [
	'|player|p1|RpTester|1|', '|player|p2|Wild Rattata|1|',
	'|switch|p1a: Sparky|Pikachu, L12, M|30/30', '|switch|p2a: Rattata|Rattata, L5|100/100',
	'|faint|p1a: Sparky', '|switch|p1a: Chiko|Chikorita, L5, F|20/20', '|faint|p1a: Chiko',
	'|-message|RpTester used a Revive on Chiko!', '|faint|p2a: Rattata',
];
const fainted = rp.resultFromLog({ userid: 'rptester', showdown: 'RpTester' }, log, 'rptester').fainted;
check(fainted.length === 1 && fainted[0].species === 'Pikachu' && fainted[0].level === 12, `fainted Pokémon are reported, revived ones aren't (${JSON.stringify(fainted)})`);

check(rp.gimmickIn('move 1 terastallize') === 'tera', 'Tera is spotted in a choice');
check(rp.gimmickIn('move 2 mega') === 'mega', 'Mega');
check(rp.gimmickIn('move 3 zmove') === 'zmove', 'Z-Move');
check(rp.gimmickIn('move 1 dynamax, move 2') === 'dynamax', 'Dynamax in a doubles choice');
check(rp.gimmickIn('move 1, switch 3') === null, 'a plain choice uses none');

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
