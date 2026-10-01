'use strict';
/**
 * Every official Showdown avatar, for the avatar picker (owner, 1 Oct 2026: the list
 * in Settings was outdated - it only ever showed the 293 numbered ones).
 *
 *   node scripts/build-avatars.js
 *
 * Reads OFFICIAL_AVATARS and the artist sets out of the pokemon-showdown package (the
 * same list our server accepts for /avatar), leaves out the names the numbered grid
 * already shows (client/js/battle-dex-data.js BattleAvatarNumbers), and writes them
 * between the AVATAR-DATA markers in client/js/velvet-data.js. Showdown's personal
 * custom avatars (#name) are not in those sets, so they never appear.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'node_modules', 'pokemon-showdown', 'dist', 'server', 'chat-commands', 'avatars.js'), 'utf8');
const names = new Set();
for (const m of src.matchAll(/const OFFICIAL_AVATARS[A-Z_0-9]* = \/\* @__PURE__ \*\/ new Set\(\[([\s\S]*?)\]\);/g)) {
	for (const n of m[1].matchAll(/"([^"]+)"/g)) names.add(n[1]);
}
if (names.size < 500) throw new Error(`only ${names.size} official avatars found - has the package changed?`);

const dexData = fs.readFileSync(path.join(ROOT, 'client', 'js', 'battle-dex-data.js'), 'utf8');
const numbered = dexData.slice(dexData.indexOf('BattleAvatarNumbers={'));
const shown = new Set([...numbered.slice(0, numbered.indexOf('}')).matchAll(/:'([^']+)'/g)].map(m => m[1]));
const extra = [...names].filter(n => !shown.has(n)).sort();

const target = path.join(ROOT, 'client', 'js', 'velvet-data.js');
let js = fs.readFileSync(target, 'utf8');
const eol = js.includes('\r\n') ? '\r\n' : '\n';
js = js.replace(/\r\n/g, '\n');
const a = js.indexOf('\t/* AVATAR-DATA-START');
const b = js.indexOf('/* AVATAR-DATA-END */');
if (a < 0 || b < 0) throw new Error('no AVATAR-DATA markers in velvet-data.js');
js = js.slice(0, a) + '\t/* AVATAR-DATA-START: written by scripts/build-avatars.js */\n\tvar OFFICIAL_AVATARS = ' + JSON.stringify(extra) + ';\n\t' + js.slice(b);
fs.writeFileSync(target, js.replace(/\n/g, eol));
console.log(`${names.size} official avatars, ${shown.size} already in the numbered grid, ${extra.length} added to the picker`);
