'use strict';
/**
 * How strong humans actually play stall in Gen 9 National Dex OU, measured from public
 * Showdown replays, next to how our bot plays it (data/stall-study/round-<n>/logs).
 *
 *   node scripts/stall-replays.js --fetch [--max 300]   download replays (polite, cached)
 *   node scripts/stall-replays.js [--round 0]           print the metrics; --write refreshes the table in docs/stall-replay-study.md
 *
 * Single process, no workers: the PC is busy with simulations.
 * Raw replays are cached in data/stall-replays/raw/ (git-ignored).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { Dex } = require('pokemon-showdown');

const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'data', 'stall-replays', 'raw');
const arg = (name, fallback) => {
	const i = process.argv.indexOf(`--${name}`);
	return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
};
const has = name => process.argv.includes(`--${name}`);
const TERA_BAN = 1731974400; // ~19 Nov 2024: Smogon bans Tera in NatDex OU

// ------------------------------------------------------------------ fetching
const sleep = ms => new Promise(r => setTimeout(r, ms));
function get(url) {
	return new Promise((resolve, reject) => {
		https.get(url, { headers: { 'User-Agent': 'stall-study (single-threaded, cached)' } }, res => {
			let s = '';
			res.on('data', d => { s += d; });
			res.on('end', () => (res.statusCode === 200 ? resolve(s) : reject(new Error(`${res.statusCode} ${url}`))));
		}).on('error', reject);
	});
}
let lastReq = 0;
async function politeGet(url) {
	const wait = lastReq + 600 - Date.now(); // <= ~1.7 requests a second
	if (wait > 0) await sleep(wait);
	lastReq = Date.now();
	return get(url);
}
async function cached(file, url) {
	const p = path.join(RAW, file);
	if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
	const s = await politeGet(url);
	fs.writeFileSync(p, s);
	return s;
}

async function fetchAll() {
	fs.mkdirSync(RAW, { recursive: true });
	const max = +arg('max', 300);
	const minRating = +arg('min-rating', 1700);
	const index = new Map();
	for (const fmt of (arg('formats', 'gen9nationaldex')).split(',')) {
		for (let page = 1; page <= +arg('pages', 60); page++) {
			let list;
			try {
				list = JSON.parse(await cached(`search-${fmt}-rating-${page}.json`,
					`https://replay.pokemonshowdown.com/search.json?format=${fmt}&sort=rating&page=${page}`));
			} catch (e) { console.log('search failed', e.message); break; }
			if (!list.length) break;
			for (const r of list) if (!r.password && !r.private) index.set(r.id, r);
			const low = list[list.length - 1].rating || 0;
			if (low < minRating) break;
		}
	}
	const cands = [...index.values()].filter(r => (r.rating || 0) >= minRating);
	// Post-Tera-ban games first (the current metagame), then the rest, each by rating.
	cands.sort((a, b) => ((b.uploadtime >= TERA_BAN) - (a.uploadtime >= TERA_BAN)) || b.rating - a.rating);
	console.log(`${index.size} indexed, ${cands.length} at ${minRating}+ (${cands.filter(r => r.uploadtime >= TERA_BAN).length} post-ban)`);
	let n = fs.readdirSync(RAW).filter(f => f.startsWith('r-')).length;
	for (const r of cands) {
		if (n >= max) break;
		const file = `r-${r.id}.json`;
		if (fs.existsSync(path.join(RAW, file))) continue;
		try {
			await cached(file, `https://replay.pokemonshowdown.com/${r.id}.json`);
			n++;
			if (n % 25 === 0) console.log(`${n} downloaded`);
		} catch (e) { console.log('replay failed', r.id, e.message); }
	}
	console.log(`done: ${n} replays cached in ${RAW}`);
}

// ------------------------------------------------------------------ knowledge
const STALL_MONS = new Set([
	'Blissey', 'Chansey', 'Toxapex', 'Clodsire', 'Gliscor', 'Corviknight', 'Skarmory', 'Sableye', 'Dondozo',
	'Alomomola', 'Hippowdon', 'Garganacl', 'Ting-Lu', 'Pecharunt', 'Gastrodon', 'Quagsire', 'Slowbro', 'Slowking',
	'Tangrowth', 'Mandibuzz', 'Amoonguss', 'Umbreon', 'Cresselia', 'Hatterene', 'Clefable', 'Suicune',
	'Ferrothorn', 'Registeel', 'Hydrapple', 'Avalugg', 'Weezing', 'Moltres', 'Toedscruel', 'Florges', 'Mew',
].map(s => s.toLowerCase()));
// Moltres/Mew/Florges/Clefable count only when they are defensive; at 4-of-6 that is good enough.
const RECOVERY = new Set(['Recover', 'Soft-Boiled', 'Roost', 'Slack Off', 'Synthesis', 'Strength Sap', 'Wish', 'Rest',
	'Pain Split', 'Shore Up', 'Moonlight', 'Milk Drink', 'Morning Sun', 'Heal Order', 'Lunar Blessing']);
const STATUS_MOVES = new Set(['Toxic', 'Will-O-Wisp', 'Thunder Wave', 'Glare', 'Spore', 'Sleep Powder', 'Yawn',
	'Stun Spore', 'Poison Powder', 'Hypnosis', 'Toxic Thread', 'Nuzzle']);
const STATUS_OF = { 'Toxic': 'tox', 'Will-O-Wisp': 'brn', 'Thunder Wave': 'par', 'Glare': 'par', 'Spore': 'slp',
	'Sleep Powder': 'slp', 'Yawn': 'slp', 'Stun Spore': 'par', 'Poison Powder': 'psn', 'Hypnosis': 'slp',
	'Toxic Thread': 'psn', 'Nuzzle': 'par' };
const HAZARDS = ['Stealth Rock', 'Spikes', 'Toxic Spikes', 'Sticky Web'];
const REMOVAL = new Set(['Defog', 'Rapid Spin', 'Mortal Spin', 'Tidy Up', 'Court Change']);
const PHAZE = new Set(['Roar', 'Whirlwind', 'Dragon Tail', 'Circle Throw', 'Haze', 'Clear Smog', 'Perish Song', 'Encore']);
const PROTECT = new Set(['Protect', 'Detect', 'Baneful Bunker', 'Spiky Shield', "King's Shield", 'Silk Trap',
	'Burning Bulwark', 'Obstruct']);
const EFFECT = new Set(['-damage', '-heal', '-sethp', '-status', '-curestatus', '-cureteam', '-boost', '-unboost',
	'-setboost', '-clearboost', '-clearallboost', '-clearnegativeboost', '-sidestart', '-sideend', '-start', '-end',
	'-weather', '-fieldstart', '-fieldend', '-enditem', '-item', '-transform', 'drag', 'faint', '-swapboost',
	'-copyboost', '-invertboost', '-mega', '-formechange', 'detailschange']);

const spc = name => Dex.species.get(name);
const baseOf = name => { const s = spc(name); return (s.exists ? s.baseSpecies : name).toLowerCase(); };
function isStallTeam(mons) {
	return mons.filter(m => STALL_MONS.has(baseOf(m)) || STALL_MONS.has(m.toLowerCase())).length >= 4;
}
function roleOf(species) {
	const s = spc(species);
	if (!s.exists) return 'unknown';
	const { atk, spa, hp, def, spd } = s.baseStats;
	if (Math.max(atk, spa) < 90 && hp + def + spd > 300) return 'wall';
	if (atk > spa + 20) return 'physical';
	if (spa > atk + 20) return 'special';
	return 'mixed';
}
function statusImmune(status, species) {
	const s = spc(species);
	if (!s.exists) return false;
	const t = s.types;
	if ((status === 'tox' || status === 'psn') && (t.includes('Poison') || t.includes('Steel'))) return true;
	if (status === 'brn' && t.includes('Fire')) return true;
	if (status === 'par' && (t.includes('Electric'))) return true;
	return false;
}
const resists = (defSpecies, atkTypes) => {
	const s = spc(defSpecies);
	if (!s.exists) return false;
	return atkTypes.some(ty => !Dex.getImmunity(ty, s.types) || Dex.getEffectiveness(ty, s.types) < 0);
};
const hasUnaware = sp => Object.values(spc(sp).abilities || {}).includes('Unaware');

// ------------------------------------------------------------------ parsing
function parseHp(str) {
	if (!str) return null;
	const [hp, st] = str.split(' ');
	if (hp === '0') return { pct: 0, status: 'fnt' };
	const [a, b] = hp.split('/').map(Number);
	return { pct: b ? (a / b) * 100 : null, status: st || '' };
}
const sideOf = ident => ident.slice(0, 2);
const nameOf = ident => ident.replace(/^p\d[a-z]?: ?/, '');

/**
 * Walk one battle log. Returns per-side decision records and game facts.
 * A decision is the side's choice for a turn: a voluntary switch (before any move of the turn),
 * a move by its active, or `cant`. State is snapshotted at the start of each turn.
 */
function analyseGame(log) {
	const lines = log.split('\n').map(l => l.split('|'));
	const g = {
		players: {}, teams: { p1: [], p2: [] }, winner: null, tie: false, turns: 0,
		dec: { p1: [], p2: [] }, faints: { p1: [], p2: [] }, struggle: { p1: 0, p2: 0 },
		hazardSets: { p1: [], p2: [] }, removals: { p1: [], p2: [] }, moveUses: { p1: {}, p2: {} },
		hazardTurns: { p1: 0, p2: 0 },
	};
	const mons = { p1: new Map(), p2: new Map() }; // name -> {species, hp, status, moves:Set, item, maxHit}
	const active = { p1: null, p2: null };
	const boosts = { p1: {}, p2: {} };
	const hazards = { p1: {}, p2: {} }; // hazards ON this side
	const threat = { p1: new Map(), p2: new Map() }; // species of p -> biggest hit it did to the other side
	const koBy = { p1: new Set(), p2: new Set() };
	const enteredTurn = { p1: 0, p2: 0 };
	const lastWish = { p1: -5, p2: -5 };
	let turn = 0, movedThisTurn = false, snap = null, lastMover = null, curDec = null, afterUpkeep = false;
	const mon = (side, ident) => {
		const n = nameOf(ident);
		if (!mons[side].has(n)) mons[side].set(n, { name: n, species: n, hp: 100, status: '', moves: new Set(), items: new Set() });
		return mons[side].get(n);
	};
	const takeSnap = () => {
		const s = {};
		for (const side of ['p1', 'p2']) {
			const a = active[side];
			s[side] = a ? {
				species: a.species, hp: a.hp, status: a.status, boost: Object.values(boosts[side]).reduce((x, y) => x + Math.max(0, y), 0),
				bench: [...mons[side].values()].filter(m => m !== a && m.hp > 0).length + (6 - mons[side].size),
				entered: enteredTurn[side], layers: Object.values(hazards[side]).reduce((x, y) => x + y, 0),
				items: [...a.items], moves: [...a.moves],
			} : null;
		}
		return s;
	};
	for (let i = 0; i < lines.length; i++) {
		const l = lines[i];
		const cmd = l[1];
		if (cmd === 'player' && l[3]) g.players[l[2]] = l[3];
		else if (cmd === 'poke') g.teams[l[2]].push(l[3].split(',')[0]);
		else if (cmd === 'turn') {
			turn = +l[2]; g.turns = turn; movedThisTurn = false; afterUpkeep = false; snap = takeSnap();
			for (const side of ['p1', 'p2']) if (Object.keys(hazards[side]).length) g.hazardTurns[side]++;
		} else if (cmd === 'upkeep') afterUpkeep = true;
		else if (cmd === 'switch' || cmd === 'drag' || cmd === 'replace') {
			const side = sideOf(l[2]);
			const m = mon(side, l[2]);
			m.species = l[3].split(',')[0];
			const h = parseHp(l[4]);
			if (h) { m.hp = h.pct; m.status = h.status; }
			const prev = active[side];
			active[side] = m; boosts[side] = {}; enteredTurn[side] = turn;
			if (cmd === 'switch' && turn > 0 && !movedThisTurn && !afterUpkeep && snap && !g.dec[side].some(d => d.turn === turn)) {
				const foe = side === 'p1' ? 'p2' : 'p1';
				curDec = { turn, kind: 'switch', from: prev && prev.species, fromHp: snap[side] && snap[side].hp, to: m.species, s: snap, side, foe };
				g.dec[side].push(curDec);
			}
		} else if (cmd === 'detailschange' || cmd === '-formechange') {
			const side = sideOf(l[2]);
			mon(side, l[2]).species = l[3].split(',')[0];
		} else if (cmd === 'move') {
			const side = sideOf(l[2]);
			const m = mon(side, l[2]);
			const move = l[3];
			const from = l.slice(5).find(x => x && x.startsWith('[from]'));
			if (from) { lastMover = null; continue; } // called, bounced or Pursuit-on-switch moves are not choices
			if (!afterUpkeep) movedThisTurn = true;
			m.moves.add(move);
			g.moveUses[side][`${m.species}|${move}`] = (g.moveUses[side][`${m.species}|${move}`] || 0) + 1;
			if (move === 'Struggle') g.struggle[side]++;
			if (move === 'Wish') lastWish[side] = turn;
			lastMover = side;
			if (turn > 0 && snap && !g.dec[side].some(d => d.turn === turn)) {
				const foe = side === 'p1' ? 'p2' : 'p1';
				// Effect detection: scan until the next action line.
				let effect = false, fail = false, blocked = false, healed = 0, statused = null, bounced = false;
				const foeName = active[foe] && active[foe].name;
				for (let j = i + 1; j < lines.length; j++) {
					const c = lines[j][1];
					if (c === 'move' || c === 'switch' || c === 'turn' || c === 'upkeep' || c === 'cant') {
						if (c === 'move' && (lines[j].slice(5).some(x => x && x.includes('Magic Bounce')))) bounced = true;
						break;
					}
					if (c === '-fail' || c === '-immune' || c === '-miss' || c === '-notarget') fail = true;
					if (c === '-activate' && lines[j][3] && /Protect|Detect|Bunker|Shield|Silk Trap|Bulwark|Obstruct/.test(lines[j][3]) && sideOf(lines[j][2]) === foe) blocked = true;
					if (c === '-heal' && sideOf(lines[j][2]) === side && !(lines[j][4] || '').startsWith('[from] item')) {
						const h = parseHp(lines[j][3]);
						if (h && h.pct != null) healed = h.pct - m.hp;
					}
					if (c === '-status' && sideOf(lines[j][2]) === foe) statused = lines[j][3];
					if (EFFECT.has(c)) effect = true;
				}
				const s = snap;
				curDec = {
					turn, kind: 'move', move, species: m.species, hp: s[side] ? s[side].hp : m.hp, s, side, foe,
					effect: effect && !blocked, fail, blocked, healed, statused, bounced, foeName,
					wishPending: lastWish[side] === turn - 1,
					foeThreat: (threat[foe].get(s[foe] && s[foe].species) || 0),
					foeKOd: s[foe] ? koBy[foe].has(s[foe].species) : false,
				};
				g.dec[side].push(curDec);
			}
		} else if (cmd === 'cant') {
			const side = sideOf(l[2]);
			if (turn > 0 && snap && !g.dec[side].some(d => d.turn === turn)) g.dec[side].push({ turn, kind: 'cant', why: l[3], s: snap, side });
		} else if (cmd === '-damage' || cmd === '-heal' || cmd === '-sethp') {
			const side = sideOf(l[2]);
			const m = mon(side, l[2]);
			const h = parseHp(l[3]);
			const src = l[4] || '';
			if (h && h.pct != null) {
				if (cmd === '-damage' && !src.startsWith('[from]') && lastMover && lastMover !== side && active[lastMover]) {
					const hit = m.hp - h.pct;
					const sp = active[lastMover].species;
					if (hit > (threat[lastMover].get(sp) || 0)) threat[lastMover].set(sp, hit);
				}
				m.hp = h.pct; if (h.status !== undefined) m.status = h.status === 'fnt' ? m.status : h.status;
			}
			const it = /\[from\] item: (.+)/.exec(src);
			if (it) m.items.add(it[1]);
			if (/Poison Heal/.test(src)) m.items.add('Poison Heal');
		} else if (cmd === '-status') { mon(sideOf(l[2]), l[2]).status = l[3]; }
		else if (cmd === '-curestatus') { mon(sideOf(l[2]), l[2]).status = ''; }
		else if (cmd === '-cureteam') { for (const m of mons[sideOf(l[2])].values()) m.status = ''; }
		else if (cmd === '-boost' || cmd === '-unboost') {
			const side = sideOf(l[2]);
			boosts[side][l[3]] = (boosts[side][l[3]] || 0) + (cmd === '-boost' ? 1 : -1) * (+l[4] || 0);
		} else if (cmd === '-setboost') { boosts[sideOf(l[2])][l[3]] = +l[4]; }
		else if (cmd === '-clearallboost') { boosts.p1 = {}; boosts.p2 = {}; }
		else if (cmd === '-clearboost') { boosts[sideOf(l[2])] = {}; }
		else if (cmd === '-clearnegativeboost') { for (const k in boosts[sideOf(l[2])]) boosts[sideOf(l[2])][k] = Math.max(0, boosts[sideOf(l[2])][k]); }
		else if (cmd === '-item' || cmd === '-enditem') { mon(sideOf(l[2]), l[2]).items.add(l[3]); }
		else if (cmd === '-sidestart') {
			const side = l[2].slice(0, 2);
			const hz = l[3].replace('move: ', '');
			if (HAZARDS.includes(hz)) {
				hazards[side][hz] = (hazards[side][hz] || 0) + 1;
				const setter = side === 'p1' ? 'p2' : 'p1';
				g.hazardSets[setter].push({ turn, hz, layer: hazards[side][hz] });
			}
		} else if (cmd === '-sideend') {
			const side = l[2].slice(0, 2);
			const hz = l[3].replace('move: ', '');
			if (HAZARDS.includes(hz)) {
				const layers = hazards[side][hz] || 0;
				delete hazards[side][hz];
				const by = /\[from\] move: (.+)/.exec(l[4] || '');
				if (by) {
					const remover = sideOf(l[5] ? l[5].replace('[of] ', '') : '') || null;
					g.removals.p1.push; // keep shape
					(remover === 'p1' || remover === 'p2' ? g.removals[remover] : (g.removals._ = g.removals._ || [])).push({ turn, hz, layers, move: by[1], ownSide: remover === side });
				}
			}
		} else if (cmd === 'faint') {
			const side = sideOf(l[2]);
			const m = mon(side, l[2]);
			m.hp = 0;
			const foe = side === 'p1' ? 'p2' : 'p1';
			if (active[foe] && lastMover === foe) koBy[foe].add(active[foe].species);
			// Indirect: the killing blow came with a [from] (poison, burn, hazards, Rocky Helmet, recoil, Life Orb).
			let indirect = false;
			for (let j = i - 1; j > 0 && j > i - 6; j--) {
				if (lines[j][1] === '-damage' && nameOf(lines[j][2] || '') === m.name) { indirect = !!(lines[j][4] || '').startsWith('[from]'); break; }
			}
			g.faints[side].push({ turn, species: m.species, snap, dec: g.dec[side].find(d => d.turn === turn), afterUpkeep, indirect });
		} else if (cmd === 'win') g.winner = l[2];
		else if (cmd === 'tie') g.tie = true;
	}
	// Removals by Rapid Spin/Mortal Spin come without [of]; attribute to the side they cleared.
	for (const r of g.removals._ || []) {
		// Spin clears the user's own side; `-sideend` names that side.
		r.ownSide = true;
	}
	g.mons = mons;
	return g;
}

// ------------------------------------------------------------------ metrics
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(0)}%` : 'n/a');
const pct1 = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : 'n/a');
const median = arr => { if (!arr.length) return NaN; const a = [...arr].sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
const quart = arr => { if (!arr.length) return 'n/a'; const a = [...arr].sort((x, y) => x - y); const q = f => a[Math.floor(f * (a.length - 1))]; return `${q(0.25).toFixed(0)} / ${q(0.5).toFixed(0)} / ${q(0.75).toFixed(0)}`; };
const mean = arr => (arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : NaN);
const f0 = x => (Number.isFinite(x) ? x.toFixed(0) : 'n/a');
const f1 = x => (Number.isFinite(x) ? x.toFixed(1) : 'n/a');

function bucket(hp) { return hp >= 90 ? '90-100' : hp >= 75 ? '75-89' : hp >= 60 ? '60-74' : hp >= 45 ? '45-59' : hp >= 30 ? '30-44' : '<30'; }
const BUCKETS = ['90-100', '75-89', '60-74', '45-59', '30-44', '<30'];

function measure(samples) {
	// samples: [{g, side, name}]
	const M = { games: samples.length, wins: 0, losses: 0, ties: 0, turns: [], dec: 0, switches: 0, moves: 0, cant: 0 };
	const rec = { all: [], threat: [], calm: [], byMove: {}, wishPass: 0, wish: 0, atFull: 0, wishHp: [], maxRecUses: [] };
	const lowHp = { total: 0, heal: 0, sw: 0, other: 0, otherMoves: {} }; // hp<=50 decisions where a recovery move is known
	const swOutHp = [];
	const status = { uses: 0, byStatus: {}, byRole: {}, intoStatused: 0, intoImmune: 0, landed: 0, failed: 0, bounced: 0, burnPhys: 0, burnAll: 0, toxSpecial: 0, toxAll: 0 };
	const hz = { firstSR: [], firstSpikes: [], maxSpikes: [], maxTS: [], gamesSR: 0, gamesSpikes: 0, gamesTS: 0, removals: 0, removalTurn: [], removalLayers: [], hazardTurnShare: [] };
	const sw = { resist: 0, total: 0, pairs: {}, unawareVsBoost: 0, boostSwitch: 0 };
	const boost = { turns: 0, phaze: 0, switch: 0, unaware: 0, attack: 0, status: 0, recover: 0, other: 0, bigTurns: 0, bigAnswered: 0 };
	const prot = { uses: 0, double: 0, wish: 0, scout: 0, residual: 0, block: 0, other: 0 };
	const nothing = { total: 0, protect: 0, failed: 0, healFull: 0, blocked: 0, longGame: 0, longGameDec: 0, recPPsave: 0 };
	const pp = { struggleGames: 0, foeStruggle: 0, ownStruggle: 0, exhausted: 0 };
	const sack = { faints: 0, voluntary: 0, overwhelmed: 0, onEntry: 0, residual: 0, lastMon: 0, other: 0, volMoves: {}, volHp: [], why: {}, firstFaintTurn: [], preserveLow: 0, lowStay: 0 };
	const phase = { early: {}, mid: {}, late: {}, close: {} };
	const lateClose = { games: 0, won: 0, finalKOsAttack: 0, finalKOsResidual: 0, foeFaintsLate: 0 };
	let closing = null; // won games over 50 turns: the last 20 turns are the close-out
	const addPhase = (t, k) => {
		const p = t <= 20 ? 'early' : t <= 50 ? 'mid' : 'late'; phase[p][k] = (phase[p][k] || 0) + 1; phase[p]._ = (phase[p]._ || 0) + 1;
		if (closing && t > closing) { phase.close[k] = (phase.close[k] || 0) + 1; phase.close._ = (phase.close._ || 0) + 1; }
	};
	for (const { g, side, name } of samples) {
		const foe = side === 'p1' ? 'p2' : 'p1';
		if (g.tie) M.ties++; else if (g.winner === name) M.wins++; else M.losses++;
		M.turns.push(g.turns);
		closing = g.winner === name && g.turns > 50 ? g.turns - 20 : null;
		const decs = g.dec[side];
		let prevProtect = -5;
		for (const d of decs) {
			M.dec++;
			const s = d.s[side], fs = d.s[foe];
			if (d.kind === 'cant') { M.cant++; continue; }
			const knownMoves = s ? s.moves : [];
			const recKnown = knownMoves.some(m => RECOVERY.has(m) && m !== 'Wish' && m !== 'Pain Split');
			const threatNow = fs && (fs.boost > 0 || d.foeThreat >= 40 || (g.dec[side] && d.foeKOd));
			if (g.turns > 100 && d.turn > 50) nothing.longGameDec++;
			if (d.kind === 'switch') {
				M.switches++; addPhase(d.turn, 'switch');
				if (d.fromHp != null) swOutHp.push(d.fromHp);
				if (s && s.hp <= 50 && recKnown) { lowHp.total++; lowHp.sw++; }
				if (fs) {
					const atkTypes = spc(fs.species).exists ? spc(fs.species).types : [];
					sw.total++; if (resists(d.to, atkTypes)) sw.resist++;
					const k = `${fs.species} -> ${d.to}`; sw.pairs[k] = (sw.pairs[k] || 0) + 1;
					if (fs.boost > 0) { sw.boostSwitch++; if (hasUnaware(d.to)) sw.unawareVsBoost++; }
				}
				if (fs && fs.boost > 0) { boost.turns++; if (hasUnaware(d.to)) boost.unaware++; else boost.switch++; if (fs.boost >= 2) { boost.bigTurns++; boost.bigAnswered++; } }
				continue;
			}
			M.moves++;
			const mv = d.move;
			const dm = Dex.moves.get(mv);
			const cat = RECOVERY.has(mv) ? 'recover' : PROTECT.has(mv) ? 'protect' : STATUS_MOVES.has(mv) ? 'status'
				: HAZARDS.includes(mv) ? 'hazard' : REMOVAL.has(mv) ? 'removal' : PHAZE.has(mv) ? 'phaze'
					: dm.exists && dm.category !== 'Status' ? 'attack' : 'other';
			addPhase(d.turn, cat);
			if (s && s.hp <= 50 && recKnown) {
				lowHp.total++;
				if (cat === 'recover') lowHp.heal++; else { lowHp.other++; lowHp.otherMoves[cat] = (lowHp.otherMoves[cat] || 0) + 1; }
			}
			if (cat === 'recover') {
				if (mv === 'Wish') {
					rec.wish++; if (d.hp != null) rec.wishHp.push(d.hp);
					const next = decs.find(x => x.turn === d.turn + 1);
					if (next && next.kind === 'switch') rec.wishPass++;
				}
				if (d.hp != null && mv !== 'Wish') {
					rec.all.push(d.hp); (threatNow ? rec.threat : rec.calm).push(d.hp);
					(rec.byMove[mv] = rec.byMove[mv] || []).push(d.hp);
					if (d.hp >= 95 && mv !== 'Wish') rec.atFull++;
				}
			}
			if (cat === 'status') {
				status.uses++;
				const st = STATUS_OF[mv];
				status.byStatus[st] = (status.byStatus[st] || 0) + 1;
				if (fs) {
					const role = roleOf(fs.species);
					status.byRole[`${st}:${role}`] = (status.byRole[`${st}:${role}`] || 0) + 1;
					if (fs.status && fs.status !== 'fnt') status.intoStatused++;
					else if (statusImmune(st, fs.species)) status.intoImmune++;
					if (st === 'brn') { status.burnAll++; if (role === 'physical') status.burnPhys++; }
					if (st === 'tox') { status.toxAll++; if (role === 'special' || role === 'wall') status.toxSpecial++; }
				}
				if (d.statused) status.landed++; else if (d.fail) status.failed++;
				if (d.bounced) status.bounced++;
			}
			if (cat === 'removal') { hz.removals++; hz.removalTurn.push(d.turn); if (s) hz.removalLayers.push(s.layers); }
			if (fs && fs.boost > 0) {
				boost.turns++;
				if (cat === 'phaze') boost.phaze++; else if (cat === 'attack') boost.attack++; else if (cat === 'status') boost.status++;
				else if (cat === 'recover') boost.recover++; else boost.other++;
				if (fs.boost >= 2) { boost.bigTurns++; if (cat === 'phaze') boost.bigAnswered++; }
			}
			if (cat === 'protect') {
				prot.uses++;
				if (prevProtect === d.turn - 1) prot.double++;
				prevProtect = d.turn;
				if (d.wishPending) prot.wish++;
				else if (fs && fs.entered >= d.turn - 1) prot.scout++;
				else if ((fs && ['tox', 'psn', 'brn'].includes(fs.status)) || (s && s.items.some(x => /Leftovers|Black Sludge|Poison Heal/.test(x)))) prot.residual++;
				else prot.other++;
				nothing.protect++;
			}
			// "Nothing" turns: the move changed nothing on the board.
			const isNothing = cat === 'protect' || (!d.effect && cat !== 'attack') || (cat === 'attack' && !d.effect) ||
				(cat === 'recover' && mv !== 'Wish' && d.hp >= 97);
			if (isNothing) {
				nothing.total++;
				if (cat !== 'protect') { if (d.blocked) nothing.blocked++; else if (cat === 'recover') nothing.healFull++; else nothing.failed++; }
				if (g.turns > 100 && d.turn > 50) nothing.longGame++;
			}
		}
		// hazards
		const sets = g.hazardSets[side];
		const first = h => { const x = sets.find(e => e.hz === h); return x ? x.turn : null; };
		if (first('Stealth Rock') != null) { hz.gamesSR++; hz.firstSR.push(first('Stealth Rock')); }
		if (first('Spikes') != null) { hz.gamesSpikes++; hz.firstSpikes.push(first('Spikes')); hz.maxSpikes.push(Math.max(...sets.filter(e => e.hz === 'Spikes').map(e => e.layer))); }
		if (first('Toxic Spikes') != null) { hz.gamesTS++; hz.maxTS.push(Math.max(...sets.filter(e => e.hz === 'Toxic Spikes').map(e => e.layer))); }
		hz.hazardTurnShare.push(g.turns ? g.hazardTurns[side] / g.turns : 0);
		// Recovery PP pressure: the most any one mon used one recovery move in the game.
		rec.maxRecUses.push(Math.max(0, ...Object.entries(g.moveUses[side]).filter(([k]) => RECOVERY.has(k.split('|')[1]) && !/Wish|Pain Split/.test(k)).map(([, n]) => n)));
		// PP
		if (g.struggle.p1 + g.struggle.p2) pp.struggleGames++;
		if (g.struggle[foe]) pp.foeStruggle++;
		if (g.struggle[side]) pp.ownStruggle++;
		// Foe spent a move's whole max PP (x8/5), not counting Pressure: a lower bound on PP stalling.
		for (const [k, n] of Object.entries(g.moveUses[foe])) {
			const mvName = k.split('|')[1];
			const m = Dex.moves.get(mvName);
			if (m.exists && m.pp && !m.isZ && !m.isMax && mvName !== 'Struggle' && n >= Math.floor(m.pp * 8 / 5)) { pp.exhausted++; break; }
		}
		// sacking / faints
		const fl = g.faints[side];
		if (fl.length) sack.firstFaintTurn.push(fl[0].turn);
		for (const f of fl) {
			sack.faints++;
			const st = f.snap && f.snap[side];
			const d = f.dec;
			const wasActive = st && st.species === f.species;
			if (!wasActive || (d && d.kind === 'switch' && d.to === f.species)) { sack.onEntry++; continue; }
			if (st.bench === 0) { sack.lastMon++; continue; }
			if (f.indirect) { sack.residual++; continue; }
			if (d && d.kind === 'cant') { sack.other++; continue; }
			if (st.hp >= 70) { sack.overwhelmed++; continue; }
			// It stayed in (no switch) below 70% with a teammate to go to, and died to a direct hit.
			if (!d || (d.kind === 'move' && !RECOVERY.has(d.move) && !PROTECT.has(d.move))) {
				sack.voluntary++; sack.volHp.push(st.hp);
				// Why it may have been deliberate: the foe was boosted (sack for a safe switch-in to a sweeper),
				// or the mon was nearly spent anyway.
				const why = f.snap[foe] && f.snap[foe].boost > 0 ? 'foe boosted' : st.hp <= 25 ? 'at 25% or less' : 'healthy (26-69%), foe not boosted';
				sack.why[why] = (sack.why[why] || 0) + 1;
				let c = 'KOd before moving';
				if (d) {
					const dm = Dex.moves.get(d.move);
					c = STATUS_MOVES.has(d.move) ? 'status' : HAZARDS.includes(d.move) ? 'hazard' : REMOVAL.has(d.move) ? 'removal' : PHAZE.has(d.move) ? 'phaze' : dm.category !== 'Status' ? 'attack' : 'other';
				}
				sack.volMoves[c] = (sack.volMoves[c] || 0) + 1;
			} else sack.healedAndDied = (sack.healedAndDied || 0) + 1;
		}
		// low-HP preservation: decisions at <=35% HP with a bench: switched or healed vs stayed and did something else
		for (const d of decs) {
			const s = d.s[side];
			if (!s || s.hp > 35 || s.hp <= 0 || s.bench === 0 || d.kind === 'cant') continue;
			if (d.kind === 'switch' || RECOVERY.has(d.move) || PROTECT.has(d.move)) sack.preserveLow++; else sack.lowStay++;
		}
		// late game conversion
		if (g.turns > 50) {
			lateClose.games++;
			if (g.winner === name) lateClose.won++;
			const ff = g.faints[foe].filter(f => f.turn > 50);
			lateClose.foeFaintsLate += ff.length;
			for (const f of ff) { if (f.indirect) lateClose.finalKOsResidual++; else lateClose.finalKOsAttack++; }
		}
	}
	return { M, rec, lowHp, swOutHp, status, hz, sw, boost, prot, nothing, pp, sack, phase, lateClose };
}

// ------------------------------------------------------------------ loading
function loadHumans() {
	const out = [];
	const meta = { replays: 0, ratings: [], postBan: 0, stallGames: new Set(), players: new Set() };
	if (!fs.existsSync(RAW)) return { out, meta };
	for (const f of fs.readdirSync(RAW).filter(x => x.startsWith('r-'))) {
		let r;
		try { r = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8')); } catch { continue; }
		if (!r.log) continue;
		meta.replays++;
		const g = analyseGame(r.log);
		for (const side of ['p1', 'p2']) {
			if (!isStallTeam(g.teams[side])) continue;
			out.push({ g, side, name: g.players[side], rating: r.rating, id: r.id, upload: r.uploadtime });
			meta.stallGames.add(r.id); if (g.teams[side].filter(m => STALL_MONS.has(baseOf(m))).length >= 5) meta.strict = (meta.strict || 0) + 1; meta.players.add(g.players[side]);
			if (r.rating) meta.ratings.push(r.rating);
			if (r.uploadtime >= TERA_BAN) meta.postBan++;
		}
	}
	return { out, meta };
}
function loadBot(round) {
	const dir = path.join(ROOT, 'data', 'stall-study', `round-${round}`, 'logs');
	const out = [];
	if (!fs.existsSync(dir)) return out;
	for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json'))) {
		const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
		const g = analyseGame(r.log);
		const side = g.players.p1 === 'Stall' ? 'p1' : 'p2';
		out.push({ g, side, name: 'Stall', id: r.id });
	}
	return out;
}

// ------------------------------------------------------------------ report
function report() {
	const round = arg('round', '0');
	const { out: humans, meta } = loadHumans();
	const bot = loadBot(round);
	const H = measure(humans), B = measure(bot);
	const rows = [];
	const row = (label, h, b) => rows.push(`| ${label} | ${h} | ${b} |`);
	const both = fn => [fn(H), fn(B)];
	const winLine = x => `${pct(x.M.wins, x.M.games)} W / ${pct(x.M.ties, x.M.games)} D / ${pct(x.M.losses, x.M.games)} L`;
	row('Stall sides (games)', H.M.games, B.M.games);
	row('Win / draw / loss', ...both(winLine));
	row('Game length, turns (p25 / median / p75)', ...both(x => quart(x.M.turns)));
	row('Games over 100 turns', ...both(x => pct(x.M.turns.filter(t => t > 100).length, x.M.games)));
	row('Voluntary switch rate (per decision)', ...both(x => pct(x.M.switches, x.M.dec)));
	row('Recovery HP% at use (p25 / median / p75)', ...both(x => `${quart(x.rec.all)} (n=${x.rec.all.length})`));
	row('  ...vs a threat (boosted, or hit us for 40%+)', ...both(x => `${quart(x.rec.threat)} (n=${x.rec.threat.length})`));
	row('  ...vs no threat', ...both(x => `${quart(x.rec.calm)} (n=${x.rec.calm.length})`));
	row('Recovery used at 95%+ HP (share of heals)', ...both(x => pct(x.rec.atFull, x.rec.all.length)));
	row('At <=50% HP with recovery known: heal / switch / other', ...both(x => `${pct(x.lowHp.heal, x.lowHp.total)} / ${pct(x.lowHp.sw, x.lowHp.total)} / ${pct(x.lowHp.other, x.lowHp.total)} (n=${x.lowHp.total})`));
	row('HP% when switching out (p25 / median / p75)', ...both(x => `${quart(x.swOutHp)} (n=${x.swOutHp.length})`));
	row('Wish user HP% (p25 / median / p75)', ...both(x => quart(x.rec.wishHp)));
	row('Most uses of one recovery move by one mon (p25 / median / p75)', ...both(x => quart(x.rec.maxRecUses)));
	row('Wish passed (Wish then switch next turn)', ...both(x => `${pct(x.rec.wishPass, x.rec.wish)} of ${x.rec.wish}`));
	row('Status moves, share of move turns', ...both(x => pct(x.status.uses, x.M.moves)));
	row('Status into an already-statused foe', ...both(x => pct(x.status.intoStatused, x.status.uses)));
	row('Status into a type-immune foe', ...both(x => pct(x.status.intoImmune, x.status.uses)));
	row('Status that landed', ...both(x => pct(x.status.landed, x.status.uses)));
	row('Status bounced by Magic Bounce', ...both(x => pct(x.status.bounced, x.status.uses)));
	row('Burns aimed at physical attackers', ...both(x => `${pct(x.status.burnPhys, x.status.burnAll)} of ${x.status.burnAll}`));
	row('Games with SR set / first SR turn (median)', ...both(x => `${pct(x.hz.gamesSR, x.M.games)} / ${f0(median(x.hz.firstSR))}`));
	row('Games with Spikes / first turn / mean max layers', ...both(x => `${pct(x.hz.gamesSpikes, x.M.games)} / ${f0(median(x.hz.firstSpikes))} / ${f1(mean(x.hz.maxSpikes))}`));
	row('Games with Toxic Spikes / mean max layers', ...both(x => `${pct(x.hz.gamesTS, x.M.games)} / ${f1(mean(x.hz.maxTS))}`));
	row('Removal uses per game / median turn', ...both(x => `${f1(x.hz.removals / x.M.games)} / ${f0(median(x.hz.removalTurn))}`));
	row('Layers on own side when removing (mean)', ...both(x => f1(mean(x.hz.removalLayers))));
	row('Share of turns with hazards on own side', ...both(x => `${f0(100 * mean(x.hz.hazardTurnShare))}%`));
	row('Switch-ins that resist a foe STAB', ...both(x => pct(x.sw.resist, x.sw.total)));
	row('Foe boosted: phaze-or-Haze / Unaware in / other switch / attack / heal / status / other', ...both(x => `${pct(x.boost.phaze, x.boost.turns)} / ${pct(x.boost.unaware, x.boost.turns)} / ${pct(x.boost.switch, x.boost.turns)} / ${pct(x.boost.attack, x.boost.turns)} / ${pct(x.boost.recover, x.boost.turns)} / ${pct(x.boost.status, x.boost.turns)} / ${pct(x.boost.other, x.boost.turns)} (n=${x.boost.turns})`));
	row('Protect, share of move turns', ...both(x => pct1(x.prot.uses, x.M.moves)));
	row('Double Protect (share of Protects)', ...both(x => pct(x.prot.double, x.prot.uses)));
	row('Protect purpose: Wish / scout / residual / other', ...both(x => `${pct(x.prot.wish, x.prot.uses)} / ${pct(x.prot.scout, x.prot.uses)} / ${pct(x.prot.residual, x.prot.uses)} / ${pct(x.prot.other, x.prot.uses)}`));
	row('"Nothing" turns, share of decisions', ...both(x => pct1(x.nothing.total, x.M.dec)));
	row('  ...of which Protect / failed-immune-missed / blocked / heal at full', ...both(x => `${pct(x.nothing.protect, x.nothing.total)} / ${pct(x.nothing.failed, x.nothing.total)} / ${pct(x.nothing.blocked, x.nothing.total)} / ${pct(x.nothing.healFull, x.nothing.total)}`));
	row('  ...nothing rate after turn 50 in 100+ turn games', ...both(x => `${pct1(x.nothing.longGame, x.nothing.longGameDec)} (n=${x.nothing.longGameDec})`));
	row('Games with Struggle (foe / own)', ...both(x => `${pct(x.pp.foeStruggle, x.M.games)} / ${pct(x.pp.ownStruggle, x.M.games)}`));
	row('Games where the foe used up a move\'s full PP', ...both(x => pct(x.pp.exhausted, x.M.games)));
	row('Own faints per game', ...both(x => f1(x.sack.faints / x.M.games)));
	row('First own faint, turn (median)', ...both(x => f0(median(x.sack.firstFaintTurn))));
	row('Faints: sack (stayed in below 70%, bench left, direct KO) / from 70%+ / on entry / indirect (status, hazards, recoil) / last mon / healed-or-Protected and died / other', ...both(x => `${x.sack.voluntary} / ${x.sack.overwhelmed} / ${x.sack.onEntry} / ${x.sack.residual} / ${x.sack.lastMon} / ${x.sack.healedAndDied || 0} / ${x.sack.other}`));
	row('Voluntary sacks per game', ...both(x => f1(x.sack.voluntary / x.M.games)));
	row('At <=35% HP with a bench: preserve (switch/heal/Protect) vs stay', ...both(x => `${pct(x.sack.preserveLow, x.sack.preserveLow + x.sack.lowStay)} vs ${pct(x.sack.lowStay, x.sack.preserveLow + x.sack.lowStay)} (n=${x.sack.preserveLow + x.sack.lowStay})`));
	for (const p of ['early', 'mid', 'late', 'close']) {
		row(`Turn mix ${p === 'early' ? '1-20' : p === 'mid' ? '21-50' : p === 'late' ? '51+' : 'last 20 turns of wins over 50 turns'}: attack / status / heal / hazard / switch / Protect`, ...both(x => {
			const q = x.phase[p], t = q._ || 0;
			return `${pct(q.attack || 0, t)} / ${pct(q.status || 0, t)} / ${pct(q.recover || 0, t)} / ${pct(q.hazard || 0, t)} / ${pct(q.switch || 0, t)} / ${pct(q.protect || 0, t)}`;
		}));
	}
	row('Games past turn 50: count / stall won', ...both(x => `${x.lateClose.games} / ${pct(x.lateClose.won, x.lateClose.games)}`));
	row('Foe KOs after turn 50: direct hit / indirect (status, hazards, recoil)', ...both(x => `${x.lateClose.finalKOsAttack} / ${x.lateClose.finalKOsResidual}`));

	const topPairs = x => Object.entries(x.sw.pairs).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${k} (${n})`).join(', ');
	const byMove = x => Object.entries(x.rec.byMove).sort((a, b) => b[1].length - a[1].length).map(([m, a]) => `${m} ${f0(median(a))}% (n=${a.length})`).join(', ');
	const roles = x => Object.entries(x.status.byRole).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ');
	const recBuckets = x => BUCKETS.map(b => `${b}: ${x.rec.all.filter(h => bucket(h) === b).length}`).join(', ');
	const volMoves = x => Object.entries(x.sack.volMoves).map(([k, n]) => `${k} ${n}`).join(', ');
	const ratings = meta.ratings;
	const summary = {
		replays: meta.replays, stallSides: humans.length, stallGames: meta.stallGames.size, players: meta.players.size,
		ratingMin: Math.min(...ratings), ratingMax: Math.max(...ratings), ratingMedian: median(ratings), postBan: meta.postBan,
		botGames: bot.length, strict: meta.strict || 0,
	};
	const extras = { pairsH: topPairs(H), pairsB: topPairs(B), recByMoveH: byMove(H), recByMoveB: byMove(B),
		statusRolesH: roles(H), statusRolesB: roles(B), recBucketsH: recBuckets(H), recBucketsB: recBuckets(B),
		sackMovesH: volMoves(H), sackMovesB: volMoves(B), sackWhyH: JSON.stringify(H.sack.why), sackWhyB: JSON.stringify(B.sack.why), sackHpH: quart(H.sack.volHp), sackHpB: quart(B.sack.volHp),
		lowHpOtherH: JSON.stringify(H.lowHp.otherMoves), lowHpOtherB: JSON.stringify(B.lowHp.otherMoves) };
	const block = [
		`Generated by \`node scripts/stall-replays.js --write\` from ${summary.replays} replays: ${summary.stallSides} stall sides in ` +
		`${summary.stallGames} games by ${summary.players} players, ratings ${summary.ratingMin}-${summary.ratingMax} ` +
		`(median ${f0(summary.ratingMedian)}), ${summary.postBan} of them after the Tera ban, ${summary.strict} with 5+ walls; bot: ${summary.botGames} games (round ${round}).`,
		'',
		'| Metric | Humans (stall side) | Our bot (Stall) |', '|---|---|---|', ...rows, '',
		...Object.entries(extras).map(([k, v]) => `- **${k}**: ${v}`),
	].join('\n');
	console.log(block);
	if (!has('write')) return;
	const doc = path.join(ROOT, 'docs', 'stall-replay-study.md');
	const cur = fs.existsSync(doc) ? fs.readFileSync(doc, 'utf8') : '<!-- table:start -->\n<!-- table:end -->\n';
	fs.writeFileSync(doc, cur.replace(/<!-- table:start -->[\s\S]*<!-- table:end -->/, () => `<!-- table:start -->\n${block}\n<!-- table:end -->`));
	console.log('wrote docs/stall-replay-study.md');
}

module.exports = { analyseGame, measure, isStallTeam };
if (require.main === module) {
	if (has('fetch')) fetchAll().catch(e => { console.error(e); process.exit(1); });
	else report();
}
