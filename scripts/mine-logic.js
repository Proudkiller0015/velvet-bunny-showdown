'use strict';
/**
 * Mine the *reasoning* of strong players out of the replay corpus.
 *
 *   node scripts/mine-logic.js                         # default singles pools
 *   node scripts/mine-logic.js --pools gen9ou,gen8ou   # chosen pools
 *   node scripts/mine-logic.js --sample 50             # first N replays per pool
 *
 * Writes data/logic-insights.json and prints a report.
 *
 * learn-playbook.js counts what players do per turn. This script looks for
 * specific decision moments (a double switch, a Scarf reveal, a sack, a Tera)
 * and asks: what could the player know at that moment, what did they do, and
 * did it work. It reuses the same parsing idea - walk the log turn by turn,
 * keep a small field model, and label every switch as a choice, a pivot, a
 * replacement, a forced exit or a drag - but keeps the whole game in memory
 * (one replay at a time) so outcomes in later turns can be looked up.
 *
 * Every definition is deliberately conservative. A log records results, not
 * intentions, so each pattern below is "the result looks like this decision",
 * measured against a baseline wherever one exists (e.g. "what share of the
 * bench would also have threatened that Pokemon").
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { Dex } = require('pokemon-showdown');

const ROOT = path.join(__dirname, '..');
const MINED = process.env.MINE_DIR || path.join(ROOT, '..', 'reference', 'replays');
const OUT = path.join(ROOT, 'data', 'logic-insights.json');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
	const at = args.indexOf('--' + name);
	return at >= 0 ? (args[at + 1] && !args[at + 1].startsWith('--') ? args[at + 1] : true) : fallback;
};
const DEFAULT_POOLS = ['gen9ou', 'playersgen9ou', 'gen8ou', 'playersgen8ou', 'gen9nationaldex', 'gen9ubers', 'gen9uu'];
const POOLS = typeof flag('pools', '') === 'string' && flag('pools', '') ? flag('pools', '').split(',') : DEFAULT_POOLS;
const SAMPLE = Number(flag('sample', 0)) || 0;

/* ------------------------------------------------------------------ dex helpers */

const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const DEX = { 8: Dex.forGen(8), 9: Dex.forGen(9) };
const cache = new Map();
const cached = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };
const speciesOf = (gen, name) => cached('s' + gen + name, () => DEX[gen].species.get(name));
const moveOf = (gen, id) => cached('m' + gen + id, () => DEX[gen].moves.get(id));

const PIVOTS = new Set(['uturn', 'voltswitch', 'flipturn', 'partingshot', 'teleport']);
const SELF_SWITCH = new Set([...PIVOTS, 'chillyreception', 'shedtail', 'batonpass']);
const SETUP = new Set(['swordsdance', 'dragondance', 'nastyplot', 'calmmind', 'quiverdance', 'shellsmash', 'bulkup',
	'bellydrum', 'coil', 'agility', 'rockpolish', 'victorydance', 'shiftgear', 'geomancy', 'tailglow', 'growth',
	'workup', 'noretreat', 'clangoroussoul', 'filletaway', 'curse', 'tidyup']);
const REMOVAL = new Set(['defog', 'rapidspin', 'courtchange', 'mortalspin', 'tidyup']);
const HAZARD_MOVES = new Set(['stealthrock', 'spikes', 'toxicspikes', 'stickyweb', 'ceaselessedge', 'stoneaxe']);
const PROTECTS = new Set(['protect', 'detect', 'kingsshield', 'spikyshield', 'banefulbunker', 'silktrap', 'burningbulwark', 'obstruct']);
const PHAZE = new Set(['whirlwind', 'roar', 'dragontail', 'circlethrow', 'haze', 'clearsmog', 'encore', 'yawn', 'perishsong']);
const RECOVERY = new Set(['recover', 'roost', 'slackoff', 'softboiled', 'moonlight', 'morningsun', 'synthesis', 'wish',
	'strengthsap', 'shoreup', 'milkdrink', 'rest', 'junglehealing', 'lunarblessing']);
// Moves whose type is not the one in the dex (or depends on things the log does not state).
const VARIABLE = new Set(['weatherball', 'judgment', 'multiattack', 'technoblast', 'revelationdance', 'ivycudgel',
	'ragingbull', 'aurawheel', 'naturalgift', 'terastarstorm', 'hiddenpower', 'terablast']);
const ATE = new Set(['Pixilate', 'Aerilate', 'Refrigerate', 'Galvanize', 'Liquid Voice', 'Normalize']);
const ABILITY_IMMUNE = { Levitate: 'Ground', 'Flash Fire': 'Fire', 'Water Absorb': 'Water', 'Storm Drain': 'Water',
	'Dry Skin': 'Water', 'Volt Absorb': 'Electric', 'Lightning Rod': 'Electric', 'Motor Drive': 'Electric',
	'Sap Sipper': 'Grass', 'Earth Eater': 'Ground', 'Well-Baked Body': 'Fire' };

function possibleAbilities(gen, mon) {
	if (mon.ability) return [mon.ability];
	return Object.values(speciesOf(gen, mon.species).abilities || {});
}
const mayHave = (gen, mon, ability) => possibleAbilities(gen, mon).includes(ability);
function certainAbility(gen, mon) {
	const all = [...new Set(possibleAbilities(gen, mon))];
	return all.length === 1 ? all[0] : null;
}

const maxSpe = (gen, mon) => Math.floor((2 * (speciesOf(gen, mon.species).baseStats || {}).spe + 99) * 1.1);
const neutralSpe = (gen, mon) => 2 * (speciesOf(gen, mon.species).baseStats || {}).spe + 36;
/** 252 EVs, neutral nature: what a fast mon that "runs speed" without a + nature has. */
const investedSpe = (gen, mon) => 2 * (speciesOf(gen, mon.species).baseStats || {}).spe + 99 + 5;
const stageMult = s => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));
const baseStats = (gen, mon) => speciesOf(gen, mon.species).baseStats || {};

/** Defensive types at turn t (inclusive=true: a Tera used this turn counts). */
function typesOf(g, mon, t, inclusive) {
	if (mon.tera && mon.tera !== 'Stellar' && mon.teraTurn !== null &&
		(inclusive ? mon.teraTurn <= t : mon.teraTurn < t)) return [mon.tera];
	return speciesOf(g.gen, mon.species).types || [];
}
const origTypes = (g, mon) => speciesOf(g.gen, mon.species).types || [];

function multOn(g, type, defTypes, def, moveId) {
	const dex = DEX[g.gen];
	if (!type || !defTypes.length) return 1;
	const certain = def ? certainAbility(g.gen, def) : null;
	if (certain && ABILITY_IMMUNE[certain] === type) return 0;
	if (!dex.getImmunity(type, defTypes)) {
		if (moveId === 'thousandarrows') return 1;
		return 0;
	}
	let e = dex.getEffectiveness(type, defTypes);
	if (moveId === 'freezedry' && defTypes.includes('Water')) e += 2;
	if (moveId === 'flyingpress') e += dex.getEffectiveness('Flying', defTypes);
	return Math.pow(2, e);
}

/** Type of a damaging move as used by this mon, or null when it cannot be pinned down. */
function moveType(g, mon, id, t) {
	const m = moveOf(g.gen, id);
	if (!m.exists || m.category === 'Status' || !(m.basePower > 0)) return null;
	if (id === 'terablast') return mon.tera && mon.teraTurn !== null && mon.teraTurn <= t && mon.tera !== 'Stellar' ? mon.tera : null;
	if (VARIABLE.has(id)) return null;
	if (m.type === 'Normal' && possibleAbilities(g.gen, mon).some(a => ATE.has(a))) return null;
	if (possibleAbilities(g.gen, mon).includes('Liquid Voice') && m.flags && m.flags.sound) return null;
	return m.type;
}

/** Attacking types a mon is known to have: STAB plus revealed damaging moves before `knownBefore`. */
function attackTypes(g, mon, knownBefore) {
	const out = [];
	for (const type of origTypes(g, mon)) out.push({ type, id: null });
	if (mon.tera && mon.tera !== 'Stellar' && mon.teraTurn !== null && mon.teraTurn < knownBefore) out.push({ type: mon.tera, id: null });
	for (const [id, turn] of Object.entries(mon.moves)) {
		if (turn >= knownBefore) continue;
		const type = moveType(g, mon, id, knownBefore);
		if (type) out.push({ type, id });
	}
	return out;
}
function bestMult(g, att, def, knownBefore, t, inclusive) {
	const defTypes = typesOf(g, def, t, inclusive);
	let best = -1;
	for (const a of attackTypes(g, att, knownBefore)) best = Math.max(best, multOn(g, a.type, defTypes, def, a.id));
	return best;
}
/** att has a super-effective STAB or revealed move on def. */
const threatens = (g, att, def, knownBefore, t) => bestMult(g, att, def, knownBefore, t, false) >= 2;
/** def resists or is immune to every attacking type att is known to have. */
const walls = (g, def, att, knownBefore, t) => { const b = bestMult(g, att, def, knownBefore, t, false); return b >= 0 && b <= 0.5; };

const hasMove = (mon, pred, knownBefore = Infinity) => Object.entries(mon.moves).some(([id, turn]) => turn < knownBefore && pred(id));
function priorityAttack(g, mon, knownBefore) {
	return Object.entries(mon.moves).some(([id, turn]) => {
		if (turn >= knownBefore) return false;
		const m = moveOf(g.gen, id);
		return m.exists && m.priority > 0 && m.category !== 'Status' && m.basePower > 0;
	});
}

/* ---------------------------------------------------------------- parsing */

function slot(text) {
	const m = /^(p[12])[a-d]?: (.*)$/.exec(String(text || ''));
	return m ? { side: m[1], nick: m[2] } : null;
}
function parseHP(text) {
	const first = String(text || '').split(' ')[0];
	if (first === '0') return 0;
	const [a, b] = first.split('/');
	const cur = parseFloat(a), max = parseFloat(b);
	return max ? cur / max : null;
}
const other = side => (side === 'p1' ? 'p2' : 'p1');
const fromOf = parts => { for (const p of parts) { const m = /^\[from\]\s*(?:move: )?(.*)$/.exec(p); if (m) return m[1]; } return null; };
const ofOf = parts => { for (const p of parts) { const m = /^\[of\] (.*)$/.exec(p); if (m) return slot(m[1]); } return null; };
const sameSpecies = (gen, rosterName, switchName) => {
	if (rosterName === switchName) return true;
	if (rosterName.endsWith('-*')) return switchName.startsWith(rosterName.slice(0, -2));
	return toID(speciesOf(gen, rosterName).baseSpecies) === toID(speciesOf(gen, switchName).baseSpecies);
};

function parseGame(text, file, pool) {
	const g = { file, pool, gen: 9, singles: true, players: { p1: {}, p2: {} }, winner: null, teamsize: { p1: 6, p2: 6 },
		mons: { p1: [], p2: [] }, turns: [] };
	const st = { p1: { active: null, hz: hz0(), tailwind: false }, p2: { active: null, hz: hz0(), tailwind: false } };
	const field = { trickRoom: false, weather: 'none', terrain: 'none' };
	let cur = newTurn(0, null);
	g.turns[0] = cur;
	function hz0() { return { sr: 0, spk: 0, tsp: 0, web: 0, steel: 0 }; }
	function newTurn(n, start) {
		return { n, start, events: [], upkeep: false, moved: { p1: false, p2: false }, fainted: { p1: false, p2: false },
			forced: { p1: false, p2: false }, quick: { p1: false, p2: false }, lastMoveBy: { p1: null, p2: null } };
	}
	function newMon(side, species) {
		const mon = { side, nick: null, species, level: 100, hp: 1, status: '', fainted: false, faintTurn: null, moves: {},
			ability: null, tera: null, teraTurn: null, kos: [], entries: [], boosts: {}, vol: {},
			lastActionMove: null, lastActionTurn: -9, itemChangedTurn: null, origItem: null, lockBrokenTurn: null,
			scarfTurn: null, lastDirect: null, idx: g.mons[side].length };
		g.mons[side].push(mon);
		return mon;
	}
	function getMon(side, nick, species) {
		let mon = g.mons[side].find(m => m.nick === nick);
		if (mon) return mon;
		if (species) {
			mon = g.mons[side].find(m => !m.nick && sameSpecies(g.gen, m.species, species));
			if (mon) { mon.nick = nick; mon.species = species; return mon; }
			mon = newMon(side, species);
			mon.nick = nick;
			return mon;
		}
		return null;
	}
	const monAt = text => { const s = slot(text); return s ? getMon(s.side, s.nick, null) : null; };
	function revealItem(mon, item, how) {
		if (!mon) return;
		if (how !== 'gained' && mon.itemChangedTurn === null && !mon.origItem) mon.origItem = item;
		if (how === 'lost' || how === 'gained') { if (mon.itemChangedTurn === null) mon.itemChangedTurn = cur.n; }
	}
	function holderFromTag(parts, lineMon) {
		for (const p of parts) {
			const m = /^\[from\] (item|ability): (.*)$/.exec(p);
			if (!m) continue;
			const of = ofOf(parts);
			const ofMon = of ? getMon(of.side, of.nick, null) : null;
			if (m[1] === 'item') revealItem(m[2] === 'Rocky Helmet' && ofMon ? ofMon : lineMon, m[2], 'seen');
			else { const holder = ofMon || lineMon; if (holder) holder.ability = m[2]; }
		}
	}
	function snapshot() {
		const out = { field: { ...field } };
		for (const side of ['p1', 'p2']) {
			const a = st[side].active;
			out[side] = { active: a, hp: a ? a.hp : null, status: a ? a.status : '', boosts: a ? { ...a.boosts } : {},
				speFlag: a ? !!a.vol.speFlag : false, dynamax: a ? !!a.vol.dynamax : false, hz: { ...st[side].hz }, tailwind: st[side].tailwind,
				alive: g.teamsize[side] - g.mons[side].filter(m => m.fainted).length,
				bench: g.mons[side].filter(m => !m.fainted && m !== a),
				hpOf: new Map(g.mons[side].map(m => [m, m.hp])) };
		}
		return out;
	}

	for (const raw of text.split('\n')) {
		if (raw.charCodeAt(0) !== 124) continue;
		const parts = raw.slice(1).split('|');
		const kind = parts[0];
		switch (kind) {
		case 'gametype': if (parts[1] !== 'singles') g.singles = false; break;
		case 'gen': g.gen = Number(parts[1]) >= 9 ? 9 : 8; break;
		case 'player': if (parts[1] && parts[2]) g.players[parts[1]] = { name: parts[2], rating: Number(parts[4]) || null }; break;
		case 'teamsize': g.teamsize[parts[1]] = Number(parts[2]) || 6; break;
		case 'poke': if (g.mons[parts[1]]) newMon(parts[1], String(parts[2]).split(',')[0]); break;
		case 'win': g.winner = ['p1', 'p2'].find(s => g.players[s].name === parts[1]) || null; break;
		case 'upkeep': cur.upkeep = true; break;
		case 'turn': {
			const n = Number(parts[1]) || cur.n + 1;
			cur = newTurn(n, snapshot());
			g.turns[n] = cur;
			break;
		}
		case 'switch': case 'drag': {
			const s = slot(parts[1]);
			if (!s) break;
			const details = String(parts[2] || '');
			const species = details.split(',')[0];
			const mon = getMon(s.side, s.nick, species);
			const lv = /, L(\d+)/.exec(details);
			mon.level = lv ? Number(lv[1]) : 100;
			const prev = st[s.side].active;
			if (prev && prev !== mon) { prev.boosts = {}; prev.vol = {}; }
			mon.boosts = {}; mon.vol = {};
			const hp = parseHP(parts[3]);
			if (hp !== null) mon.hp = hp;
			const stat = /\b(brn|par|slp|frz|psn|tox)\b/.exec(String(parts[3] || ''));
			mon.status = stat ? stat[1] : '';
			let phase, via = null;
			const from = fromOf(parts.slice(4));
			if (kind === 'drag') phase = 'drag';
			else if (cur.n === 0) phase = 'lead';
			else if (from && SELF_SWITCH.has(toID(from))) { phase = 'pivot'; via = toID(from); }
			else if (cur.upkeep || cur.fainted[s.side]) phase = 'replace';
			else if (cur.forced[s.side] || cur.moved[s.side] || from) phase = 'forced';
			else phase = 'action';
			st[s.side].active = mon;
			mon.entries.push({ turn: cur.n, phase });
			cur.events.push({ k: 'switch', side: s.side, mon, prev, phase, via });
			break;
		}
		case 'detailschange': case '-formechange': {
			const mon = monAt(parts[1]);
			// A fainted mega reverts silently; keep the form it battled in.
			if (mon && parts[2] && !mon.fainted) mon.species = String(parts[2]).split(',')[0];
			break;
		}
		case 'move': {
			const s = slot(parts[1]);
			if (!s) break;
			const mon = getMon(s.side, s.nick, null);
			if (!mon) break;
			const rest = parts.slice(3);
			const from = fromOf(rest);
			const id = toID(parts[2]);
			const isAction = (!from || /lockedmove/i.test(from)) && !cur.moved[s.side];
			const target = monAt(parts[3]);
			const ev = { k: 'move', side: s.side, mon, id, move: moveOf(g.gen, id), target, action: isAction, from,
				miss: rest.includes('[miss]'), hzOwn: { ...st[s.side].hz }, hzFoe: { ...st[other(s.side)].hz },
				foe: st[other(s.side)].active, idx: cur.events.length };
			if (!from || /lockedmove|Sleep Talk/i.test(from)) { if (!(id in mon.moves)) mon.moves[id] = cur.n; }
			if (isAction && !/lockedmove/i.test(from || '')) {
				const lastEntry = mon.entries.length ? mon.entries[mon.entries.length - 1].turn : -1;
				if (mon.lastActionTurn === cur.n - 1 && lastEntry < mon.lastActionTurn && mon.lastActionMove !== id &&
					mon.itemChangedTurn === null && !mon.vol.dynamax && !ev.move.isMax && !ev.move.isZ &&
					mon.lockBrokenTurn === null && id !== 'struggle' && mon.lastActionMove !== 'struggle') mon.lockBrokenTurn = cur.n;
				mon.lastActionMove = id; mon.lastActionTurn = cur.n;
			}
			if (isAction) cur.moved[s.side] = true;
			cur.lastMoveBy[s.side] = ev;
			cur.events.push(ev);
			break;
		}
		case 'cant': {
			const s = slot(parts[1]);
			if (s) { cur.moved[s.side] = true; cur.events.push({ k: 'cant', side: s.side, reason: parts[2] }); }
			break;
		}
		case '-damage': case '-heal': case '-sethp': {
			const mon = monAt(parts[1]);
			if (!mon) break;
			const hp = parseHP(parts[2]);
			if (hp !== null) mon.hp = hp;
			const stat = /\b(brn|par|slp|frz|psn|tox)\b/.exec(String(parts[2] || ''));
			if (stat) mon.status = stat[1];
			const from = fromOf(parts.slice(3));
			holderFromTag(parts.slice(3), mon);
			if (kind === '-damage') {
				const by = !from ? cur.lastMoveBy[other(mon.side)] : null;
				mon.lastDirect = by ? { mon: by.mon, turn: cur.n, id: by.id } : null;
				cur.events.push({ k: 'damage', side: mon.side, mon, hp: mon.hp, from, by: by ? by.mon : null });
			}
			break;
		}
		case 'faint': {
			const mon = monAt(parts[1]);
			if (!mon) break;
			mon.fainted = true; mon.hp = 0; mon.faintTurn = cur.n;
			const by = mon.lastDirect && mon.lastDirect.turn === cur.n && mon.lastDirect.mon.side !== mon.side ? mon.lastDirect.mon : null;
			if (by) by.kos.push(cur.n);
			cur.fainted[mon.side] = true;
			cur.events.push({ k: 'faint', side: mon.side, mon, by, byMove: by ? mon.lastDirect.id : null });
			break;
		}
		case '-status': { const mon = monAt(parts[1]); if (mon) mon.status = parts[2]; holderFromTag(parts.slice(3), mon); break; }
		case '-curestatus': { const mon = monAt(parts[1]); if (mon) mon.status = ''; break; }
		case '-boost': case '-unboost': {
			const mon = monAt(parts[1]);
			if (!mon) break;
			const n = (Number(parts[3]) || 0) * (kind === '-boost' ? 1 : -1);
			mon.boosts[parts[2]] = Math.max(-6, Math.min(6, (mon.boosts[parts[2]] || 0) + n));
			holderFromTag(parts.slice(4), mon);
			cur.events.push({ k: 'boost', side: mon.side, mon, stat: parts[2], n });
			break;
		}
		case '-setboost': { const mon = monAt(parts[1]); if (mon) mon.boosts[parts[2]] = Number(parts[3]) || 0; break; }
		case '-clearboost': { const mon = monAt(parts[1]); if (mon) mon.boosts = {}; break; }
		case '-clearallboost': for (const side of ['p1', 'p2']) if (st[side].active) st[side].active.boosts = {}; break;
		case '-clearnegativeboost': {
			const mon = monAt(parts[1]);
			if (mon) for (const k of Object.keys(mon.boosts)) if (mon.boosts[k] < 0) mon.boosts[k] = 0;
			break;
		}
		case '-terastallize': {
			const mon = monAt(parts[1]);
			if (!mon) break;
			mon.tera = parts[2]; mon.teraTurn = cur.n;
			cur.events.push({ k: 'tera', side: mon.side, mon, type: parts[2], idx: cur.events.length });
			break;
		}
		case '-start': {
			const mon = monAt(parts[1]);
			if (!mon) break;
			const what = String(parts[2] || '');
			if (/^(quarkdrive|protosynthesis)spe$/.test(what)) mon.vol.speFlag = true;
			if (what === 'Dynamax') mon.vol.dynamax = true;
			if (what === 'typechange') mon.vol.typechange = parts[3];
			holderFromTag(parts.slice(3), mon);
			break;
		}
		case '-end': {
			const mon = monAt(parts[1]);
			if (!mon) break;
			if (/Quark Drive|Protosynthesis/.test(parts[2])) mon.vol.speFlag = false;
			if (parts[2] === 'Dynamax') mon.vol.dynamax = false;
			break;
		}
		case '-activate': {
			const mon = monAt(parts[1]);
			if (mon && /item: Quick Claw|ability: Quick Draw/.test(parts[2])) cur.quick[mon.side] = true;
			if (mon && /ability: Emergency Exit|item: Eject/.test(parts[2])) cur.forced[mon.side] = true;
			if (mon) holderFromTag(parts.slice(3), mon);
			break;
		}
		case '-item': {
			const mon = monAt(parts[1]);
			if (!mon) break;
			const from = fromOf(parts.slice(3)) || '';
			if (/Trick|Switcheroo/.test(from)) {
				// The item arriving here is the one the other active started with.
				const giver = st[other(mon.side)].active;
				if (giver) revealItem(giver, parts[2], 'lost');
				revealItem(mon, parts[2], 'gained');
			} else if (/Magician|Pickpocket|Thief|Covet|Bestow/.test(from)) revealItem(mon, parts[2], 'gained');
			else revealItem(mon, parts[2], 'seen');
			break;
		}
		case '-enditem': {
			const mon = monAt(parts[1]);
			if (!mon) break;
			if (/Custap/.test(parts[2])) cur.quick[mon.side] = true;
			if (/Eject Button|Eject Pack/.test(parts[2])) cur.forced[mon.side] = true;
			revealItem(mon, parts[2], 'lost');
			if (mayHave(g.gen, mon, 'Unburden')) mon.vol.unburden = true;
			break;
		}
		case '-ability': {
			const mon = monAt(parts[1]);
			if (mon && !/\[from\]/.test(parts[3] || '')) mon.ability = parts[2];
			break;
		}
		case '-sidestart': case '-sideend': {
			const side = String(parts[1]).slice(0, 2);
			if (!st[side]) break;
			const cond = String(parts[2] || '').replace(/^move: /, '');
			const h = st[side].hz;
			const key = { 'Stealth Rock': 'sr', Spikes: 'spk', 'Toxic Spikes': 'tsp', 'Sticky Web': 'web', 'G-Max Steelsurge': 'steel' }[cond];
			if (kind === '-sidestart') {
				if (key) {
					h[key] = key === 'spk' ? Math.min(3, h[key] + 1) : key === 'tsp' ? Math.min(2, h[key] + 1) : 1;
					const setter = cur.lastMoveBy[other(side)];
					cur.events.push({ k: 'hazard', side, key, setter: setter ? setter.mon : null, via: setter ? setter.id : null });
				}
				if (cond === 'Tailwind') st[side].tailwind = true;
			} else {
				if (key) {
					h[key] = 0;
					cur.events.push({ k: 'hazardEnd', side, key, from: toID(fromOf(parts.slice(3)) || '') });
				}
				if (cond === 'Tailwind') st[side].tailwind = false;
			}
			break;
		}
		case '-swapsideconditions': {
			const a = st.p1, b = st.p2;
			[a.hz, b.hz] = [b.hz, a.hz];
			[a.tailwind, b.tailwind] = [b.tailwind, a.tailwind];
			cur.events.push({ k: 'courtchange' });
			break;
		}
		case '-fieldstart': case '-fieldend': {
			const what = String(parts[1] || '').replace(/^move: /, '');
			if (what === 'Trick Room') field.trickRoom = kind === '-fieldstart';
			else if (/Terrain/.test(what)) field.terrain = kind === '-fieldstart' ? what : 'none';
			break;
		}
		case '-weather': field.weather = parts[1] || 'none'; break;
		case '-transform': { const mon = monAt(parts[1]); if (mon) { mon.vol.transformed = true; mon.everTransformed = true; } break; }
		case 'replace': { const s = slot(parts[1]); if (s) g.illusion = true; break; }
		default: break;
		}
	}
	g.lastTurn = cur.n;
	return g;
}

/* ------------------------------------------------------------ aggregation */

function band(g, side) {
	const r = g.players[side] && g.players[side].rating;
	if (!r) return 'unrated';
	if (r < 1700) return '<1700';
	if (r < 1850) return '1700-1849';
	if (r < 2000) return '1850-1999';
	return '2000+';
}
const BANDS = ['<1700', '1700-1849', '1850-1999', '2000+', 'unrated'];

const STATS = {};
const EXAMPLES = {};
function add(pattern, metric, g, side, n = 1) {
	const p = STATS[pattern] = STATS[pattern] || {};
	for (const key of ['all', 'pool:' + g.pool, 'band:' + band(g, side)]) {
		const row = p[key] = p[key] || {};
		row[metric] = (row[metric] || 0) + n;
	}
}
function example(pattern, g, turn, textLine) {
	const list = EXAMPLES[pattern] = EXAMPLES[pattern] || [];
	if (list.length >= 5 || list.some(e => e.replay === g.file)) return;
	list.push({ replay: `${g.pool}/${g.file}`, turn, what: textLine });
}
const nameOf = mon => (mon ? mon.species : '?');

/* -------------------------------------------------------------- utilities */

function actionOf(T, side) {
	if (!T) return { type: 'none' };
	for (const ev of T.events) {
		if (ev.side !== side) continue;
		if (ev.k === 'switch' && ev.phase === 'action') return { type: 'switch', ev };
		if (ev.k === 'move' && ev.action) return { type: SELF_SWITCH.has(ev.id) ? 'pivot' : 'move', ev };
		if (ev.k === 'cant') return { type: 'cant' };
	}
	return { type: 'none' };
}
const faintedIn = (g, mon, from, to) => mon.fainted && mon.faintTurn >= from && mon.faintTurn <= to;
const koIn = (mon, from, to) => mon.kos.some(t => t >= from && t <= to);
const koOfIn = (g, killer, victim, from, to) => {
	for (let t = from; t <= to; t++) {
		const T = g.turns[t];
		if (!T) continue;
		if (T.events.some(e => e.k === 'faint' && e.mon === victim && e.by === killer)) return true;
	}
	return false;
};
/** Did `mon` leave the field (switch/pivot/drag, not faint) in turns [from, to]? */
function leftIn(g, mon, from, to) {
	for (let t = from; t <= to; t++) {
		const T = g.turns[t];
		if (!T) continue;
		if (T.events.some(e => e.k === 'switch' && e.prev === mon && e.phase !== 'replace')) return true;
	}
	return false;
}
const benchShare = (list, pred) => (list.length ? list.filter(pred).length / list.length : 0);
const hzKey = h => [h.sr ? 'SR' : '', h.spk ? `Spikes${h.spk}` : '', h.tsp ? `TSpikes${h.tsp}` : '', h.web ? 'Web' : '', h.steel ? 'Steelsurge' : '']
	.filter(Boolean).join('+') || 'none';
const hzAny = h => h.sr + h.spk + h.tsp + h.web + h.steel > 0;
const roundish = x => Math.round(x * 1000) / 1000;
const turnBucket = t => (t <= 3 ? '1-3' : t <= 8 ? '4-8' : t <= 15 ? '9-15' : t <= 25 ? '16-25' : '26+');

/* ----------------------------------------------------------------- detectors */

/** 1. Double switch into a threat of the incoming counter (and the next-turn version). */
function detectDoubleSwitch(g) {
	for (let t = 1; t <= g.lastTurn; t++) {
		const T = g.turns[t];
		if (!T || !T.start) continue;
		for (const A of ['p1', 'p2']) {
			const B = other(A);
			const aAct = actionOf(T, A);
			if (aAct.type !== 'switch') continue;
			const X = aAct.ev.mon, B0 = T.start[B].active;
			if (!B0 || !X || X === B0) continue;
			// X is a plausible counter to B0, as A could judge it.
			const counter = walls(g, X, B0, t, t) || (threatens(g, X, B0, Infinity, t) && !threatens(g, B0, X, t, t));
			if (!counter) continue;
			add('doubleSwitch', 'opportunities', g, B);
			const bAct = actionOf(T, B);
			const b0Threatened = threatens(g, T.start[A].active || X, B0, t, t);
			const bench = T.start[B].bench;
			if (bAct.type === 'switch') {
				const Y = bAct.ev.mon;
				add('doubleSwitch', 'sameTurnDouble', g, B);
				add('doubleSwitch', 'benchThreatShareSum', g, B, benchShare(bench, m => threatens(g, m, X, Infinity, t)));
				if (threatens(g, Y, X, Infinity, t)) {
					add('doubleSwitch', 'sameTurnDoubleToThreat', g, B);
					if (!b0Threatened) add('doubleSwitch', 'toThreatWhileB0Safe', g, B);
					payoff('same', Y, X, t);
					example('doubleSwitch', g, t, `${g.players[A].name} switched ${nameOf(aAct.ev.prev)}->${nameOf(X)} (counters ${nameOf(B0)}); ${g.players[B].name} simultaneously went ${nameOf(B0)}->${nameOf(Y)}, which hits ${nameOf(X)} super-effectively`);
				}
				else payoff('sameNoThreat', Y, X, t);
				if (!b0Threatened) add('doubleSwitch', 'doubleWhileB0Safe', g, B);
			} else if (bAct.type === 'move' || bAct.type === 'pivot') {
				add('doubleSwitch', 'stayed', g, B);
				const N = g.turns[t + 1];
				if (!N || !N.start || N.start[A].active !== X || N.start[B].active !== B0) continue;
				add('doubleSwitch', 'nextTurnOpps', g, B);
				const next = actionOf(N, B);
				if (next.type === 'switch') {
					add('doubleSwitch', 'nextTurnSwitch', g, B);
					add('doubleSwitch', 'nextBenchThreatShareSum', g, B, benchShare(N.start[B].bench, m => threatens(g, m, X, Infinity, t + 1)));
					if (threatens(g, next.ev.mon, X, Infinity, t + 1)) {
						add('doubleSwitch', 'nextTurnSwitchToThreat', g, B);
						payoff('next', next.ev.mon, X, t + 1);
					}
				}
			}
			function payoff(kind, Y, Xmon, at) {
				add('doubleSwitch', `${kind}.payoffCases`, g, B);
				if (koOfIn(g, Y, Xmon, at + 1, at + 2)) add('doubleSwitch', `${kind}.YKOsX`, g, B);
				else if (leftIn(g, Xmon, at + 1, at + 2)) add('doubleSwitch', `${kind}.XForcedOut`, g, B);
				if (faintedIn(g, Y, at + 1, at + 2)) add('doubleSwitch', `${kind}.YFainted`, g, B);
				if (g.winner) add('doubleSwitch', `${kind}.won`, g, B, g.winner === B ? 1 : 0);
			}
		}
	}
}

/** 2. Speed inference -> likely Choice Scarf; validation; opponent behaviour before/after. */
const SCARF_SPECIES = {};
function detectScarf(g) {
	const weatherAbility = { RainDance: 'Swift Swim', PrimordialSea: 'Swift Swim', SunnyDay: 'Chlorophyll', DesolateLand: 'Chlorophyll',
		Sandstorm: 'Sand Rush', Snow: 'Slush Rush', Snowscape: 'Slush Rush', Hail: 'Slush Rush' };
	const flagged = new Map(); // mon -> reveal turn
	for (let t = 1; t <= g.lastTurn; t++) {
		const T = g.turns[t];
		if (!T || !T.start) continue;
		const moves = ['p1', 'p2'].map(s => actionOf(T, s)).map(a => (a.type === 'move' || a.type === 'pivot' ? a.ev : null));
		if (!moves[0] || !moves[1]) continue;
		if (moves[0].mon !== T.start.p1.active || moves[1].mon !== T.start.p2.active) continue;
		const [first, second] = moves[0].idx < moves[1].idx ? moves : [moves[1], moves[0]];
		const F = first.mon, S = second.mon;
		const sf = T.start[F.side], ss = T.start[S.side], field = T.start.field;
		if (field.trickRoom || sf.tailwind || ss.tailwind) continue;
		if (F.level !== S.level) continue;
		if (F.everTransformed || S.everTransformed || /^Ditto|^Mew$/.test(F.species) || /^Ditto|^Mew$/.test(S.species)) continue;
		if (g.illusion || mayHave(g.gen, F, 'Illusion') || mayHave(g.gen, S, 'Illusion')) continue;
		if (!first.move.exists || !second.move.exists || first.move.priority !== 0 || second.move.priority !== 0) continue;
		if (first.move.category === 'Status' && mayHave(g.gen, F, 'Prankster')) continue;
		if (first.move.type === 'Flying' && mayHave(g.gen, F, 'Gale Wings')) continue;
		if (first.move.flags && first.move.flags.heal && mayHave(g.gen, F, 'Triage')) continue;
		if (first.id === 'grassyglide' && /Grassy/.test(field.terrain)) continue;
		if ((sf.boosts.spe || 0) !== 0 || (ss.boosts.spe || 0) !== 0) continue;
		if (T.events.some(e => e.k === 'boost' && e.stat === 'spe' && T.events.indexOf(e) < first.idx)) continue;
		if (ss.status === 'par' || sf.speFlag || T.quick[F.side]) continue;
		if (mayHave(g.gen, F, 'Unburden') && (F.itemChangedTurn !== null)) continue;
		if (mayHave(g.gen, F, 'Quick Feet') && sf.status) continue;
		if (weatherAbility[field.weather] && mayHave(g.gen, F, weatherAbility[field.weather])) continue;
		if (/Electric/.test(field.terrain) && mayHave(g.gen, F, 'Surge Surfer')) continue;
		if (mayHave(g.gen, S, 'Slow Start') || mayHave(g.gen, S, 'Stall') ||
			(second.move.category === 'Status' && mayHave(g.gen, S, 'Mycelium Might'))) continue;
		if (hasMove(S, id => id === 'trickroom' || id === 'gyroball')) continue;
		if (sf.dynamax || ss.dynamax) { /* dynamax does not change speed */ }
		const fMax = maxSpe(g.gen, F), sMin = neutralSpe(g.gen, S), sInv = investedSpe(g.gen, S);
		// strict: beats even an uninvested foe; likely: beats a 252-EV neutral foe.
		const tier = fMax < sMin ? 'strict' : fMax < sInv ? 'likely' : null;
		if (!tier) continue;
		if (fMax * 1.5 < sMin) { add('scarf', 'unexplainedEvenWithScarf', g, F.side); continue; }
		if (flagged.has(F)) continue;
		const knownScarf = F.origItem === 'Choice Scarf' && F.itemChangedTurn === null;
		if (knownScarf) { add('scarf', 'outspeedAlreadyKnownScarf', g, F.side); continue; }
		flagged.set(F, { r: t, tier, text: `${nameOf(F)} (max ${fMax} Spe) moved before ${nameOf(S)} (uninvested ${sMin}) with no priority/boost/field explanation -> Scarf` });
		add('scarf', `${tier}.inferred`, g, F.side);
		if (tier === 'strict') SCARF_SPECIES[F.species] = (SCARF_SPECIES[F.species] || 0) + 1;
	}
	for (const [F, { r, tier, text }] of flagged) {
		const side = F.side, B = other(side);
		if (F.origItem === 'Choice Scarf') add('scarf', `${tier}.validatedByItem`, g, side);
		else if (F.origItem) add('scarf', `${tier}.contradictedByItem`, g, side);
		if (F.lockBrokenTurn !== null) add('scarf', `${tier}.contradictedByMoveLock`, g, side);
		const contradicted = (F.origItem && F.origItem !== 'Choice Scarf') || F.lockBrokenTurn !== null;
		if (contradicted) continue;
		add('scarf', `${tier}.notContradicted`, g, side);
		if (tier !== 'strict') continue;
		F.scarfTurn = r;
		example('scarf', g, r, text + (F.origItem === 'Choice Scarf' ? ' (item later revealed: Choice Scarf)' : ''));
		// What the opponent does when facing it, with a mon that "should" outspeed it.
		for (let t = 1; t <= g.lastTurn; t++) {
			if (t === r) continue;
			const T = g.turns[t];
			if (!T || !T.start || T.start[side].active !== F) continue;
			const M = T.start[B].active;
			if (!M || maxSpe(g.gen, M) <= maxSpe(g.gen, F)) continue;
			const phase = t < r ? 'pre' : 'post';
			const act = actionOf(T, B);
			add('scarf', `${phase}.turns`, g, B);
			if (act.type === 'switch') add('scarf', `${phase}.switchOut`, g, B);
			if (act.type === 'pivot') add('scarf', `${phase}.pivot`, g, B);
			if (act.type === 'move' && act.ev.move.priority > 0 && act.ev.move.category !== 'Status') add('scarf', `${phase}.priorityAttack`, g, B);
			if (T.events.some(e => e.k === 'faint' && e.mon === M && e.by === F)) add('scarf', `${phase}.KOdByScarfer`, g, B);
			if (T.start[B].hp !== null && T.start[B].hp <= 0.5) {
				add('scarf', `${phase}.lowHpTurns`, g, B);
				if (act.type === 'switch') add('scarf', `${phase}.lowHpSwitchOut`, g, B);
			}
		}
	}
}

/** 3. Pivot moves: used into a switch, and what comes in. */
function detectPivot(g) {
	for (let t = 1; t <= g.lastTurn; t++) {
		const T = g.turns[t];
		if (!T || !T.start) continue;
		for (const A of ['p1', 'p2']) {
			const B = other(A);
			const act = actionOf(T, A);
			if (act.type !== 'move' && act.type !== 'pivot') continue;
			if (act.ev.mon !== T.start[A].active) continue;
			const bAct = actionOf(T, B);
			const isPivot = PIVOTS.has(act.ev.id);
			add('pivot', isPivot ? 'pivotUses' : 'otherMoveUses', g, A);
			if (bAct.type === 'switch') add('pivot', isPivot ? 'pivotIntoFoeSwitch' : 'otherMoveIntoFoeSwitch', g, A);
			if (!isPivot) continue;
			const out = T.events.find(e => e.k === 'switch' && e.side === A && e.phase === 'pivot' && T.events.indexOf(e) > act.ev.idx);
			if (!out) continue;
			const Y = out.mon, A0 = act.ev.mon;
			const bench = T.start[A].bench;
			if (bAct.type === 'switch') {
				const X = bAct.ev.mon;
				add('pivot', 'foeSwitchCases', g, A);
				add('pivot', 'benchThreatShareSum', g, A, benchShare(bench, m => threatens(g, m, X, Infinity, t)));
				if (threatens(g, Y, X, Infinity, t)) {
					add('pivot', 'broughtThreatToSwitchIn', g, A);
					example('pivot', g, t, `${nameOf(A0)} ${act.ev.move.name} as ${nameOf(bAct.ev.prev)} switched to ${nameOf(X)}; pivoted to ${nameOf(Y)}, super-effective on it`);
				}
				add('pivot', 'benchWallShareSum', g, A, benchShare(bench, m => walls(g, m, X, t + 1, t)));
				if (walls(g, Y, X, t + 1, t)) add('pivot', 'broughtResistToSwitchIn', g, A);
				if (walls(g, X, A0, t, t) || threatens(g, X, A0, t, t)) add('pivot', 'foeSwitchedToCounterOfPivoter', g, A);
			} else {
				const B0 = T.start[B].active;
				if (!B0 || (B0.faintTurn !== null && B0.faintTurn <= t)) continue;
				add('pivot', 'foeStayedCases', g, A);
				add('pivot', 'stayBenchThreatShareSum', g, A, benchShare(bench, m => threatens(g, m, B0, Infinity, t)));
				if (threatens(g, Y, B0, Infinity, t)) add('pivot', 'broughtThreatToStayer', g, A);
			}
		}
	}
}

/** Role tags for a mon from everything revealed in the game. */
function roles(g, mon) {
	const r = [];
	if (hasMove(mon, id => SETUP.has(id))) r.push('setup');
	if (hasMove(mon, id => REMOVAL.has(id))) r.push('remover');
	if (hasMove(mon, id => HAZARD_MOVES.has(id))) r.push('hazardSetter');
	if (hasMove(mon, id => PIVOTS.has(id))) r.push('pivot');
	if (hasMove(mon, id => RECOVERY.has(id))) r.push('recovery');
	if (priorityAttack(g, mon, Infinity)) r.push('priority');
	if (mon.origItem === 'Choice Scarf' || mon.scarfTurn !== null) r.push('scarf');
	return r;
}

/** 4. Low HP and outsped + threatened: stay (sack) or switch (save)? */
function detectSack(g) {
	for (let t = 1; t <= g.lastTurn; t++) {
		const T = g.turns[t];
		if (!T || !T.start || T.start.field.trickRoom) continue;
		for (const A of ['p1', 'p2']) {
			const B = other(A);
			const M = T.start[A].active, K = T.start[B].active;
			if (!M || !K || !(T.start[B].hp > 0)) continue;
			const hp = T.start[A].hp;
			if (hp === null || hp <= 0 || hp > 0.35) continue;
			if (T.start[A].bench.length === 0) continue;
			const kScarf = K.origItem === 'Choice Scarf' || (K.scarfTurn !== null && K.scarfTurn < t);
			const kSpe = maxSpe(g.gen, K) * (kScarf ? 1.5 : 1) * stageMult(T.start[B].boosts.spe || 0) * (T.start[B].status === 'par' ? 0.5 : 1);
			const mSpe = maxSpe(g.gen, M) * stageMult(T.start[A].boosts.spe || 0) * (T.start[A].status === 'par' ? 0.5 : 1);
			const outsped = kSpe > mSpe || priorityAttack(g, K, t);
			const threatened = bestMult(g, K, M, t, t, false) >= 1;
			if (!outsped || !threatened) continue;
			const act = actionOf(T, A);
			if (act.type === 'none' || act.type === 'cant') continue;
			const decision = act.type === 'switch' ? 'save' : act.type === 'pivot' ? 'pivot' : 'stay';
			add('sack', `decisions`, g, A);
			add('sack', `${decision}`, g, A);
			const priorKOs = M.kos.filter(x => x < t).length;
			const laterKOs = M.kos.filter(x => x > t).length;
			const died = faintedIn(g, M, t, t);
			const bucket = decision === 'stay' ? (died ? 'stayDied' : 'staySurvived') : decision;
			add('sack', `${bucket}.n`, g, A);
			add('sack', `${bucket}.laterKOs`, g, A, laterKOs);
			add('sack', `${bucket}.laterKOsAtLeast1`, g, A, laterKOs > 0 ? 1 : 0);
			add('sack', `${bucket}.priorKOs`, g, A, priorKOs);
			add('sack', `${bucket}.aliveAtEnd`, g, A, M.fainted ? 0 : 1);
			if (g.winner) add('sack', `${bucket}.won`, g, A, g.winner === A ? 1 : 0);
			const mRoles = roles(g, M);
			for (const role of mRoles) add('sack', `${bucket}.role.${role}`, g, A);
			const segs = [...mRoles.map(x => 'role:' + x), priorKOs > 0 ? 'hasKOd' : 'noKOsYet',
				T.start[A].alive <= 2 ? 'ownAlive<=2' : T.start[A].alive <= 4 ? 'ownAlive3-4' : 'ownAlive5-6',
				hp <= 0.15 ? 'hp<=15' : 'hp16-35'];
			for (const seg of segs) { add('sack', `seg.${seg}.n`, g, A); if (decision === 'save') add('sack', `seg.${seg}.save`, g, A); }
			if (decision === 'stay') {
				const ev = act.ev;
				add('sack', `stay.move.${ev.move.category === 'Status' ? (HAZARD_MOVES.has(ev.id) ? 'hazard' : 'status') : 'attack'}`, g, A);
				if (died) {
					// The free switch-in that the sack buys.
					const rep = T.events.find(e => e.k === 'switch' && e.side === A && e.phase === 'replace');
					if (rep) {
						add('sack', 'sackFreeSwitch.n', g, A);
						if (koIn(rep.mon, t + 1, t + 2)) add('sack', 'sackFreeSwitch.KOwithin2', g, A);
						const next = actionOf(g.turns[t + 1], A);
						if (next.type === 'move' && SETUP.has(next.ev.id)) add('sack', 'sackFreeSwitch.setupNext', g, A);
					}
				}
			}
			if (decision === 'save' && laterKOs >= 2) {
				example('sack', g, t, `${g.players[A].name} saved ${nameOf(M)} at ${Math.round(hp * 100)}% from faster ${nameOf(K)}; it later took ${laterKOs} KOs`);
			}
		}
	}
}

/** 5. Setup moves: context and success. */
function detectSetup(g) {
	for (let t = 1; t <= g.lastTurn; t++) {
		const T = g.turns[t];
		if (!T || !T.start) continue;
		for (const A of ['p1', 'p2']) {
			const B = other(A);
			const act = actionOf(T, A);
			if (act.type !== 'move' || !SETUP.has(act.ev.id)) continue;
			const S = act.ev.mon;
			if (S !== T.start[A].active) continue;
			if (act.ev.id === 'curse' && origTypes(g, S).includes('Ghost')) continue;
			const foe = act.ev.foe || T.start[B].active;
			if (!foe) continue;
			const ctx = [];
			const P = g.turns[t - 1];
			const entry = S.entries.filter(e => e.turn < t).pop();
			if (entry && entry.turn === t - 1 && entry.phase === 'replace') ctx.push('freeSwitchAfterFaint');
			if (entry && entry.turn === t - 1 && (entry.phase === 'action' || entry.phase === 'pivot')) ctx.push('cameInLastTurn');
			const bAct = actionOf(T, B);
			if (bAct.type === 'switch' || bAct.type === 'pivot') ctx.push('foeSwitchingThisTurn');
			if (P && P.start && P.start[A].active === S && actionOf(P, B).type === 'switch') ctx.push('forcedSwitchLastTurn');
			const known = Object.entries(foe.moves).filter(([, turn]) => turn < t);
			const prevFoe = P ? actionOf(P, B) : null;
			if ((known.length && known.every(([id]) => moveOf(g.gen, id).category === 'Status')) ||
				(prevFoe && prevFoe.type === 'move' && prevFoe.ev.mon === foe && prevFoe.ev.move.category === 'Status')) ctx.push('foePassive');
			const best = bestMult(g, foe, S, t, t, false);
			if (known.length >= 2 && best <= 0.5) ctx.push('foeKnownAttacksResisted');
			if (best >= 2) ctx.push('foeThreatensSE');
			if ((T.start[A].hp || 0) >= 0.7) ctx.push('hp>=70'); else ctx.push('hp<70');
			if (!ctx.some(c => ['freeSwitchAfterFaint', 'foeSwitchingThisTurn', 'forcedSwitchLastTurn', 'foePassive', 'foeKnownAttacksResisted'].includes(c))) ctx.push('noSafetyContext');
			const ko3 = koIn(S, t, t + 3);
			const survived = !faintedIn(g, S, t, t + 3);
			const wastedFaint = faintedIn(g, S, t, t + 1) && !koIn(S, t, t + 1);
			for (const c of ['all', ...ctx]) {
				add('setup', `${c}.n`, g, A);
				if (ko3) add('setup', `${c}.KOwithin3`, g, A);
				if (survived) add('setup', `${c}.survived3`, g, A);
				if (wastedFaint) add('setup', `${c}.faintedBeforeKO`, g, A);
				if (koIn(S, t, t + 6) && S.kos.filter(x => x >= t && x <= t + 6).length >= 2) add('setup', `${c}.twoKOsWithin6`, g, A);
			}
			if (ko3 && ctx.includes('freeSwitchAfterFaint')) example('setup', g, t, `${nameOf(S)} came in on a faint and used ${act.ev.move.name} vs ${nameOf(foe)}; KO within 3 turns`);
			else if (ko3 && ctx.includes('foeSwitchingThisTurn')) example('setup', g, t, `${nameOf(S)} used ${act.ev.move.name} as the foe switched to ${nameOf(foe)}; KO within 3 turns`);
		}
	}
}

/** 6. Tera: offensive vs defensive, when, and outcome. */
function detectTera(g) {
	if (g.gen !== 9) return;
	const used = { p1: false, p2: false };
	for (let t = 1; t <= g.lastTurn; t++) {
		const T = g.turns[t];
		if (!T || !T.start) continue;
		for (const ev of T.events) {
			if (ev.k !== 'tera') continue;
			const A = ev.side, B = other(A), S = ev.mon;
			used[A] = true;
			const act = actionOf(T, A);
			let offensive = false;
			if (act.type === 'move' || act.type === 'pivot') {
				const type = moveType(g, S, act.ev.id, t);
				offensive = ev.type === 'Stellar' ? act.ev.move.category !== 'Status' : type === ev.type;
			}
			const orig = origTypes(g, S), tera = ev.type === 'Stellar' ? orig : [ev.type];
			let confirmed = false, backfire = false;
			for (const m of T.events) {
				if (m.k !== 'move' || m.side !== B || T.events.indexOf(m) < ev.idx || m.target !== S) continue;
				const type = moveType(g, m.mon, m.id, t);
				if (!type) continue;
				const o = multOn(g, type, orig, S, m.id), n = multOn(g, type, tera, S, m.id);
				if ((o >= 1 && n <= 0.5) || (o >= 2 && n <= 1)) confirmed = true;
				if (o <= 1 && n >= 2) backfire = true;
			}
			const foe = T.start[B].active;
			let anticipated = false;
			if (foe && actionOf(T, B).type !== 'switch') {
				for (const a of attackTypes(g, foe, t)) {
					const o = multOn(g, a.type, orig, S, a.id), n = multOn(g, a.type, tera, S, a.id);
					if ((o >= 2 && n <= 1) || (o >= 1 && n <= 0.5)) anticipated = true;
				}
			}
			const defensive = confirmed || anticipated;
			const cls = offensive && defensive ? 'both' : offensive ? 'offensive' : defensive ? 'defensive' : 'other';
			add('tera', 'n', g, A);
			add('tera', `${cls}.n`, g, A);
			add('tera', `${cls}.turn.${turnBucket(t)}`, g, A);
			add('tera', `${cls}.turnSum`, g, A, t);
			add('tera', `${cls}.ownAliveSum`, g, A, T.start[A].alive);
			add('tera', `${cls}.foeAliveSum`, g, A, T.start[B].alive);
			add('tera', `${cls}.hpSum`, g, A, T.start[A].active === S ? (T.start[A].hp || 0) : 1);
			if (defensive && confirmed) add('tera', `${cls}.hitConfirmedResisted`, g, A);
			if (backfire) add('tera', `${cls}.backfiredIntoWeakness`, g, A);
			if (koIn(S, t, t)) add('tera', `${cls}.KOthisTurn`, g, A);
			if (koIn(S, t, t + 2)) add('tera', `${cls}.KOwithin2`, g, A);
			if (!faintedIn(g, S, t, t + 1)) add('tera', `${cls}.survived2`, g, A);
			if (g.winner) add('tera', `${cls}.won`, g, A, g.winner === A ? 1 : 0);
			if (cls === 'defensive' && confirmed && !faintedIn(g, S, t, t + 1)) example('tera', g, t, `${nameOf(S)} Tera ${ev.type} took a hit its original typing would not have resisted`);
			if (cls === 'offensive' && koIn(S, t, t)) example('tera', g, t, `${nameOf(S)} Tera ${ev.type} + ${act.ev.move.name} for the KO`);
		}
	}
	for (const side of ['p1', 'p2']) {
		add('tera', 'sidesInGame', g, side);
		if (!used[side]) add('tera', 'sidesNeverTera', g, side);
		if (g.winner && used[side]) add('tera', 'usedAndWon', g, side, g.winner === side ? 1 : 0);
		if (g.winner && !used[side]) add('tera', 'unusedAndWon', g, side, g.winner === side ? 1 : 0);
	}
}

/** 7. Attacking the switch. */
function detectHitSwitch(g) {
	for (let t = 1; t <= g.lastTurn; t++) {
		const T = g.turns[t];
		if (!T || !T.start) continue;
		for (const A of ['p1', 'p2']) {
			const B = other(A);
			const bAct = actionOf(T, B), aAct = actionOf(T, A);
			if (bAct.type !== 'switch' || aAct.type === 'switch' || !aAct.ev) continue;
			const mon = aAct.ev.mon;
			if (mon !== T.start[A].active) continue;
			const type = moveType(g, mon, aAct.ev.id, t);
			if (!type) continue;
			const B0 = bAct.ev.prev || T.start[B].active, X = bAct.ev.mon;
			if (!B0 || !X) continue;
			const onB0 = multOn(g, type, typesOf(g, B0, t, false), B0, aAct.ev.id);
			const onX = multOn(g, type, typesOf(g, X, t, true), X, aAct.ev.id);
			const maybeLocked = mon.lastActionTurn >= 0 && g.turns[t - 1] && actionOf(g.turns[t - 1], A).ev &&
				actionOf(g.turns[t - 1], A).ev.mon === mon && actionOf(g.turns[t - 1], A).ev.id === aAct.ev.id;
			// Pivots and hazard-setting attacks are clicked for their side effect; a "read" with them is incidental.
			const sideEffect = PIVOTS.has(aAct.ev.id) || HAZARD_MOVES.has(aAct.ev.id);
			const key = maybeLocked ? 'repeatMove' : sideEffect ? 'sideEffectMove' : 'freshMove';
			add('hitSwitch', `${key}.opportunities`, g, A);
			if (onX >= 2) add('hitSwitch', `${key}.SEonSwitchIn`, g, A);
			if (onB0 <= 0.5 && onX >= 2) {
				add('hitSwitch', `${key}.hardRead`, g, A);
				if (key === 'freshMove') {
					if (faintedIn(g, X, t, t + 1)) add('hitSwitch', 'hardRead.switchInFaintedWithin1', g, A);
					if (leftIn(g, X, t + 1, t + 2) || faintedIn(g, X, t, t + 2)) add('hitSwitch', 'hardRead.switchInGoneWithin2', g, A);
					if (g.winner) add('hitSwitch', 'hardRead.won', g, A, g.winner === A ? 1 : 0);
					example('hitSwitch', g, t, `${nameOf(mon)} used ${aAct.ev.move.name} (${onB0}x on ${nameOf(B0)}) as it switched to ${nameOf(X)} (${onX}x)`);
				}
			}
			if (onB0 < onX) add('hitSwitch', `${key}.betterOnSwitchIn`, g, A);
			if (onB0 > onX) add('hitSwitch', `${key}.worseOnSwitchIn`, g, A);
			if (key === 'freshMove' && g.winner) add('hitSwitch', 'freshMove.won', g, A, g.winner === A ? 1 : 0);
		}
	}
}

/** 8. Hazards: setting, removing, and whether removal is clicked when it matters. */
const HAZARD_SETTERS = {};
function detectHazards(g) {
	const firstSR = { p1: null, p2: null };
	const upSince = { p1: null, p2: null };
	for (let t = 1; t <= g.lastTurn; t++) {
		const T = g.turns[t];
		if (!T || !T.start) continue;
		for (const side of ['p1', 'p2']) {
			if (hzAny(T.start[side].hz) && upSince[side] === null) upSince[side] = t;
			if (!hzAny(T.start[side].hz) && upSince[side] !== null) {
				add('hazards', 'hazardSpells', g, side);
				add('hazards', 'hazardSpellTurnsSum', g, side, t - upSince[side]);
				upSince[side] = null;
			}
		}
		for (const ev of T.events) {
			if (ev.k === 'hazard') {
				const setterSide = other(ev.side);
				add('hazards', `set.${ev.key}`, g, setterSide);
				add('hazards', `set.${ev.key}.turn.${turnBucket(t)}`, g, setterSide);
				if (ev.key === 'sr' && firstSR[ev.side] === null) { firstSR[ev.side] = t; add('hazards', 'firstSRturnSum', g, setterSide, t); add('hazards', 'firstSRcount', g, setterSide); }
				if (ev.setter) HAZARD_SETTERS[ev.setter.species] = (HAZARD_SETTERS[ev.setter.species] || 0) + 1;
			}
			if (ev.k === 'move' && ev.action && REMOVAL.has(ev.id)) {
				const A = ev.side;
				add('hazards', `remove.${ev.id}.n`, g, A);
				if (hzAny(ev.hzOwn)) add('hazards', `remove.${ev.id}.ownHazardsUp`, g, A);
				if (ev.id === 'defog' && hzAny(ev.hzFoe)) add('hazards', 'remove.defog.alsoClearedFoeHazards', g, A);
				if (ev.id === 'defog' && !hzAny(ev.hzOwn) && hzAny(ev.hzFoe)) add('hazards', 'remove.defog.onlyFoeHadHazards', g, A);
				if (hzAny(ev.hzOwn)) {
					add('hazards', `remove.layers.${hzKey(ev.hzOwn)}`, g, A);
					if (T.events.some(e => e.k === 'hazardEnd' && e.side === A && e.from === ev.id) || (ev.id === 'courtchange' && T.events.some(e => e.k === 'courtchange'))) add('hazards', `remove.${ev.id}.succeeded`, g, A);
				}
			}
		}
		// Opportunity: own hazards up and the active has a removal move.
		for (const A of ['p1', 'p2']) {
			const mon = T.start[A].active;
			if (!mon || !hasMove(mon, id => REMOVAL.has(id) && id !== 'tidyup')) continue;
			const act = actionOf(T, A);
			if (act.type === 'cant' || act.type === 'none') continue;
			const h = T.start[A].hz;
			const k = hzAny(h) ? `opp.${hzKey(h)}` : 'opp.none';
			const clicked = act.ev && REMOVAL.has(act.ev.id) ? 1 : 0;
			add('hazards', `${k}.turns`, g, A);
			add('hazards', `${k}.removed`, g, A, clicked);
			const weight = h.sr + h.spk + h.tsp + h.web;
			const wk = `opp.weight${Math.min(weight, 3)}`;
			add('hazards', `${wk}.turns`, g, A);
			add('hazards', `${wk}.removed`, g, A, clicked);
			if (clicked && weight >= 2) example('hazards', g, t, `${nameOf(mon)} used ${act.ev.move.name} facing ${hzKey(h)} on its side`);
		}
	}
}

/** 9. Revenge killing: which replacement follows a KO, and does it work. */
function detectRevenge(g) {
	for (let t = 1; t <= g.lastTurn; t++) {
		const T = g.turns[t], N = g.turns[t + 1];
		if (!T || !N || !N.start) continue;
		for (const f of T.events) {
			if (f.k !== 'faint' || !f.by) continue;
			const B = f.side, A = other(B), K = f.by;
			if (K.fainted && K.faintTurn <= t) continue;
			const rep = T.events.find(e => e.k === 'switch' && e.side === B && e.phase === 'replace' && T.events.indexOf(e) > T.events.indexOf(f));
			if (!rep || N.start[A].active !== K || N.start[B].active !== rep.mon) continue;
			const options = [rep.mon, ...N.start[B].bench];
			if (options.length <= 1) { add('revenge', 'onlyOneOption', g, B); continue; }
			const R = rep.mon;
			const kStage = stageMult(N.start[A].boosts.spe || 0) * (N.start[A].status === 'par' ? 0.5 : 1) *
				((K.origItem === 'Choice Scarf' || (K.scarfTurn !== null && K.scarfTurn <= t)) ? 1.5 : 1);
			const tr = N.start.field.trickRoom;
			const cats = m => {
				const out = [];
				const mScarf = m.origItem === 'Choice Scarf' || m.scarfTurn !== null;
				const mSpe = maxSpe(g.gen, m) * (mScarf ? 1.5 : 1);
				if (Object.keys(m.moves).some(id => { const mv = moveOf(g.gen, id); const ty = moveType(g, m, id, t + 1); return mv.priority > 0 && mv.category !== 'Status' && ty && multOn(g, ty, typesOf(g, K, t + 1, false), K, id) >= 1; })) out.push('priority');
				if (!tr && mSpe > maxSpe(g.gen, K) * kStage) out.push('faster');
				if (mScarf) out.push('scarf');
				if (threatens(g, m, K, Infinity, t + 1)) out.push('typeAdvantage');
				if (walls(g, m, K, t + 1, t + 1)) out.push('resistsKiller');
				return out;
			};
			const rc = cats(R);
			add('revenge', 'cases', g, B);
			for (const c of ['priority', 'faster', 'scarf', 'typeAdvantage', 'resistsKiller']) {
				add('revenge', `baseline.${c}`, g, B, benchShare(options, m => cats(m).includes(c)));
				if (rc.includes(c)) add('revenge', `chose.${c}`, g, B);
			}
			const tag = rc.includes('priority') || rc.includes('faster') ? (rc.includes('typeAdvantage') ? 'fasterAndSE' : 'fasterOrPriority')
				: rc.includes('resistsKiller') ? 'resistsOnly' : rc.includes('typeAdvantage') ? 'slowerButSE' : 'noEdge';
			add('revenge', `${tag}.n`, g, B);
			const ko = koOfIn(g, R, K, t + 1, t + 1);
			const out = !ko && leftIn(g, K, t + 1, t + 1);
			if (ko) add('revenge', `${tag}.KOnext`, g, B);
			if (out) add('revenge', `${tag}.killerLeft`, g, B);
			if (faintedIn(g, R, t + 1, t + 1)) add('revenge', `${tag}.replacementFainted`, g, B);
			add('revenge', 'all.n', g, B);
			if (ko) add('revenge', 'all.KOnext', g, B);
			if (ko && tag === 'fasterAndSE') example('revenge', g, t + 1, `${nameOf(K)} KO'd ${nameOf(f.mon)}; ${nameOf(R)} came in (faster/priority + super-effective) and KO'd it`);
		}
	}
}

/** 10a. Protect scouting; 10b. status targeting; 10c. response to setup. */
function detectExtras(g) {
	for (let t = 1; t <= g.lastTurn; t++) {
		const T = g.turns[t], P = g.turns[t - 1];
		if (!T || !T.start) continue;
		for (const A of ['p1', 'p2']) {
			const B = other(A);
			const mon = T.start[A].active, foe = T.start[B].active;
			if (!mon || !foe) continue;
			const act = actionOf(T, A);
			if (act.type === 'none' || act.type === 'cant') continue;
			const clicked = id => (act.ev && act.ev.id === id) || (id === 'protect' && act.ev && PROTECTS.has(act.ev.id));
			// Protect scouting.
			if (hasMove(mon, id => PROTECTS.has(id))) {
				const foeEntry = foe.entries.filter(e => e.turn < t).pop();
				const fresh = foeEntry && foeEntry.turn === t - 1;
				const ownEntry = mon.entries.filter(e => e.turn < t).pop();
				const selfFresh = ownEntry && ownEntry.turn === t - 1;
				const k = fresh ? 'foeJustIn' : 'foeStayed';
				add('extras', `protect.${k}.turns`, g, A);
				if (clicked('protect')) {
					add('extras', `protect.${k}.clicked`, g, A);
					const next = actionOf(g.turns[t + 1], A);
					add('extras', `protect.${k}.nextTurnKnown`, g, A, next.type !== 'none' ? 1 : 0);
					if (next.type === 'switch') add('extras', `protect.${k}.switchedNextTurn`, g, A);
				}
				if (selfFresh) { add('extras', 'protect.selfJustIn.turns', g, A); if (clicked('protect')) add('extras', 'protect.selfJustIn.clicked', g, A); }
			}
			// Status targeting.
			const fs = baseStats(g.gen, foe), ms = baseStats(g.gen, mon);
			const foeTypes = typesOf(g, foe, t, false);
			if (!T.start[B].status) {
				if (hasMove(mon, id => id === 'willowisp') && !foeTypes.includes('Fire')) {
					const k = fs.atk > fs.spa ? 'physicalFoe' : 'specialFoe';
					add('extras', `wisp.${k}.turns`, g, A);
					if (clicked('willowisp')) add('extras', `wisp.${k}.clicked`, g, A);
				}
				if (hasMove(mon, id => id === 'thunderwave') && !foeTypes.includes('Electric') && !foeTypes.includes('Ground')) {
					const k = fs.spe > ms.spe ? 'fasterFoe' : 'slowerFoe';
					add('extras', `twave.${k}.turns`, g, A);
					if (clicked('thunderwave')) add('extras', `twave.${k}.clicked`, g, A);
				}
				if (hasMove(mon, id => id === 'toxic') && !foeTypes.includes('Poison') && !foeTypes.includes('Steel')) {
					const k = fs.hp + fs.def + fs.spd >= 280 ? 'bulkyFoe' : 'frailFoe';
					add('extras', `toxic.${k}.turns`, g, A);
					if (clicked('toxic')) add('extras', `toxic.${k}.clicked`, g, A);
				}
			}
			for (const [id, bad] of [['willowisp', ['Fire']], ['thunderwave', ['Electric', 'Ground']], ['toxic', ['Poison', 'Steel']]]) {
				if (!clicked(id)) continue;
				add('extras', `statusClicks.${id}`, g, A);
				if (actionOf(T, B).type === 'switch') { add('extras', `statusClicks.${id}.intoSwitch`, g, A); continue; }
				add('extras', `statusClicks.${id}.foeStayed`, g, A);
				if (T.start[B].status) add('extras', `statusClicks.${id}.intoStatused`, g, A);
				else if (foeTypes.some(x => bad.includes(x))) add('extras', `statusClicks.${id}.intoImmuneType`, g, A);
			}
			// Response to the foe setting up last turn.
			if (P && P.start) {
				const pb = actionOf(P, B);
				if (pb.type === 'move' && SETUP.has(pb.ev.id) && pb.ev.mon === foe && P.start[A].active === mon) {
					let r;
					if (act.type === 'switch') r = 'switch';
					else if (act.type === 'pivot') r = 'pivot';
					else if (PHAZE.has(act.ev.id)) r = 'phazeHazeEncore';
					else if (act.ev.move.category === 'Status') r = SETUP.has(act.ev.id) ? 'setupBack' : 'otherStatus';
					else r = act.ev.move.priority > 0 ? 'priorityAttack' : 'attack';
					add('extras', 'vsSetup.n', g, A);
					add('extras', `vsSetup.${r}`, g, A);
				}
			}
		}
	}
}

/* -------------------------------------------------------------------- main */

const t0 = Date.now();
let files = 0, skipped = 0;
for (const pool of POOLS) {
	const dir = path.join(MINED, pool);
	if (!fs.existsSync(dir)) continue;
	let names = fs.readdirSync(dir).filter(f => f.endsWith('.log.gz')).sort();
	if (SAMPLE) names = names.slice(0, SAMPLE);
	for (const name of names) {
		let g;
		try {
			const text = zlib.gunzipSync(fs.readFileSync(path.join(dir, name))).toString('utf8');
			g = parseGame(text, name, pool);
		} catch (e) {
			skipped++;
			continue;
		}
		if (!g.singles || g.lastTurn < 2) { skipped++; continue; }
		add('corpus', 'games', g, 'p1');
		add('corpus', 'sides', g, 'p1'); add('corpus', 'sides', g, 'p2');
		add('corpus', 'turns', g, 'p1', g.lastTurn);
		// Order matters: scarf inference tags mons used by later detectors.
		detectScarf(g);
		detectDoubleSwitch(g);
		detectPivot(g);
		detectSack(g);
		detectSetup(g);
		detectTera(g);
		detectHitSwitch(g);
		detectHazards(g);
		detectRevenge(g);
		detectExtras(g);
		files++;
		if (files % 250 === 0) process.stdout.write(`\r  ${files} replays (${pool})   `);
	}
}
process.stdout.write(`\r  ${files} replays read, ${skipped} skipped, ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

/* ------------------------------------------------------------------- rates */

const pct = (a, b) => (b ? Math.round((a || 0) / b * 1000) / 10 : null);
const avg = (a, b) => (b ? Math.round((a || 0) / b * 100) / 100 : null);

/** Headline rates per pattern, computed for any group row. */
const RATES = {
	doubleSwitch: r => ({
		opportunities: r.opportunities || 0,
		sameTurnDoublePct: pct(r.sameTurnDouble, r.opportunities),
		sameTurnDoubleToThreatPct: pct(r.sameTurnDoubleToThreat, r.opportunities),
		threatShareAmongDoubles: pct(r.sameTurnDoubleToThreat, r.sameTurnDouble),
		randomBenchThreatShare: pct(r.benchThreatShareSum, r.sameTurnDouble),
		toThreatWhenOwnActiveWasSafePct: pct(r.toThreatWhileB0Safe, r.doubleWhileB0Safe),
		stayedPct: pct(r.stayed, r.opportunities),
		nextTurnSwitchPct: pct(r.nextTurnSwitch, r.nextTurnOpps),
		nextTurnThreatShare: pct(r.nextTurnSwitchToThreat, r.nextTurnSwitch),
		nextTurnRandomBenchThreatShare: pct(r.nextBenchThreatShareSum, r.nextTurnSwitch),
		sameTurn_payoff_YKOsX: pct(r['same.YKOsX'], r['same.payoffCases']),
		sameTurn_payoff_XForcedOut: pct(r['same.XForcedOut'], r['same.payoffCases']),
		sameTurn_YFainted: pct(r['same.YFainted'], r['same.payoffCases']),
		sameTurnNonThreat_payoff_YKOsX: pct(r['sameNoThreat.YKOsX'], r['sameNoThreat.payoffCases']),
		sameTurnNonThreat_payoff_XForcedOut: pct(r['sameNoThreat.XForcedOut'], r['sameNoThreat.payoffCases']),
		sameTurnNonThreat_YFainted: pct(r['sameNoThreat.YFainted'], r['sameNoThreat.payoffCases']),
		nextTurn_payoff_YKOsX: pct(r['next.YKOsX'], r['next.payoffCases']),
		nextTurn_payoff_XForcedOut: pct(r['next.XForcedOut'], r['next.payoffCases']),
		nextTurn_YFainted: pct(r['next.YFainted'], r['next.payoffCases']),
	}),
	scarf: r => ({
		alreadyKnownScarfOutspeeds: r.outspeedAlreadyKnownScarf || 0,
		unexplainedEvenWithScarf: r.unexplainedEvenWithScarf || 0,
		...Object.fromEntries(['strict', 'likely'].map(tier => [tier, {
			inferred: r[`${tier}.inferred`] || 0,
			itemRevealed: (r[`${tier}.validatedByItem`] || 0) + (r[`${tier}.contradictedByItem`] || 0),
			itemRevealedAsScarfPct: pct(r[`${tier}.validatedByItem`], (r[`${tier}.validatedByItem`] || 0) + (r[`${tier}.contradictedByItem`] || 0)),
			contradictedByMoveLockPct: pct(r[`${tier}.contradictedByMoveLock`], r[`${tier}.inferred`]),
			notContradictedPct: pct(r[`${tier}.notContradicted`], r[`${tier}.inferred`]),
		}])),
		pre: { turns: r['pre.turns'] || 0, switchOutPct: pct(r['pre.switchOut'], r['pre.turns']), pivotPct: pct(r['pre.pivot'], r['pre.turns']),
			priorityAttackPct: pct(r['pre.priorityAttack'], r['pre.turns']), KOdByScarferPct: pct(r['pre.KOdByScarfer'], r['pre.turns']),
			lowHpSwitchOutPct: pct(r['pre.lowHpSwitchOut'], r['pre.lowHpTurns']), lowHpTurns: r['pre.lowHpTurns'] || 0 },
		post: { turns: r['post.turns'] || 0, switchOutPct: pct(r['post.switchOut'], r['post.turns']), pivotPct: pct(r['post.pivot'], r['post.turns']),
			priorityAttackPct: pct(r['post.priorityAttack'], r['post.turns']), KOdByScarferPct: pct(r['post.KOdByScarfer'], r['post.turns']),
			lowHpSwitchOutPct: pct(r['post.lowHpSwitchOut'], r['post.lowHpTurns']), lowHpTurns: r['post.lowHpTurns'] || 0 },
	}),
	pivot: r => ({
		pivotUses: r.pivotUses || 0,
		foeSwitchedOnPivotTurnPct: pct(r.pivotIntoFoeSwitch, r.pivotUses),
		foeSwitchedOnOtherMoveTurnPct: pct(r.otherMoveIntoFoeSwitch, r.otherMoveUses),
		pivotedInThreatToSwitchInPct: pct(r.broughtThreatToSwitchIn, r.foeSwitchCases),
		randomBenchThreatToSwitchInPct: pct(r.benchThreatShareSum, r.foeSwitchCases),
		pivotedInResistToSwitchInPct: pct(r.broughtResistToSwitchIn, r.foeSwitchCases),
		randomBenchResistPct: pct(r.benchWallShareSum, r.foeSwitchCases),
		foeSwitchInWasCounterToPivoterPct: pct(r.foeSwitchedToCounterOfPivoter, r.foeSwitchCases),
		foeStayed_pivotedInThreatPct: pct(r.broughtThreatToStayer, r.foeStayedCases),
		foeStayed_randomBenchThreatPct: pct(r.stayBenchThreatShareSum, r.foeStayedCases),
	}),
	sack: r => {
		const out = { situations: r.decisions || 0, stayPct: pct(r.stay, r.decisions), switchSavePct: pct(r.save, r.decisions), pivotPct: pct(r.pivot, r.decisions) };
		for (const b of ['stayDied', 'staySurvived', 'save', 'pivot']) {
			const n = r[`${b}.n`];
			if (!n) continue;
			out[b] = { n, avgLaterKOs: avg(r[`${b}.laterKOs`], n), laterKOAtLeast1Pct: pct(r[`${b}.laterKOsAtLeast1`], n),
				avgPriorKOs: avg(r[`${b}.priorKOs`], n), aliveAtEndPct: pct(r[`${b}.aliveAtEnd`], n), winPct: pct(r[`${b}.won`], n), rolesPct: {} };
			for (const role of ['setup', 'remover', 'hazardSetter', 'pivot', 'recovery', 'priority', 'scarf']) out[b].rolesPct[role] = pct(r[`${b}.role.${role}`], n);
		}
		out.saveRateBySegment = {};
		for (const [k, v] of Object.entries(r)) {
			const m = /^seg\.(.*)\.n$/.exec(k);
			if (m && v >= 20) out.saveRateBySegment[m[1]] = { n: v, savePct: pct(r[`seg.${m[1]}.save`], v) };
		}
		out.stayMoveMix = { attack: pct(r['stay.move.attack'], r.stay), status: pct(r['stay.move.status'], r.stay), hazard: pct(r['stay.move.hazard'], r.stay) };
		out.sackFreeSwitch = { n: r['sackFreeSwitch.n'] || 0, KOwithin2Pct: pct(r['sackFreeSwitch.KOwithin2'], r['sackFreeSwitch.n']), setupNextPct: pct(r['sackFreeSwitch.setupNext'], r['sackFreeSwitch.n']) };
		return out;
	},
	setup: r => {
		const out = {};
		for (const c of ['all', 'freeSwitchAfterFaint', 'cameInLastTurn', 'foeSwitchingThisTurn', 'forcedSwitchLastTurn', 'foePassive',
			'foeKnownAttacksResisted', 'foeThreatensSE', 'hp>=70', 'hp<70', 'noSafetyContext']) {
			const n = r[`${c}.n`];
			if (!n) continue;
			out[c] = { n, shareOfSetups: pct(n, r['all.n']), KOwithin3Pct: pct(r[`${c}.KOwithin3`], n), survived3Pct: pct(r[`${c}.survived3`], n),
				faintedBeforeKOPct: pct(r[`${c}.faintedBeforeKO`], n), twoKOsWithin6Pct: pct(r[`${c}.twoKOsWithin6`], n) };
		}
		return out;
	},
	tera: r => {
		const out = { teras: r.n || 0, sidesNeverTeraPct: pct(r.sidesNeverTera, r.sidesInGame),
			winPctWhenUsed: pct(r.usedAndWon, (r.sidesInGame || 0) - (r.sidesNeverTera || 0)), winPctWhenUnused: pct(r.unusedAndWon, r.sidesNeverTera) };
		for (const c of ['offensive', 'defensive', 'both', 'other']) {
			const n = r[`${c}.n`];
			if (!n) continue;
			const turns = {};
			for (const b of ['1-3', '4-8', '9-15', '16-25', '26+']) turns[b] = pct(r[`${c}.turn.${b}`], n);
			out[c] = { n, share: pct(n, r.n), avgTurn: avg(r[`${c}.turnSum`], n), avgOwnAlive: avg(r[`${c}.ownAliveSum`], n),
				avgFoeAlive: avg(r[`${c}.foeAliveSum`], n), avgHp: avg(r[`${c}.hpSum`], n), 				hitConfirmedResistedPct: pct(r[`${c}.hitConfirmedResisted`], n), backfiredPct: pct(r[`${c}.backfiredIntoWeakness`], n),
				KOthisTurnPct: pct(r[`${c}.KOthisTurn`], n), KOwithin2Pct: pct(r[`${c}.KOwithin2`], n), survived2Pct: pct(r[`${c}.survived2`], n),
				winPct: pct(r[`${c}.won`], n), turnBuckets: turns };
		}
		return out;
	},
	hitSwitch: r => ({
		opportunities: r['freshMove.opportunities'] || 0,
		hardReadPct: pct(r['freshMove.hardRead'], r['freshMove.opportunities']),
		SEonSwitchInPct: pct(r['freshMove.SEonSwitchIn'], r['freshMove.opportunities']),
		betterOnSwitchInPct: pct(r['freshMove.betterOnSwitchIn'], r['freshMove.opportunities']),
		worseOnSwitchInPct: pct(r['freshMove.worseOnSwitchIn'], r['freshMove.opportunities']),
		sideEffectMoveOpportunities: r['sideEffectMove.opportunities'] || 0,
		sideEffectMoveHardReadPct: pct(r['sideEffectMove.hardRead'], r['sideEffectMove.opportunities']),
		repeatMoveOpportunities: r['repeatMove.opportunities'] || 0,
		repeatMoveHardReadPct: pct(r['repeatMove.hardRead'], r['repeatMove.opportunities']),
		hardRead_switchInFaintedWithin1Pct: pct(r['hardRead.switchInFaintedWithin1'], r['freshMove.hardRead']),
		hardRead_switchInGoneWithin2Pct: pct(r['hardRead.switchInGoneWithin2'], r['freshMove.hardRead']),
		hardRead_winPct: pct(r['hardRead.won'], r['freshMove.hardRead']),
		allFreshMoves_winPct: pct(r['freshMove.won'], r['freshMove.opportunities']),
	}),
	hazards: r => {
		const out = { set: {}, removal: {}, removeWhenLayers: {}, clickRateWithRemoverActive: {} };
		for (const k of ['sr', 'spk', 'tsp', 'web', 'steel']) {
			if (!r[`set.${k}`]) continue;
			const turns = {};
			for (const b of ['1-3', '4-8', '9-15', '16-25', '26+']) turns[b] = pct(r[`set.${k}.turn.${b}`], r[`set.${k}`]);
			out.set[k] = { n: r[`set.${k}`], turnBuckets: turns };
		}
		out.avgFirstSRturn = avg(r.firstSRturnSum, r.firstSRcount);
		out.avgTurnsHazardsStayUp = avg(r.hazardSpellTurnsSum, r.hazardSpells);
		for (const id of REMOVAL) {
			const n = r[`remove.${id}.n`];
			if (!n) continue;
			out.removal[id] = { n, ownHazardsUpPct: pct(r[`remove.${id}.ownHazardsUp`], n), succeededWhenUpPct: pct(r[`remove.${id}.succeeded`], r[`remove.${id}.ownHazardsUp`]) };
		}
		if (out.removal.defog) {
			out.removal.defog.alsoClearedFoeHazardsPct = pct(r['remove.defog.alsoClearedFoeHazards'], r['remove.defog.n']);
			out.removal.defog.onlyFoeHadHazardsPct = pct(r['remove.defog.onlyFoeHadHazards'], r['remove.defog.n']);
		}
		for (const [k, v] of Object.entries(r)) {
			const m = /^remove\.layers\.(.*)$/.exec(k);
			if (m) out.removeWhenLayers[m[1]] = v;
			const o = /^opp\.(.*)\.turns$/.exec(k);
			if (o && v >= 5) out.clickRateWithRemoverActive[o[1]] = { turns: v, removedPct: pct(r[`opp.${o[1]}.removed`], v) };
		}
		return out;
	},
	revenge: r => {
		const out = { cases: r.cases || 0, KOnextPct: pct(r['all.KOnext'], r['all.n']), choseVsRandom: {}, byEdge: {} };
		for (const c of ['priority', 'faster', 'scarf', 'typeAdvantage', 'resistsKiller']) {
			out.choseVsRandom[c] = { chosePct: pct(r[`chose.${c}`], r.cases), randomBenchPct: pct(r[`baseline.${c}`], r.cases) };
		}
		for (const tag of ['fasterAndSE', 'fasterOrPriority', 'slowerButSE', 'resistsOnly', 'noEdge']) {
			const n = r[`${tag}.n`];
			if (!n) continue;
			out.byEdge[tag] = { n, share: pct(n, r.cases), KOnextPct: pct(r[`${tag}.KOnext`], n), killerLeftPct: pct(r[`${tag}.killerLeft`], n), replacementFaintedPct: pct(r[`${tag}.replacementFainted`], n) };
		}
		return out;
	},
	extras: r => {
		const rate = (k) => ({ turns: r[`${k}.turns`] || 0, clickedPct: pct(r[`${k}.clicked`], r[`${k}.turns`]) });
		const out = {
			protect: { foeJustIn: rate('protect.foeJustIn'), foeStayed: rate('protect.foeStayed'), selfJustIn: rate('protect.selfJustIn'),
				switchAfterScoutProtectPct: pct(r['protect.foeJustIn.switchedNextTurn'], r['protect.foeJustIn.nextTurnKnown']),
				switchAfterOtherProtectPct: pct(r['protect.foeStayed.switchedNextTurn'], r['protect.foeStayed.nextTurnKnown']) },
			willOWisp: { physicalFoe: rate('wisp.physicalFoe'), specialFoe: rate('wisp.specialFoe') },
			thunderWave: { fasterFoe: rate('twave.fasterFoe'), slowerFoe: rate('twave.slowerFoe') },
			toxic: { bulkyFoe: rate('toxic.bulkyFoe'), frailFoe: rate('toxic.frailFoe') },
			statusIntoStatusedPct: {}, statusIntoImmuneTypePct: {}, statusIntoSwitchPct: {},
			responseToFoeSetup: { n: r['vsSetup.n'] || 0 },
		};
		for (const id of ['willowisp', 'thunderwave', 'toxic']) {
			out.statusIntoStatusedPct[id] = pct(r[`statusClicks.${id}.intoStatused`], r[`statusClicks.${id}.foeStayed`]);
			out.statusIntoImmuneTypePct[id] = pct(r[`statusClicks.${id}.intoImmuneType`], r[`statusClicks.${id}.foeStayed`]);
			out.statusIntoSwitchPct[id] = pct(r[`statusClicks.${id}.intoSwitch`], r[`statusClicks.${id}`]);
		}
		for (const k of ['attack', 'priorityAttack', 'switch', 'pivot', 'phazeHazeEncore', 'setupBack', 'otherStatus']) out.responseToFoeSetup[k] = pct(r[`vsSetup.${k}`], r['vsSetup.n']);
		return out;
	},
	corpus: r => ({ games: r.games || 0, avgTurns: avg(r.turns, r.games) }),
};

const DEFINITIONS = {
	doubleSwitch: 'Opportunity: side A voluntarily switches in X that walls B\'s active (resists all of its STAB + revealed attacks) or hits it SE without being hit SE back. Same-turn double: B also voluntarily switched that turn; "to threat" = B\'s incoming Y has a STAB/revealed move SE on X. Baseline = share of B\'s living bench that threatens X. Next-turn: B attacked, X and B0 still in next turn, B then switched. Payoff within 2 turns: Y KOs X, or X leaves.',
	scarf: 'Both sides used a priority-0 move with the same mons as at turn start; the first mover\'s max Speed (252+ nature) is below the second\'s uninvested neutral Speed; excluded: Trick Room, Tailwind, any Speed stage, paralysed second mover, Quark/Proto Speed, Quick Claw/Draw/Custap, Prankster/Gale Wings/Triage/Grassy Glide, weather/terrain speed abilities, Unburden, Slow Start/Stall, Trick Room/Gyro Ball users. Validation: original item later revealed, or two different moves on consecutive turns without leaving (not choice-locked). Behaviour: opponent turns facing the flagged mon with a mon that "should" outspeed it, before vs after the reveal turn.',
	pivot: 'U-turn/Volt Switch/Flip Turn/Parting Shot/Teleport as the turn action. Compared with other moves: how often the foe switched that turn. When it did, does the pivot-in threaten (SE) or wall the switch-in vs the average of the living bench? (Note: the pivot target is chosen after seeing the switch-in.)',
	sack: 'Start of turn, own active at <=35% HP, not last mon, foe active outspeeds (uninvested foe vs max own, boosts/par applied) or has a revealed priority attack, and has a known attack >=1x on it. Decision = stay (attack/status), switch (save), pivot. Outcome = later KOs by that mon, alive at end, wins; roles from all revealed moves.',
	setup: 'Setup move (SD, DD, NP, CM, QD, Shell Smash, Bulk Up, Belly Drum, Coil, Agility, Rock Polish, Victory Dance, Shift Gear, Geomancy, Tail Glow, Growth, Work Up, No Retreat, Clangorous Soul, Fillet Away, non-Ghost Curse, Tidy Up) as the turn action. Contexts are multi-label. Success = user KOs within 3 turns; survived 3 turns.',
	tera: 'Gen 9 only. Offensive = the Tera user\'s action that turn is a damaging move of the Tera type (Stellar: any attack). Defensive = the foe\'s attack that turn went from >=1x to <=0.5x (or 2x to <=1x) because of Tera (confirmed), or a known foe STAB/revealed type would have (anticipated, foe not switching).',
	hitSwitch: 'Foe voluntarily switched B0->X; our active used a damaging move of fixed type. Hard read = <=0.5x on B0 and >=2x on X. Excluded from the headline: "repeatMove" = same move as last turn by the same mon (possibly choice-locked) and "sideEffectMove" = U-turn/Volt Switch/Flip Turn/Ceaseless Edge/Stone Axe (clicked for the side effect).',
	hazards: 'Hazard sets from -sidestart; removals as turn actions; opportunity = turn where own active has a revealed Defog/Rapid Spin/Court Change/Mortal Spin, keyed by own-side hazards at turn start.',
	revenge: 'A mon KO\'d by a direct attack, the replacement chosen at end of turn (only when >1 option and the killer is still in). Categories for the replacement vs the killer: revealed priority attack (>=1x), faster (max Speed, x1.5 if scarf known/inferred, vs killer max Speed with its stages/par/scarf), scarf, SE STAB/revealed move, resists killer\'s known attacks. Baseline = average share among all living options. Success = replacement KOs the killer next turn.',
	extras: 'Protect-family click rate when the foe came in last turn vs not; Will-O-Wisp / Thunder Wave / Toxic click rates by target class (only turns where the move is revealed on the active and the target is valid); response on the turn after the foe used a setup move.',
};

function buildPattern(name) {
	const p = STATS[name] || {};
	const rate = RATES[name];
	const out = { definition: DEFINITIONS[name] || '', all: rate(p.all || {}), byPool: {}, byRating: {}, examples: EXAMPLES[name] || [] };
	for (const pool of POOLS) if (p['pool:' + pool]) out.byPool[pool] = rate(p['pool:' + pool]);
	for (const b of BANDS) if (p['band:' + b]) out.byRating[b] = rate(p['band:' + b]);
	out.rawCounts = p.all || {};
	return out;
}

const topN = (obj, n) => Object.fromEntries(Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n));
const insights = {
	builtAt: new Date().toISOString(),
	source: 'reference/replays, pools: ' + POOLS.join(', '),
	replays: files,
	ratingBands: 'rating from |player| line of the deciding side; players* pools are mostly unrated tournament games',
	caveat: 'Logs show results, not intentions. Every pattern is a reconstruction with the definitions given; baselines are provided where possible.',
	patterns: {},
};
for (const name of ['corpus', 'doubleSwitch', 'scarf', 'pivot', 'sack', 'setup', 'tera', 'hitSwitch', 'hazards', 'revenge', 'extras']) {
	insights.patterns[name] = buildPattern(name);
}
insights.patterns.scarf.topInferredSpecies = topN(SCARF_SPECIES, 15);
insights.patterns.hazards.topSetters = topN(HAZARD_SETTERS, 15);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(insights, null, 1));

/* ----------------------------------------------------------------- report */

const P = insights.patterns;
const line = s => console.log(s);
const bandLine = (name, pick) => BANDS.filter(b => P[name].byRating[b]).map(b => `${b}: ${pick(P[name].byRating[b])}`).join(' | ');
const poolLine = (name, pick) => POOLS.filter(p => P[name].byPool[p]).map(p => `${p}: ${pick(P[name].byPool[p])}`).join(' | ');

line(`\n=== LOGIC INSIGHTS (${files} replays) -> ${OUT}\n`);
const d = P.doubleSwitch.all;
line(`1. DOUBLE SWITCH  opps=${d.opportunities}  same-turn double ${d.sameTurnDoublePct}% (to threat ${d.sameTurnDoubleToThreatPct}%)`);
line(`   threat share among doubles ${d.threatShareAmongDoubles}% vs random bench ${d.randomBenchThreatShare}%; when own active was safe ${d.toThreatWhenOwnActiveWasSafePct}%`);
line(`   payoff same-turn: Y KOs X ${d.sameTurn_payoff_YKOsX}%, X forced out ${d.sameTurn_payoff_XForcedOut}%, Y fainted ${d.sameTurn_YFainted}%  | non-threat doubles: KO ${d.sameTurnNonThreat_payoff_YKOsX}% out ${d.sameTurnNonThreat_payoff_XForcedOut}% Yfaint ${d.sameTurnNonThreat_YFainted}%`);
line(`   next turn: switch ${d.nextTurnSwitchPct}%, threat share ${d.nextTurnThreatShare}% vs random ${d.nextTurnRandomBenchThreatShare}%; payoff KO ${d.nextTurn_payoff_YKOsX}% out ${d.nextTurn_payoff_XForcedOut}%`);
line(`   by rating (double-to-threat %): ${bandLine('doubleSwitch', r => `${r.sameTurnDoubleToThreatPct} (n=${r.opportunities})`)}`);
line(`   by pool: ${poolLine('doubleSwitch', r => `${r.sameTurnDoubleToThreatPct}`)}`);
const s = P.scarf.all;
line(`
2. SCARF  known=${s.alreadyKnownScarfOutspeeds} unexplained=${s.unexplainedEvenWithScarf}
   strict ${JSON.stringify(s.strict)}
   likely ${JSON.stringify(s.likely)}`);
line(`   foe facing it with a "should-outspeed" mon: pre ${JSON.stringify(s.pre)}`);
line(`                                              post ${JSON.stringify(s.post)}`);
line(`   top: ${JSON.stringify(P.scarf.topInferredSpecies)}`);
const pv = P.pivot.all;
line(`\n3. PIVOT  uses=${pv.pivotUses}; foe switched on pivot turns ${pv.foeSwitchedOnPivotTurnPct}% vs other moves ${pv.foeSwitchedOnOtherMoveTurnPct}%`);
line(`   into switch-in: threat ${pv.pivotedInThreatToSwitchInPct}% (random ${pv.randomBenchThreatToSwitchInPct}%), resist ${pv.pivotedInResistToSwitchInPct}% (random ${pv.randomBenchResistPct}%); switch-in was counter to pivoter ${pv.foeSwitchInWasCounterToPivoterPct}%`);
line(`   by rating (foe switched on pivot %): ${bandLine('pivot', r => r.foeSwitchedOnPivotTurnPct)}`);
const sk = P.sack.all;
line(`\n4. SACK/SAVE  situations=${sk.situations}; stay ${sk.stayPct}% save ${sk.switchSavePct}% pivot ${sk.pivotPct}%`);
for (const b of ['stayDied', 'staySurvived', 'save', 'pivot']) if (sk[b]) line(`   ${b}: ${JSON.stringify(sk[b])}`);
line(`   save rate by segment ${JSON.stringify(sk.saveRateBySegment)}`);
line(`   free switch after sack: ${JSON.stringify(sk.sackFreeSwitch)}; stay move mix ${JSON.stringify(sk.stayMoveMix)}`);
line(`   by rating (save %): ${bandLine('sack', r => `${r.switchSavePct} (n=${r.situations})`)}`);
line(`\n5. SETUP`);
for (const [c, v] of Object.entries(P.setup.all)) line(`   ${c.padEnd(24)} n=${String(v.n).padStart(5)} share ${v.shareOfSetups}%  KO<=3 ${v.KOwithin3Pct}%  surv3 ${v.survived3Pct}%  faintNoKO ${v.faintedBeforeKOPct}%  2KO<=6 ${v.twoKOsWithin6Pct}%`);
line(`\n6. TERA  ${JSON.stringify({ teras: P.tera.all.teras, neverPct: P.tera.all.sidesNeverTeraPct, winUsed: P.tera.all.winPctWhenUsed, winUnused: P.tera.all.winPctWhenUnused })}`);
for (const c of ['offensive', 'defensive', 'both', 'other']) if (P.tera.all[c]) line(`   ${c}: ${JSON.stringify(P.tera.all[c])}`);
const hs = P.hitSwitch.all;
line(`\n7. HIT THE SWITCH  opps=${hs.opportunities}; hard read ${hs.hardReadPct}%, SE on switch-in ${hs.SEonSwitchInPct}%, better on switch-in ${hs.betterOnSwitchInPct}% vs worse ${hs.worseOnSwitchInPct}%`);
line(`   hard read outcome: switch-in fainted<=1 ${hs.hardRead_switchInFaintedWithin1Pct}%, gone<=2 ${hs.hardRead_switchInGoneWithin2Pct}%, win ${hs.hardRead_winPct}% (all ${hs.allFreshMoves_winPct}%); locked/repeat ${hs.repeatMoveHardReadPct}%`);
line(`   by rating (hard read %): ${bandLine('hitSwitch', r => `${r.hardReadPct} (n=${r.opportunities})`)}`);
const hz = P.hazards.all;
line(`\n8. HAZARDS  set ${JSON.stringify(hz.set)}\n   first SR turn avg ${hz.avgFirstSRturn}; hazards stay up avg ${hz.avgTurnsHazardsStayUp} turns`);
line(`   removal ${JSON.stringify(hz.removal)}`);
line(`   click rate with remover active ${JSON.stringify(hz.clickRateWithRemoverActive)}`);
const rv = P.revenge.all;
line(`\n9. REVENGE  cases=${rv.cases}; KO next ${rv.KOnextPct}%\n   chose vs random ${JSON.stringify(rv.choseVsRandom)}\n   by edge ${JSON.stringify(rv.byEdge)}`);
line(`\n10. EXTRAS ${JSON.stringify(P.extras.all, null, 1)}`);
