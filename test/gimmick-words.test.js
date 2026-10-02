/**
 * Which gimmick a battle choice uses - and which choices use none.
 *
 * "ball ultra" was read as an Ultra Burst, so an Ultra Ball was refused for anyone without a
 * Z-Ring (owner, 2 Oct 2026: "ultra balls are bug"). Only a move can carry a gimmick.
 *
 *   node test/gimmick-words.test.js
 */
const rp = require('../src/rp-server.js');
const E = require('../src/encounters.js');

let passed = 0, failed = 0;
function check(what, got, want) {
	if (got === want) passed++;
	else { failed++; console.log(`FAIL ${what}: got ${got}, want ${want}`); }
}

check('move 1 ultra', rp.gimmickIn('move 1 ultra'), 'zmove');
check('move 2 zmove', rp.gimmickIn('move 2 zmove'), 'zmove');
check('move 1 mega', rp.gimmickIn('move 1 mega'), 'mega');
check('move 1 megax', rp.gimmickIn('move 1 megax'), 'mega');
check('move 1 terastallize', rp.gimmickIn('move 1 terastallize'), 'tera');
check('move 3 dynamax', rp.gimmickIn('move 3 dynamax'), 'dynamax');
check('doubles, second slot', rp.gimmickIn('move 1, move 2 mega'), 'mega');
check('plain move', rp.gimmickIn('move 1'), null);
check('switch', rp.gimmickIn('switch 2'), null);
check('run', rp.gimmickIn('run'), null);
check('an item', rp.gimmickIn('item maxpotion'), null);

// No ball, whatever it is called, is ever a gimmick - alone or beside a partner's move.
for (const ball of E.BALLS) {
	check(`ball ${ball.id}`, rp.gimmickIn(`ball ${ball.id}`), null);
	check(`ball ${ball.id} in a double`, rp.gimmickIn(`ball ${ball.id}, move 1`), null);
	check(`ball ${ball.name}`, rp.gimmickIn(`ball ${ball.name}`), null);
}

console.log(`=== ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
