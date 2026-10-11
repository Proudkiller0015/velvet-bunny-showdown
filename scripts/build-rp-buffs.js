'use strict';
/**
 * The #rp-buffs channel's data sections, worked out from the dex rather than written
 * down (the owner, 10 Oct 2026: "a full change channel for the rp documenting every
 * last change").
 *
 * Everything this server changes is a difference between the dex it runs (src/rp-dex)
 * and Showdown's own data files, which setup-config.js no longer hooks - so requiring
 * them directly gives the game as it ships. Each entry is tagged with the patch it
 * came in: the first commit that touched it, matched to the first patch note posted
 * after that commit (the post time is in the Discord message id saved beside each
 * note).
 *
 *   node scripts/build-rp-buffs.js             writes rp-bot/data/guides/rp-buffs-data.md
 *
 * Samantha, the developer's test Pokemon, and her moves are left out on purpose.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GUIDES = path.join(ROOT, '..', 'rp-bot', 'data', 'guides');
const DATA = path.join(ROOT, 'node_modules', 'pokemon-showdown', 'dist', 'data');
const V = {
	moves: require(path.join(DATA, 'moves.js')).Moves,
	abilities: require(path.join(DATA, 'abilities.js')).Abilities,
	items: require(path.join(DATA, 'items.js')).Items,
	pokedex: require(path.join(DATA, 'pokedex.js')).Pokedex,
	learnsets: require(path.join(DATA, 'learnsets.js')).Learnsets,
};
const Dex = require(path.join(ROOT, 'src', 'rp-dex'))();
const D = Dex.data;

const HIDDEN_SPECIES = ['samantha'];
const HIDDEN_MOVES = ['queenbeam', 'queensdance', 'queensblitz', 'queensheal'];
const HIDDEN_ABILITIES = ['queenwrath', 'queensmorph'];

// ---- patch tags -------------------------------------------------------------
const PATCHES = [
	['updates', '1.0'], ['updates-items', '1.1'], ['updates-12', '1.2'], ['updates-13', '1.3'], ['updates-14', '1.4'],
	['updates-14c', '1.4c'], ['updates-14d', '1.4d'], ['updates-15', '1.5'], ['updates-15b', '1.5b'], ['updates-15c', '1.5c'],
	['updates-16', '1.6'], ['announcements-halloween', 'Halloween'], ['updates-16b', '1.6'], ['updates-16c', '1.6'],
	['updates-17', '1.7'], ['updates-18', '1.8'], ['updates-19', '1.9'], ['updates-20', '2.0'], ['updates-21', '2.1'],
	['updates-22', '2.2.1'], ['updates-23', '2.2.2'], ['updates-24', '2.3'], ['updates-24-complete', '2.3'],
	['updates-25', '2.4'], ['updates-26', '2.4.1'], ['updates-27', '2.4.2'], ['updates-28', '2.5'], ['updates-28b', '2.5b'],
	['updates-29', '2.6'], ['updates-29b', '2.6b'], ['updates-29c', '2.6c'], ['updates-29d', '2.6d'],
].map(([file, label]) => {
	const id = BigInt(JSON.parse(fs.readFileSync(path.join(GUIDES, `${file}.ids.json`), 'utf8'))[0]);
	return { label, at: Number((id >> 22n) + 1420070400000n) };
}).sort((a, b) => a.at - b.at);
const LATEST = PATCHES[PATCHES.length - 1].label;
const patchAt = ms => (PATCHES.find(p => p.at >= ms) || { label: LATEST }).label;

// The first commit that added `token` to the server's own data files.
const EXCLUDE = ['learnsets.js', 'cut-moves.json', 'rp-moves.json', 'rp-usage.json', 'random-sets.js', 'za-tiers.json']
	.map(f => `:(exclude)data/velvet/${f}`);
const firstSeen = new Map();
function tagFor(token, files = ['data/velvet']) {
	const key = token + '|' + files.join(',');
	if (firstSeen.has(key)) return firstSeen.get(key);
	let out = LATEST;
	try {
		const log = execFileSync('git', ['log', '--reverse', '--format=%aI', `-S${token}`, '--', ...files, ...EXCLUDE],
			{ cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n')[0];
		if (log) out = patchAt(Date.parse(log));
	} catch (e) { /* untracked: newest */ }
	firstSeen.set(key, out);
	return out;
}
const tag = label => `\`${label}\``;
const V_ = f => f.map(x => `data/velvet/${x}`);
// Where each kind of change is written, so a tag is the change's own patch and not the first
// time the name turned up anywhere (Dragon Pulse was handed out in 1.1, buffed in 2.6c).
const MOVE_FILES = V_(['unnerfs.js', 'classic-mechanics.js', 'creation-trio.js', 'moves.js', 'abyss-shrine.js', 'frostbite.js']);
const ABILITY_FILES = V_(['unnerfs.js', 'abilities.js', 'balance-patch-1.js']);
const ITEM_FILES = V_(['items.js', 'gems.js', 'new-items.js', 'za-megas.js', 'unnerfs.js']);
const STAT_FILES = V_(['unnerfs.js', 'za-megas.js', 'missingno.js']);
const GRANT_FILES = V_(['balance-patch-1.js', 'unnerfs.js', 'creation-trio.js', 'stall.js', 'buffs.js', 'missingno.js']);
const EVO_FILES = V_(['balance-patch-1.js']);
// The file that changes each vanilla move, from the lists those files export themselves.
const MOVE_SOURCE = {};
const velvet = f => require(path.join(DATA, 'velvet', f));
for (const [file, ids] of [
	['frostbite.js', Object.keys(velvet('frostbite.js').SURE_HIT || { willowisp: 1, thunderwave: 1 })],
	['unnerfs.js', velvet('unnerfs.js').CHANGED.moves],
	['classic-mechanics.js', velvet('classic-mechanics.js').CHANGED_MOVES],
	['creation-trio.js', velvet('creation-trio.js').CHANGED_MOVES],
]) for (const id of ids) MOVE_SOURCE[id] = `data/velvet/${file}`;

// ---- helpers ----------------------------------------------------------------
const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const statLine = s => STATS.map(k => s[k]).join('/');
const bst = s => STATS.reduce((n, k) => n + s[k], 0);
const moveName = id => (Dex.moves.get(id).exists ? Dex.moves.get(id).name : id);
const speciesName = id => Dex.species.get(id).name;
const learners = {};   // move id -> species ids that gained it
const speciesLines = [];

function describeMove(m) {
	const bits = [m.type, m.category];
	if (m.category !== 'Status') bits.push(m.basePower ? `${m.basePower} BP` : 'varies');
	bits.push(m.accuracy === true ? 'never misses' : `${m.accuracy}%`);
	if (m.priority) bits.push(`priority ${m.priority > 0 ? '+' : ''}${m.priority}`);
	return bits.join(' · ');
}
function shortOf(kind, id) {
	const row = Dex[kind].get(id);
	return (row.shortDesc || row.desc || '').replace(/\s+/g, ' ').trim();
}

// ---- Pokemon ------------------------------------------------------------------
const newSpecies = [];
const allSpecies = Object.keys(D.Pokedex).filter(id => !HIDDEN_SPECIES.includes(id));
for (const id of allSpecies) {
	const ours = D.Pokedex[id];
	const theirs = V.pokedex[id];
	if (!theirs) { newSpecies.push(id); continue; }
	const parts = [];
	const t = files => ' ' + tag(tagFor(id, files));
	if (JSON.stringify(ours.types) !== JSON.stringify(theirs.types)) parts.push(`type ${theirs.types.join('/')} → **${ours.types.join('/')}**${t(STAT_FILES)}`);
	if (theirs.baseStats && JSON.stringify(ours.baseStats) !== JSON.stringify(theirs.baseStats)) {
		const diff = bst(ours.baseStats) - bst(theirs.baseStats);
		parts.push(`stats ${statLine(theirs.baseStats)} → **${statLine(ours.baseStats)}**${diff ? ` (BST ${diff > 0 ? '+' : ''}${diff})` : ''}${t(STAT_FILES)}`);
	}
	const had = new Set(Object.values(theirs.abilities || {}));
	const gained = Object.values(ours.abilities || {}).filter(a => !had.has(a));
	// One of ours carries its own tag; a vanilla ability handed to it, the grant's.
	if (gained.length) parts.push('new ability: ' + gained.map(a => `**${a}** ${tag(Dex.abilities.get(a).num < 0 ? tagFor(Dex.abilities.get(a).id) : tagFor(id, GRANT_FILES))}`).join(', '));
	const lost = [...had].filter(a => a && !Object.values(ours.abilities || {}).includes(a));
	if (lost.length) parts.push(`no longer has ${lost.join(', ')}${t(GRANT_FILES)}`);
	if ((ours.evoLevel || null) !== (theirs.evoLevel || null) || (ours.evoItem || null) !== (theirs.evoItem || null)) {
		const how = s => [s.evoLevel ? `Lv ${s.evoLevel}` : '', s.evoItem || '', s.evoType && !s.evoLevel && !s.evoItem ? s.evoType : ''].filter(Boolean).join(' or ') || '—';
		parts.push(`evolves from ${ours.prevo} at **${how(ours)}** (was ${how(theirs)})${t(EVO_FILES)}`);
	}
	const vLearn = ((V.learnsets[id] || {}).learnset) || {};
	const oLearn = ((D.Learnsets[id] || {}).learnset) || {};
	const newMoves = Object.keys(oLearn).filter(m => !vLearn[m] && !HIDDEN_MOVES.includes(m));
	for (const m of newMoves) (learners[m] = learners[m] || []).push(id);
	if (newMoves.length) parts.push(`learns ${newMoves.map(moveName).sort().join(', ')}`);
	if (!parts.length) continue;
	speciesLines.push({ num: ours.num, name: speciesName(id), text: `• **${speciesName(id)}**: ${parts.join(' · ')}` });
}
speciesLines.sort((a, b) => a.num - b.num || a.name.localeCompare(b.name));

// ---- Moves ----------------------------------------------------------------------
const newMoveLines = [], changedMoveLines = [];
for (const [id, m] of Object.entries(D.Moves)) {
	if (HIDDEN_MOVES.includes(id) || m.isZ || m.isMax) continue;
	const v = V.moves[id];
	if (!v) {
		const who = (learners[id] || []).filter(s => !HIDDEN_SPECIES.includes(s));
		const list = who.length <= 12 ? who.map(speciesName).join(', ') : `${who.length} Pokémon (each listed under Pokémon)`;
		newMoveLines.push(`• **${m.name}** (${describeMove(Dex.moves.get(id))}): ${shortOf('moves', id)}${who.length ? ` Learned by: ${list}.` : ''} ${tag(tagFor(id))}`);
		continue;
	}
	const diffs = [];
	if (m.basePower !== v.basePower) diffs.push(`power ${v.basePower} → **${m.basePower}**`);
	if (m.accuracy !== v.accuracy) diffs.push(`accuracy ${v.accuracy === true ? '—' : v.accuracy + '%'} → **${m.accuracy === true ? 'never misses' : m.accuracy + '%'}**`);
	if (m.type !== v.type) diffs.push(`type ${v.type} → **${m.type}**`);
	if (m.category !== v.category) diffs.push(`category ${v.category} → **${m.category}**`);
	if (m.pp !== v.pp) diffs.push(`PP ${v.pp} → **${m.pp}**`);
	if (m.priority !== v.priority) diffs.push(`priority ${v.priority} → **${m.priority}**`);
	const chance = x => (x.secondary && x.secondary.chance) || null;
	if (chance(m) !== chance(v)) diffs.push(`effect chance ${chance(v) || 0}% → **${chance(m) || 0}%**`);
	if ((v.isNonstandard === 'Past') && !m.isNonstandard) diffs.push('**usable again** (cut from Scarlet/Violet)');
	// A move we rewrote carries its own description in the data; Showdown's live in a text file.
	const rewritten = m.shortDesc && !v.shortDesc;
	if (!diffs.length && !rewritten) continue;
	changedMoveLines.push(`• **${m.name}**: ${[...diffs, rewritten ? `now: ${m.shortDesc}` : ''].filter(Boolean).join(' · ')} ${tag(tagFor(id, MOVE_SOURCE[id] ? [MOVE_SOURCE[id]] : MOVE_FILES))}`);
}

// ---- Abilities --------------------------------------------------------------------
const abilityHolders = {};
for (const id of allSpecies) {
	for (const a of Object.values(D.Pokedex[id].abilities || {})) (abilityHolders[Dex.abilities.get(a).id] = abilityHolders[Dex.abilities.get(a).id] || []).push(id);
}
const newAbilityLines = [], changedAbilityLines = [];
for (const [id, a] of Object.entries(D.Abilities)) {
	if (HIDDEN_ABILITIES.includes(id)) continue;
	const v = V.abilities[id];
	if (!v) {
		const who = (abilityHolders[id] || []);
		const list = who.length <= 12 ? who.map(speciesName).join(', ') : `${who.length} Pokémon`;
		newAbilityLines.push(`• **${a.name}**: ${shortOf('abilities', id)}${who.length ? ` Who: ${list}.` : ''} ${tag(tagFor(id))}`);
		continue;
	}
	if (a.shortDesc && !v.shortDesc) changedAbilityLines.push(`• **${a.name}**: now: ${a.shortDesc} ${tag(tagFor(id, ABILITY_FILES))}`);
}

// ---- Items -----------------------------------------------------------------------
const newItemLines = [], changedItemLines = [];
const legalAgain = { Past: [], Future: [] };
for (const [id, i] of Object.entries(D.Items)) {
	const v = V.items[id];
	if (!v) {
		const users = i.itemUser ? ` For: ${[].concat(i.itemUser).join(', ')}.` : '';
		newItemLines.push(`• **${i.name}**: ${shortOf('items', id)}${users} ${tag(tagFor(id))}`);
		continue;
	}
	if (v.isNonstandard && !i.isNonstandard && legalAgain[v.isNonstandard]) { legalAgain[v.isNonstandard].push(i.name); continue; }
	if (i.shortDesc && !v.shortDesc) changedItemLines.push(`• **${i.name}**: now: ${i.shortDesc} ${tag(tagFor(id, ITEM_FILES))}`);
}
if (legalAgain.Past.length) changedItemLines.push(`• **Usable again** (cut from Scarlet/Violet): ${legalAgain.Past.sort().join(', ')} ${tag(tagFor('gems.js', ['data/velvet/index.js']))}`);
if (legalAgain.Future.length) changedItemLines.push(`• **Legends Z-A Mega Stones, usable here**: ${legalAgain.Future.sort().join(', ')} ${tag(tagFor('applyZaStones', ['data/velvet']))}`);

// ---- New Pokemon ----------------------------------------------------------------
const newSpeciesLines = newSpecies.map(id => {
	const s = Dex.species.get(id);
	const abil = Object.values(s.abilities).join(' / ');
	const how = id === 'nuzleafsold' ? ' A Nuzleaf holding a Broken Pact turns into it when it faints.'
		: s.requiredItem ? ` Mega Evolves from ${s.baseSpecies} with the ${s.requiredItem}.` : '';
	return `• **${s.name}**: ${s.types.join('/')} · ${statLine(s.baseStats)} (BST ${bst(s.baseStats)}) · ${abil}.${how} ${tag(tagFor(id))}`;
});

// ---- write ----------------------------------------------------------------------
const MAX = 1900;
function section(title, intro, lines) {
	const parts = [];
	let cur = `${title}\n${intro ? intro + '\n' : ''}`;
	for (const line of lines) {
		if (line.length > MAX - 40) throw new Error('line too long: ' + line.slice(0, 80));
		if ((cur + line + '\n').length > MAX) { parts.push(cur.trimEnd()); cur = `${title} (cont.)\n`; }
		cur += line + '\n';
	}
	parts.push(cur.trimEnd());
	return parts;
}
const out = [
	...section('## 🐾 New Pokémon & forms', null, newSpeciesLines),
	...section('## 🧬 Pokémon changes', '-# In Pokédex order. "learns" lists moves it gets here that the main games never gave it. Tags are the patch the change came in.', speciesLines.map(l => l.text)),
	...section('## ⚔️ New moves', null, newMoveLines),
	...section('## 🔧 Changed moves', null, changedMoveLines),
	...section('## ✨ New abilities', null, newAbilityLines),
	...section('## 🔧 Changed abilities', null, changedAbilityLines),
	...section('## 🎒 New items', null, newItemLines),
	...section('## 🔧 Changed items', null, changedItemLines),
];
const file = path.join(GUIDES, 'rp-buffs-data.md');
fs.writeFileSync(file, out.join('\n---\n') + '\n');
console.log(`${out.length} parts, ${speciesLines.length} Pokemon, ${newMoveLines.length} new moves, ${changedMoveLines.length} changed, ${newAbilityLines.length} new abilities, ${changedAbilityLines.length} changed, ${newItemLines.length} new items, ${changedItemLines.length} changed -> ${file}`);

/*
 * The same lines for the Showdown "RP Buffs" room (the owner, 10 Oct 2026: "a public room
 * with rfaqs on each and a general list"). Each entry becomes a room FAQ under its name's
 * id (`/rfaq wavecharge`), and the room intro lists them by category.
 * config/showdown-config.js (rpBuffsRoom) loads data/rp-buffs.json at startup.
 * The battle-mechanics lines come from rp-bot's hand-written section.
 */
const toID = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
const faqs = {};
const lists = [];
function addList(title, lines, listed = true) {
	const names = [];
	for (const line of lines) {
		const m = line.match(/^• \*\*([^*]+)\*\*/);
		if (!m) continue;
		let key = toID(m[1]);
		if (!key) continue;
		// A name used twice (a Pokemon and a move) keeps both: the second gets its section's word.
		if (faqs[key]) key += toID(title.split(' ').pop()).slice(0, 8);
		faqs[key] = line.replace(/^• /, '');
		names.push([m[1], key]);
	}
	lists.push({ title, names: listed ? names : [], count: names.length });
}
addList('New moves', newMoveLines);
// The room has room for it: a new move's FAQ names every Pokemon that learns it.
for (const [id, who] of Object.entries(learners)) {
	const m = Dex.moves.get(id);
	const key = toID(m.name);
	if (m.num < 0 && faqs[key] && who.length > 12) {
		faqs[key] = faqs[key].replace(/Learned by: \d+ Pokémon \(each listed under Pokémon\)\./, `Learned by (${who.length}): ${who.map(speciesName).sort().join(', ')}.`);
	}
}
addList('New abilities', newAbilityLines);
addList('New items', newItemLines);
addList('Changed moves', changedMoveLines);
addList('Changed abilities', changedAbilityLines);
addList('Changed items', changedItemLines);
const mechanics = fs.readFileSync(path.join(GUIDES, 'rp-buffs-mechanics.md'), 'utf8').replace(/\r\n/g, '\n').split('\n').filter(l => /^• \*\*/.test(l));
addList('Battle mechanics', mechanics);
addList('New Pokémon & forms', newSpeciesLines);
addList('Pokémon changes', speciesLines.map(l => l.text), false);
const json = path.join(ROOT, 'data', 'rp-buffs.json');
fs.writeFileSync(json, JSON.stringify({ built: new Date().toISOString().slice(0, 10), lists, faqs }));
console.log(`${Object.keys(faqs).length} room FAQs -> ${json}`);
