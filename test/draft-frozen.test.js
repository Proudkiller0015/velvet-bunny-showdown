'use strict';
/**
 * The Season 1 draft plays on RP data frozen when its auction opened (24 Oct 2026):
 * data/velvet-draft-s1, through the gen9draftrp mod. The owner's rule is that the
 * draft's rules stay until the season ends, so nothing in that copy may change.
 *
 *   node test/draft-frozen.test.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Dex } = require('pokemon-showdown');

const FROZEN = 'b70236c00bbd76533e8e52801473f7361ff23d6af56b791d96cc06252baf8a74';

let pass = 0, fail = 0;
const check = (what, got, want) => {
	if (got === want) { pass++; console.log(`  ok   ${what}`); } else { fail++; console.log(`  FAIL ${what} -> got ${got}, want ${want}`); }
};

const dir = path.join(__dirname, '..', 'data', 'velvet-draft-s1');
const hash = crypto.createHash('sha256');
// Line endings normalised: a checkout on Windows must not read as a change.
for (const file of fs.readdirSync(dir).sort()) { hash.update(file); hash.update(fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n')); }
check('data/velvet-draft-s1 is unchanged since the auction opened', hash.digest('hex'), FROZEN);

const format = Dex.formats.get('gen9rpdraft');
check('[Gen 9] RP Draft plays on the frozen mod', format.mod, 'gen9draftrp');
const dex = Dex.forFormat(format);
check('which carries the RP data (Luxray is Electric/Dark)', dex.species.get('luxray').types.join('/'), 'Electric/Dark');

console.log(`=== ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
