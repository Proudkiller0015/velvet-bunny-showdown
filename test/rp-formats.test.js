'use strict';
/**
 * A ladder game is not a roleplay battle.
 *
 * The Discord bot pays EXP for every finished battle the server puts in its
 * replay feed, and the server used to decide what went in there by the shape of
 * the format name: anything starting `gen<n>rp`. That is twenty-six searchable,
 * rated ladder tiers as well as the six formats the story is played in, so
 * winning a game of RP OU levelled up an RP character.
 *
 * This walks the real format list and checks the two halves apart, so a tier
 * added later - or a story format renamed - is caught here rather than in
 * somebody's EXP total.
 *
 *   node test/rp-formats.test.js
 */

const { RP_FORMATS, RP_PVP_FORMATS, RP_STORY_FORMATS } = require('../src/rp-formats');

let passed = 0, failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); ok ? passed++ : failed++; };
const toID = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

const list = require('../config/custom-formats.js');
const formats = (list.Formats || list).filter(f => f && f.name);
const rpNamed = formats.filter(f => /^gen[0-9]+rp/.test(toID(f.name)));
check(rpNamed.length > 20, `the format list has RP-named formats to sort (${rpNamed.length})`);

// The ladder: searchable and rated. None of these is the story, whatever it is called.
const ladder = rpNamed.filter(f => f.searchShow && f.rated);
const leaked = ladder.filter(f => RP_STORY_FORMATS.has(toID(f.name)));
check(ladder.length > 0, `RP-named ladder tiers exist (${ladder.length}: ${ladder.slice(0, 3).map(f => toID(f.name)).join(', ')}...)`);
check(!leaked.length, `no searchable rated tier counts as a story battle${leaked.length ? ` - ${leaked.map(f => toID(f.name)).join(', ')}` : ''}`);

// The story: the formats only reachable by challenge, which the RP hands out itself.
const story = rpNamed.filter(f => !f.searchShow && !f.rated).map(f => toID(f.name));
const missing = story.filter(id => !RP_STORY_FORMATS.has(id));
check(!missing.length, `every unladdered RP format is a story battle${missing.length ? ` - missing ${missing.join(', ')}` : ''}`);

// Nothing in the sets has been renamed out from under them.
const known = new Set(formats.map(f => toID(f.name)));
const stale = [...RP_STORY_FORMATS].filter(id => !known.has(id));
check(!stale.length, `every listed story format still exists${stale.length ? ` - stale ${stale.join(', ')}` : ''}`);

// The sets nest: a wild or PvP format is always a story format.
const outside = [...RP_FORMATS, ...RP_PVP_FORMATS].filter(id => !RP_STORY_FORMATS.has(id));
check(!outside.length, `the wild and PvP formats are all story formats${outside.length ? ` - ${outside.join(', ')}` : ''}`);
check(!RP_PVP_FORMATS.has('gen9rpcustomgame'), 'RP Custom Game is not a bag-item PvP format');

// The battle that started this: RP OU pays nothing, RP Battle pays.
check(!RP_STORY_FORMATS.has('gen9rpou'), 'a finished [Gen 9] RP OU game never reaches the Discord feed');
check(RP_STORY_FORMATS.has('gen9rpbattle'), 'a finished [Gen 9] RP Battle still does');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
