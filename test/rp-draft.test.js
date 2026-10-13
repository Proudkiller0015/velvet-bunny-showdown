'use strict';

/*
 * [Gen 9] RP Draft: the Season 1 pool only, singles, and Baton Pass cannot be
 * selected while the user has a raised stat.
 */

const { Dex, TeamValidator, BattleStream, getPlayerStreams, Teams } = require('pokemon-showdown');

let pass = 0, fail = 0;
const ok = (cond, what) => { if (cond) pass++; else { fail++; console.log('FAIL', what); } };

const format = Dex.formats.get('gen9rpdraft');
ok(format.exists && format.gameType === 'singles', 'RP Draft exists and is singles');
ok(format.ruleset.includes('Terastal Clause') && format.ruleset.includes('Z-Move Clause'), 'no Tera, no Z-Moves');

const v = TeamValidator.get('gen9rpdraft');
const check = (set) => v.validateTeam([{ level: 100, evs: { hp: 4 }, nature: 'Adamant', ...set }]);
ok(/banned/.test(String(check({ species: 'Metagross', item: 'Metagrossite', ability: 'Clear Body', moves: ['Meteor Mash'] }))), 'Mega Metagross banned');
ok(!check({ species: 'Metagross', item: 'Leftovers', ability: 'Clear Body', moves: ['Meteor Mash'] }), 'plain Metagross is fine');
ok(!check({ species: 'Gardevoir', item: 'Gardevoirite', ability: 'Trace', moves: ['Moonblast'] }), 'Mega Gardevoir (pool entry) is legal');
ok(/banned/.test(String(check({ species: 'Zamazenta', item: 'Leftovers', ability: 'Dauntless Shield', moves: ['Body Press'] }))), 'Zamazenta banned');
ok(/banned/.test(String(check({ species: 'Magearna', item: 'Leftovers', ability: 'Soul-Heart', moves: ['Flash Cannon'] }))), 'Magearna banned');
ok(/banned/.test(String(check({ species: 'Lucario', item: 'Lucarionite', ability: 'Justified', moves: ['Close Combat'] }))), 'Mega Lucario banned');
ok(!check({ species: 'Lucario', item: 'Life Orb', ability: 'Justified', moves: ['Close Combat'] }), 'plain Lucario is fine');
ok(/not in the Season 1/.test(String(check({ species: 'Arceus', item: 'Leftovers', ability: 'Multitype', moves: ['Judgment'] }))), 'Arceus is not in the pool');
ok(!check({ species: 'Scolipede', item: 'Focus Sash', ability: 'Speed Boost', moves: ['Baton Pass', 'Swords Dance'] }), 'Baton Pass is legal');
ok(!check({ species: 'Pansage', item: 'Eviolite', ability: 'Gluttony', moves: ['Seed Bomb'] }), 'Pansage legal');

// Baton Pass is selectable until the user boosts.
(async () => {
  const stream = new BattleStream();
  const ps = getPlayerStreams(stream);
  const t1 = Teams.pack([
    { species: 'Scolipede', item: 'Focus Sash', ability: 'Swarm', moves: ['Swords Dance', 'Baton Pass', 'Megahorn'], evs: { hp: 4 }, level: 100 },
    { species: 'Garchomp', item: 'Leftovers', ability: 'Rough Skin', moves: ['Earthquake'], level: 100 },
  ]);
  const t2 = Teams.pack([{ species: 'Blissey', item: 'Leftovers', ability: 'Natural Cure', moves: ['Soft-Boiled'], level: 100 }]);
  const reqs = [];
  (async () => {
    for await (const chunk of ps.p1) {
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('|request|') || line.length < 12) continue;
        const r = JSON.parse(line.slice(9));
        if (r.active) reqs.push(r.active[0].moves.find(m => m.id === 'batonpass'));
      }
    }
  })();
  (async () => { for await (const _ of ps.p2); })();
  ps.omniscient.write(`>start {"formatid":"gen9rpdraft"}\n>player p1 {"name":"A","team":${JSON.stringify(t1)}}\n>player p2 {"name":"B","team":${JSON.stringify(t2)}}\n>p1 team 12\n>p2 team 1`);
  await new Promise(r => setTimeout(r, 300));
  ok(reqs.length && !reqs[reqs.length - 1].disabled, 'Baton Pass selectable before boosting');
  ps.omniscient.write('>p1 move 1\n>p2 move 1');
  await new Promise(r => setTimeout(r, 300));
  ok(reqs.length >= 2 && reqs[reqs.length - 1].disabled, 'Baton Pass disabled after Swords Dance');
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
