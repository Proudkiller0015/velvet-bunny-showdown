'use strict';
/**
 * Corrosive Gas (the owner, 13 Nov 2026): it poisons as well as taking the item, Steel types included but not
 * Poison types, never fails for want of an item, and is legal again in RP (data/velvet/corrosive-gas.js).
 *
 *   node test/corrosive-gas.test.js
 */

const { Battle, TeamValidator } = require('pokemon-showdown');
const Dex = require('../src/rp-dex')();

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

/** Weezing uses Corrosive Gas on `foe` (who splashes); returns the foe and the battle log. */
function gas(foe, before) {
	const b = new Battle({ formatid: 'gen9rpcustomgame', seed: [1, 2, 3, 4] });
	b.setPlayer('p1', { team: [{ species: 'Weezing', ability: 'Levitate', item: '', moves: ['corrosivegas', 'willowisp'], level: 100, evs: {}, ivs: {}, nature: 'Hardy' }] });
	b.setPlayer('p2', { team: [{ level: 100, evs: {}, ivs: {}, nature: 'Hardy', item: '', moves: ['splash'], ...foe }] });
	if (b.requestState === 'teampreview') b.makeChoices('team 1', 'team 1');
	if (before) before(b);
	b.makeChoices('move corrosivegas', 'move splash');
	return { mon: b.p2.active[0], log: b.log.join('\n') };
}

const move = Dex.moves.get('corrosivegas');
check(/poison/i.test(move.shortDesc) && /Steel/.test(move.desc), `the move says it poisons, Steel types too (${move.shortDesc})`);

{
	const { mon, log } = gas({ species: 'Skarmory', ability: 'Sturdy', item: 'Leftovers' });
	check(!mon.item && /-enditem\|p2a: Skarmory\|Leftovers/.test(log), "a Steel type loses its item");
	check(mon.status === 'psn', `and is poisoned, through its immunity (${mon.status})`);
}
{
	const { mon } = gas({ species: 'Toxapex', ability: 'Regenerator', item: 'Black Sludge' });
	check(!mon.item && mon.status === '', `a Poison type loses its item but is not poisoned (${mon.item}, "${mon.status}")`);
}
{
	const { mon } = gas({ species: 'Revavroom', ability: 'Overcoat', item: 'Leftovers' });
	check(mon.status === '', 'a Steel/Poison type is not poisoned (it is Poison)');
}
{
	const { mon, log } = gas({ species: 'Blissey', ability: 'Natural Cure' });
	check(mon.status === 'psn' && !/\|-fail\|/.test(log), `with no item it does not fail: still poisons (${mon.status})`);
}
{
	// Burned first (Will-O-Wisp), then gassed: the burn stays.
	const b = new Battle({ formatid: 'gen9rpcustomgame', seed: [1, 2, 3, 4] });
	b.setPlayer('p1', { team: [{ species: 'Weezing', ability: 'Levitate', moves: ['corrosivegas', 'willowisp'], level: 100, evs: {}, ivs: {}, nature: 'Hardy' }] });
	b.setPlayer('p2', { team: [{ species: 'Snorlax', ability: 'Thick Fat', item: 'Leftovers', moves: ['splash'], level: 100, evs: {}, ivs: {}, nature: 'Hardy' }] });
	if (b.requestState === 'teampreview') b.makeChoices('team 1', 'team 1');
	b.p2.active[0].setStatus('brn');
	b.makeChoices('move corrosivegas', 'move splash');
	check(b.p2.active[0].status === 'brn' && !b.p2.active[0].item, 'an already statused Pokemon keeps its status (and still loses its item)');
}
{
	const { mon } = gas({ species: 'Blissey', ability: 'Natural Cure' }, (b) => b.field.setTerrain('mistyterrain', b.p2.active[0]));
	check(mon.status === '', 'Misty Terrain still protects a grounded Pokemon');
}

// Legal in RP for its old learners and the new ones; native formats keep the official rules.
const valid = (format, species, ability) =>
	!new TeamValidator(format).validateTeam([{ species, ability, item: '', moves: ['corrosivegas'], level: 100, evs: { hp: 4 }, ivs: {}, nature: 'Hardy' }]);
check(valid('gen9rpou', 'Gengar', 'Cursed Body'), 'RP OU: Gengar (a Generation 8 learner) can bring it');
check(valid('gen9rpru', 'Muk', 'Poison Touch'), 'RP RU: Muk (new) can bring it');
check(valid('gen9rpnu', 'Drifblim', 'Unburden'), 'RP NU: Drifblim (new, gas balloon) can bring it');
check(valid('gen9rplc', 'Croagunk', 'Dry Skin'), "RP LC: Croagunk (Toxicroak's pre-evolution) can bring it");
check(!valid('gen9rpou', 'Garchomp', 'Rough Skin'), "RP OU: Garchomp, who doesn't learn it, can't");
check(!valid('gen9ou', 'Gengar', 'Cursed Body'), 'native Gen 9 OU keeps it unobtainable');

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
