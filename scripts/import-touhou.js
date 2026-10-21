'use strict';
/**
 * Import the Touhou Pokemon from the Touhoumons solomod (DH2, MIT).
 *
 *   node scripts/import-touhou.js <path to DH2's data/mods/toho>
 *
 * Source: github.com/scoopapa/DH2, data/mods/toho ("Touhoumons v5"), MIT licence.
 *
 * Writes data/velvet/touhou-data.json (species, learnsets, search aliases) and copies
 * the sprites into client/sprites/touhou/. The moves, abilities and items are ported
 * by hand in data/velvet/touhou.js, since they are code; only the plain data is read
 * here. The mod's .ts files are evaluated as object literals in a vm sandbox with
 * nothing in scope, never required, so nothing in them runs against this server.
 *
 * What changes on the way in (data/velvet/touhou.js explains each):
 *   - Numbers: the mod's 1..134 are real Pokedex numbers, so ours start at 2101,
 *     and a forme takes its base's number as Showdown's own formes do.
 *   - Two names that Showdown's "Base-Forme" convention cannot read:
 *     "Hecatia-Otherworld" (a base species with a hyphen) becomes Hecatia, whose base
 *     forme is Otherworld; "Ichirin and Unzan" becomes Ichirin Kumoi-Unzan. The old
 *     names stay findable as search aliases.
 *   - Height, weight, colour and egg group, which the mod leaves out (Low Kick and
 *     Heavy Slam need a weight): a person's size, the colour of the first type.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const MOD = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.existsSync(path.join(MOD, 'pokedex.ts'))) {
	console.error('usage: node scripts/import-touhou.js <DH2 data/mods/toho>');
	process.exit(1);
}
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** One `export const X: Type = {...};` file, as data. */
function load(file) {
	const src = fs.readFileSync(path.join(MOD, file), 'utf8').replace(/^export const \w+\s*:[^=]*=\s*/m, 'result = ');
	const box = { result: null };
	vm.runInNewContext(src, box, { timeout: 2000 });
	return box.result;
}

const Pokedex = load('pokedex.ts');
const Learnsets = load('learnsets.ts');
const Aliases = load('aliases.ts');

const FIRST_NUM = 2101;
const RENAME = {
	hecatiaotherworld: { id: 'hecatia', name: 'Hecatia', baseForme: 'Otherworld' },
	hecatiaearth: { baseSpecies: 'Hecatia' },
	hecatiamoon: { baseSpecies: 'Hecatia' },
	ichirinandunzan: { id: 'ichirinkumoiunzan', name: 'Ichirin Kumoi-Unzan' },
};
const COLOR = {
	Normal: 'White', Fire: 'Red', Water: 'Blue', Electric: 'Yellow', Grass: 'Green', Ice: 'Blue',
	Fighting: 'Red', Poison: 'Purple', Ground: 'Brown', Flying: 'Blue', Psychic: 'Pink', Bug: 'Green',
	Rock: 'Brown', Ghost: 'Purple', Dragon: 'Blue', Dark: 'Black', Steel: 'Gray', Fairy: 'Pink',
};

const species = {};
const learnsets = {};
const sprites = {};       // our id -> the mod's file name (without .png)
const numOf = {};         // the mod's num -> ours
const modNum = {};        // our id -> the mod's num
let next = FIRST_NUM;
for (const [modId, s] of Object.entries(Pokedex)) {
	const re = RENAME[modId] || {};
	const id = re.id || modId;
	const name = re.name || s.name;
	const baseName = re.baseSpecies || s.baseSpecies;
	const out = { num: 0, name, types: s.types.slice() };
	if (s.gender) out.gender = s.gender;
	out.baseStats = { ...s.baseStats };
	out.abilities = { ...s.abilities };
	out.heightm = 1.5;
	out.weightkg = 50;
	out.color = COLOR[s.types[0]] || 'Red';
	out.eggGroups = ['Undiscovered'];
	out.tags = [];
	out.gen = 9;
	if (baseName) {
		out.baseSpecies = baseName;
		out.forme = s.forme;
	}
	if (re.baseForme) out.baseForme = re.baseForme;
	for (const key of ['requiredItem', 'requiredAbility', 'battleOnly', 'canDynamax']) if (s[key]) out[key] = s[key];
	species[id] = out;
	// A forme shares its base's number; a base gets the next free one.
	if (!baseName) numOf[s.num] = next++;
	sprites[id] = modId;
	modNum[id] = s.num;
}
for (const [id, s] of Object.entries(species)) {
	if (!s.baseSpecies) { s.num = numOf[modNum[id]]; continue; }
	const base = species[toID(s.baseSpecies)];
	if (!base) throw new Error(`${s.name}: no base ${s.baseSpecies}`);
	s.num = base.num;
	base.otherFormes = [...(base.otherFormes || []), s.name];
	base.formeOrder = base.formeOrder || [base.name];
	base.formeOrder.push(s.name);
}
for (const [modId, entry] of Object.entries(Learnsets)) {
	// The mod files Ichirin's Unzan forme's learnset under a third spelling.
	const id = modId === 'ichirinunzan' ? 'ichirinkumoiunzan' : (RENAME[modId] && RENAME[modId].id) || modId;
	if (!species[id]) { console.log(`learnset for unknown ${modId}: skipped`); continue; }
	learnsets[id] = { ...entry.learnset };
}

// Search aliases: [alias, target id]. The mod's own, plus the old names.
const aliases = [];
for (const [alias, target] of Object.entries(Aliases)) {
	// Three of the mod's aliases misspell the name they point at.
	const t = { satorikomeji: 'satorikomeiji', koishikomeji: 'koishikomeiji', keikihinayasushin: 'keikihaniyasushin' }[toID(target)] || toID(target);
	const id = (RENAME[t] && RENAME[t].id) || (t === 'ichirinandunzan' ? 'ichirinkumoiunzan' : t);
	if (!species[id] || !toID(alias)) { console.log(`alias ${alias} -> ${target}: no such Pokemon, skipped`); continue; }
	aliases.push([toID(alias), id]);
}
aliases.push(['hecatiaotherworld', 'hecatia'], ['ichirinandunzan', 'ichirinkumoiunzan']);

fs.writeFileSync(path.join(ROOT, 'data', 'velvet', 'touhou-data.json'), JSON.stringify({
	source: 'Touhoumons v5 solomod, github.com/scoopapa/DH2 data/mods/toho (MIT)',
	species, learnsets, aliases,
}, null, '\t') + '\n');

// Sprites: <id>.png, -back, -shiny, -back-shiny, -icon. The Okina Matara seasons have no
// icon of their own and use hers (client/js/velvet-data.js).
const dest = path.join(ROOT, 'client', 'sprites', 'touhou');
fs.mkdirSync(dest, { recursive: true });
const KINDS = [['front', ''], ['back', '-back'], ['front-shiny', '-shiny'], ['back-shiny', '-back-shiny'], ['icons', '-icon']];
let copied = 0;
const missing = [];
for (const [id, file] of Object.entries(sprites)) {
	for (const [dir, suffix] of KINDS) {
		const from = path.join(MOD, 'sprites', dir, file + '.png');
		if (!fs.existsSync(from)) { missing.push(`${dir}/${file}`); continue; }
		fs.copyFileSync(from, path.join(dest, id + suffix + '.png'));
		copied++;
	}
}
// The client's sprite table (client/js/velvet-data.js, between its TOUHOU-ART markers): every
// id, and the base whose icon a forme without one borrows.
const iconOf = {};
for (const [id, file] of Object.entries(sprites)) {
	if (fs.existsSync(path.join(MOD, 'sprites', 'icons', file + '.png'))) continue;
	if (species[id].baseSpecies) iconOf[id] = toID(species[id].baseSpecies);
}
const client = path.join(ROOT, 'client', 'js', 'velvet-data.js');
const START = '/* TOUHOU-ART-START: written by scripts/import-touhou.js */';
const END = '/* TOUHOU-ART-END */';
const page = fs.readFileSync(client, 'utf8');
const a = page.indexOf(START);
const b = page.indexOf(END);
if (a < 0 || b < 0) throw new Error('no TOUHOU-ART markers in client/js/velvet-data.js');
fs.writeFileSync(client, page.slice(0, a + START.length) +
	`\n\tvar TOUHOU_ART = ${JSON.stringify(Object.keys(sprites))};` +
	`\n\tvar TOUHOU_ICON_OF = ${JSON.stringify(iconOf)};\n\t` + page.slice(b));

console.log(`${Object.keys(species).length} species (${Object.values(species).filter(s => !s.baseSpecies).length} base), ` +
	`${Object.keys(learnsets).length} learnsets, ${aliases.length} aliases, ${copied} sprites`);
if (missing.length) console.log(`no sprite: ${missing.join(', ')}`);
