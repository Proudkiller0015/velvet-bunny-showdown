'use strict';
/**
 * Messages the client has text for and the server never sends.
 *
 * Pursuit caught a switch and said nothing: the client's text has
 * "([TARGET] is being withdrawn...)" under `activate`, and the move's code never adds
 * the `-activate` line that shows it (owner, 2 Oct 2026). This lists every move, ability
 * and item in RP's data in the same position: a message key in the text, handlers of its
 * own, and no line in those handlers that could produce it.
 *
 *   node scripts/audit-messages.js [gen9rp]
 *
 * A candidate list, not a verdict: many effects are announced by the engine itself
 * (a volatile's -start, a side condition's -sidestart), which is why those keys are only
 * reported when the effect has no condition for the engine to announce.
 */
const path = require('path');
const { Dex } = require('pokemon-showdown');
const dex = Dex.mod(process.argv[2] || 'gen9rp');
const text = k => require(path.join(__dirname, '..', 'node_modules', 'pokemon-showdown', 'dist', 'data', 'text', `${k}.js`));
const TEXT = { Moves: text('moves').MovesText, Abilities: text('abilities').AbilitiesText, Items: text('items').ItemsText };

// Which protocol lines can show each text key.
const SHOWS = {
	activate: ['-activate', '-singleturn', '-singlemove', '-hint'],
	start: ['-start', '-sidestart', '-fieldstart', '-singleturn', '-singlemove', '-activate', 'addVolatile', 'addSideCondition', 'addPseudoWeather', 'setWeather', 'setTerrain', 'addSlotCondition'],
	end: ['-end', '-sideend', '-fieldend', 'removeVolatile', 'removeSideCondition'],
	block: ['-block', '-activate', '-fail', '-immune'],
	damage: ['-damage', 'this.damage(', 'directDamage'],
	heal: ['-heal', 'this.heal('],
	fail: ['-fail'],
	transform: ['-transform', 'formeChange', 'transformInto'],
	takeItem: ['-item', 'setItem', 'takeItem'],
	removeItem: ['-enditem', 'takeItem', 'useItem', 'eatItem'],
	move: ['-activate', 'useMove', 'runMove'],
};
const source = (obj, depth = 0) => {
	let out = '';
	for (const v of Object.values(obj || {})) {
		if (typeof v === 'function') out += v.toString() + '\n';
		else if (v && typeof v === 'object' && depth < 2 && !Array.isArray(v)) out += source(v, depth + 1);
	}
	return out;
};
const rows = [];
for (const [table, texts] of Object.entries(TEXT)) {
	for (const [id, entry] of Object.entries(dex.data[table])) {
		const t = texts[id];
		if (!t) continue;
		const code = source(entry);
		if (!code) continue;   // nothing of its own: the engine or another effect speaks for it
		// A condition the move adds under its own name is announced by its own handlers, read above.
		for (const key of Object.keys(SHOWS)) {
			if (typeof t[key] !== 'string' || !t[key].trim()) continue;
			if (SHOWS[key].some(line => code.includes(line))) continue;
			// Status and volatile effects are spoken for by conditions.js when the move only names them.
			if ((key === 'start' || key === 'end') && (entry.volatileStatus || entry.sideCondition || entry.pseudoWeather || entry.weather || entry.terrain || entry.slotCondition || (entry.self && entry.self.volatileStatus))) continue;
			rows.push({ table, id, key, text: t[key].trim(), nonstandard: entry.isNonstandard || '' });
		}
	}
}
for (const r of rows) console.log(`${r.table.padEnd(9)} ${r.id.padEnd(22)} ${r.key.padEnd(10)} ${r.nonstandard.padEnd(6)} ${r.text.slice(0, 90)}`);
console.log(`\n${rows.length} candidates`);
