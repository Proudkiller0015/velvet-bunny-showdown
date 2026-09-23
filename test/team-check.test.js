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

// The Let's Go partner formes stay illegal: a box Eevee is not an Eevee-Starter.
r = rp.checkTeam({ box: [{ species: 'Eevee', level: 15 }] }, team(['Eevee-Starter', 15]));
check(!r.ok, 'Eevee-Starter does not count as a box Eevee');

// Another form of a Pokémon in the box is the same Pokémon; a regional variant is not.
check(rp.checkTeam({ box: [{ species: 'Landorus', level: 50 }], badges: 0 }, team(['Landorus-Therian', 50])).ok, 'Landorus-Therian for a box Landorus');
check(rp.checkTeam({ box: [{ species: 'Rotom-Wash', level: 30 }], badges: 0 }, team(['Rotom-Heat', 30])).ok, 'Rotom-Heat for a box Rotom-Wash');
check(rp.checkTeam({ box: [{ species: 'Pikachu', level: 30 }], badges: 0 }, team(['Pikachu-Alola', 30])).ok, "Pikachu's Alola cap is a costume");
r = rp.checkTeam({ box: [{ species: 'Vulpix', level: 20 }], badges: 3 }, team(['Vulpix-Alola', 20]));
check(!r.ok, 'an Alolan Vulpix is not a box Vulpix');
r = rp.checkTeam({ box: [{ species: 'Landorus', level: 50 }], badges: 0 }, team(['Landorus-Therian', 51]));
check(!r.ok && /Lv\. 51/.test(r.problems[0]), 'a form still has to fit the box level');
// A form that needs its held item waits for the first badge.
r = rp.checkTeam({ box: [{ species: 'Giratina', level: 60 }], badges: 0 }, team(['Giratina-Origin', 60]));
check(!r.ok && /held items unlock at the first badge/.test(r.problems[0]), `Giratina-Origin before a badge is refused (${r.problems[0]})`);
check(rp.checkTeam({ box: [{ species: 'Giratina', level: 60 }], badges: 1 }, team(['Giratina-Origin', 60])).ok, 'and fine with one badge');

// RP Custom Game takes anything; RP Battle still takes Samantha.
{
	const { Dex, TeamValidator } = require('pokemon-showdown');
	const illegal = [{ species: 'Eevee-Starter', ability: 'Huge Power', item: '', moves: ['veeveevolley', 'spore'], level: 250, evs: {}, ivs: {}, nature: 'Hardy' }];
	check(Dex.formats.get('gen9rpcustomgame').exists && !Dex.formats.get('gen9rpcustomgame').rated, 'RP Custom Game exists, unrated');
	check(!new TeamValidator('gen9rpcustomgame').validateTeam(illegal), 'and accepts an illegal hackmons team');
	check(!new TeamValidator('gen9rpbattle').validateTeam([{ species: 'Samantha', ability: 'Queen Wrath', item: '', moves: ['queenbeam'], level: 100, evs: {}, ivs: {}, nature: 'Hardy' }]), 'Samantha is still legal in RP Battle');
}

// Items in RP battles between players.
{
	rp.setBags({ players: [
		{ showdown: 'Mira Player', character: 'Mira', items: { hyperpotion: 2 } },
		{ showdown: 'AoiNPC', character: 'Aoi', npc: true, items: {} },
	] });
	check(rp.canUsePvpItem('miraplayer', 'hyperpotion', 1).ok && !rp.canUsePvpItem('miraplayer', 'hyperpotion', 2).ok, 'a player is limited to their bag');
	check(!rp.canUsePvpItem('miraplayer', 'revive', 0).ok, 'and has nothing they did not bring');
	check(rp.canUsePvpItem('aoinpc', 'fullrestore', 4).ok && !rp.canUsePvpItem('aoinpc', 'fullrestore', 5).ok, 'an NPC has 5 of each');
	check(!rp.canUsePvpItem('stranger', 'potion', 0).ok, 'a player with no linked character has none');
	const itemLog = ['|player|p1|Mira Player|1|', '|player|p2|AoiNPC|1|', '|-message|Mira Player used a Hyper Potion on Chompy!', '|-message|AoiNPC used a Full Restore on Onix!', '|-message|Mira Player used a Hyper Potion on Chompy!'];
	const itemSides = rp.sidesInLog(itemLog);
	check(itemSides.miraplayer.itemsUsed.hyperpotion === 2 && itemSides.aoinpc.itemsUsed.fullrestore === 1, 'the replay feed carries each side\'s items used');

	// RP Custom Game: items work in the battle itself (unlimited; /useitem checks nothing there).
	const { Battle } = require('pokemon-showdown');
	const b = new Battle({ formatid: 'gen9rpcustomgame', seed: [1, 2, 3, 4] });
	const set = s => [{ species: s, ability: 'Static', item: '', moves: ['splash'], level: 50, evs: {}, ivs: {}, nature: 'Hardy' }];
	b.setPlayer('p1', { name: 'A', team: set('Pikachu') });
	b.setPlayer('p2', { name: 'B', team: set('Eevee') });
	if (b.requestState === 'teampreview') b.makeChoices('team 1', 'team 1');
	const pika = b.p1.active[0];
	pika.hp = 10;
	b.makeChoices('item potion Pikachu', 'move 1');
	check(pika.hp > 10, 'RP Custom Game battles accept a Potion');
}

// The tutorial: forced teams, 1 Potion and 1 Poke Ball, nothing needed.
{
	const { Battle } = require('pokemon-showdown');
	const spawned = [];
	const deps = { isOnline: () => true, spawn: enc => spawned.push(enc) };
	const answer = rp.requestTutorial({ showdown: 'Newbie' }, deps);
	check(answer.ok && spawned.length === 1 && spawned[0].format === 'gen9rptutorial' && spawned[0].name === 'Wild Rattata', 'the tutorial spawns a wild Rattata in RP Tutorial');
	const tut = spawned[0];
	check(rp.canUseItem(tut, 'potion', 0).ok && !rp.canUseItem(tut, 'potion', 1).ok && !rp.canUseItem(tut, 'superpotion', 0).ok, 'exactly 1 Potion');
	check(rp.canThrow(tut, 'poke', 0).ok && !rp.canThrow(tut, 'poke', 1).ok && !rp.canThrow(tut, 'ultra', 0).ok, 'and exactly 1 Poke Ball');
	check(rp.checkTeam(tut, [{ species: 'Mewtwo', level: 100 }]).ok, 'no box to check a team against');
	const tb = new Battle({ formatid: 'gen9rptutorial', seed: [1, 2, 3, 4] });
	tb.setPlayer('p1', { name: 'Wild Rattata' });
	tb.setPlayer('p2', { name: 'Newbie' });
	check(tb.p2.pokemon.length === 1 && tb.p2.pokemon[0].species.name === 'Pikachu' && tb.p2.pokemon[0].level === 5 && tb.p1.pokemon[0].species.name === 'Rattata', 'no team needed: Lv. 5 Pikachu against Lv. 5 Rattata');
	tb.p1.active[0].hp = 1;
	tb.makeChoices('move 1', 'ball poke');
	const result = rp.resultFromLog(tut, tb.log, 'newbie');
	check(tb.ended && result.outcome === 'caught', 'the Rattata can be caught (and the result says so)');
	check(rp.publicView(tut).tutorial === true, 'Discord is told it was the tutorial');
	check(rp.requestTutorial({ showdown: 'Newbie' }, deps).again, 'asking again brings the same tutorial back');
}

// Who fainted, read off a battle log.
const log = [
	'|player|p1|RpTester|1|', '|player|p2|Wild Rattata|1|',
	'|switch|p1a: Sparky|Pikachu, L12, M|30/30', '|switch|p2a: Rattata|Rattata, L5|100/100',
	'|faint|p1a: Sparky', '|switch|p1a: Chiko|Chikorita, L5, F|20/20', '|faint|p1a: Chiko',
	'|-message|RpTester used a Revive on Chiko!', '|faint|p2a: Rattata',
];
const fainted = rp.resultFromLog({ userid: 'rptester', showdown: 'RpTester' }, log, 'rptester').fainted;
check(fainted.length === 1 && fainted[0].species === 'Pikachu' && fainted[0].level === 12, `fainted Pokémon are reported, revived ones aren't (${JSON.stringify(fainted)})`);
const sides = rp.sidesInLog(log);
check(sides.rptester.team.length === 2 && sides.wildrattata.fainted.length === 1, 'both sides of a battle: team sent out and fainted');
/*
 * A Nuzleaf with a Broken Pact never writes a `faint` line - it comes back as
 * Nuzleaf-SOLD at full HP instead (data/velvet/items.js). The battle treats
 * that as "it did not faint"; the RP still has to treat it as a Pokemon that
 * was knocked out, or it walks out of the fight with no need of a Centre.
 */
const soldLog = [
	'|player|p1|RpTester|1|', '|player|p2|Wild Rattata|1|',
	'|switch|p1a: Nuzleaf|Nuzleaf, L20, M|60/60', '|switch|p2a: Rattata|Rattata, L5|100/100',
	'|-enditem|p1a: Nuzleaf|Broken Pact',
	'|detailschange|p1a: Nuzleaf|Nuzleaf-SOLD, L20, M',
	'|-message|Nuzleaf was sold. It came back anyway.',
	'|faint|p2a: Rattata',
];
const sold = rp.resultFromLog({ userid: 'rptester', showdown: 'RpTester' }, soldLog, 'rptester').fainted;
check(sold.length === 1 && sold[0].species === 'Nuzleaf',
	`a Nuzleaf sold by a Broken Pact counts as fainted (${JSON.stringify(sold)})`);
// And a Revive still heals properly: that one is on its feet, not on the list.
const revived = rp.resultFromLog({ userid: 'rptester', showdown: 'RpTester' }, [
	'|player|p1|RpTester|1|', '|switch|p1a: Chiko|Chikorita, L5, F|20/20', '|faint|p1a: Chiko',
	'|-message|RpTester used a Revive on Chiko!',
], 'rptester').fainted;
check(revived.length === 0, 'a Pokémon revived in the battle is not fainted afterwards');

const withPreview = rp.sidesInLog(['|player|p1|Ace|1|', '|player|p2|Leader|1|', '|poke|p1|Garchomp, L50, F|', '|poke|p1|Lucario, L48, M|', '|poke|p2|Onix, L40|', '|switch|p1a: Chompy|Garchomp, L50, F|100/100']);
check(withPreview.ace.team.map(p => p.species).join() === 'Garchomp,Lucario', 'Team Preview gives the whole team, not just who came out');

check(rp.gimmickIn('move 1 terastallize') === 'tera', 'Tera is spotted in a choice');
check(rp.gimmickIn('move 2 mega') === 'mega', 'Mega');
check(rp.gimmickIn('move 3 zmove') === 'zmove', 'Z-Move');
check(rp.gimmickIn('move 1 dynamax, move 2') === 'dynamax', 'Dynamax in a doubles choice');
check(rp.gimmickIn('move 1, switch 3') === null, 'a plain choice uses none');

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
