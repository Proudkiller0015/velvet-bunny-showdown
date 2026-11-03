'use strict';
/**
 * Raids (owner, 3 Nov 2026): up to four trainers, one Pokemon each, against one
 * to three Lv. 200 legendaries that Dynamax for their first three turns.
 *
 * Showdown cannot seat four players on one side, so every raider fights the
 * bosses in a battle of their own, all at once, and the bosses' HP is shared:
 * whatever one raider takes off comes off in every battle (the format syncs it
 * each turn, config/custom-formats.js installSharedRaid). Seats nobody filled
 * go to NPC raiders, whose battles run here on the server with the AI on both
 * sides and keep pace with the people: an NPC plays a turn only once some
 * person has played that many.
 *
 * HP is kept as a fraction of each boss's max HP, so a boss Dynamaxed in one
 * battle and not yet in another still means the same thing everywhere.
 *
 * Everything here lives in the server's own process: battles run there too
 * (PS_SUBPROCESSES = 0, config/showdown-config.js), so the format reaches this
 * module directly. With battle subprocesses it would not, and raids would fall
 * back to separate HP per battle.
 */

const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

const MAX_RAIDERS = 4;
const TURN_LIMIT = 15;          // a raid not won by then blows everyone away
const CATCH_TURNS = 3;          // turns to throw once every boss is worn out
const KEEP_MS = 6 * 60 * 60 * 1000;
const IDLE_MS = Number(process.env.RAID_IDLE_MS || 10 * 60 * 1000);
const NPC_NAMES = ['Ace Trainer Mira', 'Ranger Tomas', 'Veteran Ines', 'Ace Trainer Kai', 'Ranger Yuki', 'Veteran Bram',
	'Ace Trainer Lena', 'Ranger Dario', 'Veteran Noor', 'Ace Trainer Sol', 'Ranger Ivo', 'Veteran Ada'];
// NPC raiders' Pokemon: sturdy, simple, and nothing that walls a raid boss on its own.
const NPC_POKEMON = ['Garchomp', 'Metagross', 'Tyranitar', 'Dragonite', 'Gyarados', 'Salamence', 'Snorlax', 'Lucario',
	'Gardevoir', 'Hydreigon', 'Volcarona', 'Kingambit', 'Baxcalibur', 'Dragapult', 'Excadrill', 'Togekiss'];
const NPC_LEVEL = 90;

const raids = new Map();        // raid id -> raid
const raiderOf = new Map();     // raider id (toID of their battle name) -> raid id

function sweep() {
	const now = Date.now();
	for (const [id, raid] of raids) {
		if (now - raid.createdAt < KEEP_MS) continue;
		for (const r of raid.raiders) if (raiderOf.get(r.id) === id) raiderOf.delete(r.id);
		raids.delete(id);
	}
}

/**
 * A new raid. `bosses`: [{ species, name }] in battle order. `raiders`: the
 * people, [{ name }] (their Showdown names); the rest of the four seats are NPCs
 * (`npcs: false` leaves them empty).
 */
function create({ id, bosses, raiders, npcs = true }) {
	sweep();
	const raid = {
		id,
		createdAt: Date.now(),
		bosses: bosses.map(b => ({ species: b.species, name: b.name || b.species, hp: 1, down: false, caughtBy: null })),
		raiders: [],
		status: 'on',        // on | won | failed
		log: [],
	};
	const taken = new Set([...raiderOf.keys()]);
	for (const r of raiders.slice(0, MAX_RAIDERS)) {
		raid.raiders.push({ id: toID(r.name), name: r.name, npc: false, pokemon: r.pokemon || '', state: 'fighting', turn: 0, dealt: 0 });
	}
	if (npcs) {
		const free = NPC_NAMES.filter(n => !taken.has(toID(n)) && !raid.raiders.some(r => r.id === toID(n)));
		while (raid.raiders.length < MAX_RAIDERS && free.length) {
			const name = free.splice(Math.floor(Math.random() * free.length), 1)[0];
			const pokemon = NPC_POKEMON[Math.floor(Math.random() * NPC_POKEMON.length)];
			raid.raiders.push({ id: toID(name), name, npc: true, pokemon, state: 'fighting', turn: 0, dealt: 0 });
		}
	}
	for (const r of raid.raiders) raiderOf.set(r.id, id);
	raids.set(id, raid);
	return raid;
}

const get = id => raids.get(id) || null;
/** The raid a battle belongs to, from the name its raider fights under. */
const forRaider = name => get(raiderOf.get(toID(name)));
const raiderIn = (raid, name) => (raid ? raid.raiders.find(r => r.id === toID(name)) || null : null);

/**
 * One battle's change to a boss: `delta` is the fraction of its HP it lost
 * there since that battle last reported (negative for healing). Returns the
 * boss's HP now, shared by every battle.
 */
function hit(raid, index, delta, who) {
	const boss = raid && raid.bosses[index];
	if (!boss) return 0;
	if (!boss.down && delta) {
		/*
		 * A duo or trio has two or three times the HP to get through, and one boss
		 * attacking a turn (the format) - so each hit counts that many times over,
		 * and a trio takes the work of one raid boss, not three.
		 */
		delta *= raid.bosses.length;
		boss.hp = Math.max(0, Math.min(1, boss.hp - delta));
		const r = raiderIn(raid, who);
		if (r && delta > 0) r.dealt += delta;
		if (boss.hp <= 0) {
			boss.down = true;
			raid.log.push(`${who} wore out ${boss.name}`);
		}
	}
	return boss.hp;
}

function allDown(raid) {
	return !!raid && raid.bosses.every(b => b.down);
}

/** A raider's turn played (their battle's end-of-turn). NPC raiders are let through to the same turn. */
function turnPlayed(raid, name, turn) {
	const r = raiderIn(raid, name);
	if (r && turn > r.turn) r.turn = turn;
	pump(raid);
}

/** A raider's battle is over: 'out' (their Pokemon fainted), 'caught', 'won' or 'left'. */
function finished(raid, name, state) {
	const r = raiderIn(raid, name);
	if (r && r.state === 'fighting') r.state = state;
	if (!raid) return;
	if (raid.status === 'on' && allDown(raid)) raid.status = 'won';
	if (raid.status === 'on' && raid.raiders.every(x => x.state !== 'fighting') && !allDown(raid)) raid.status = 'failed';
	pump(raid);
}

/** How many raiders are still in it: a boss's attention is split between them. */
const standing = raid => (raid ? raid.raiders.filter(r => r.state === 'fighting').length : 1);

// ------------------------------------------------------------------ NPC raiders

/*
 * An NPC's battle waits on its own request until a person has played at least
 * as many turns. With nobody left fighting, NPCs stop: the raid is over.
 */
const waiting = new Map();   // raider id -> () => void
function pump(raid) {
	if (!raid) return;
	const people = raid.raiders.filter(r => !r.npc);
	const furthest = Math.max(0, ...people.map(r => r.turn));
	const anyoneFighting = people.some(r => r.state === 'fighting');
	for (const r of raid.raiders) {
		if (!r.npc) continue;
		const go = waiting.get(r.id);
		if (!go) continue;
		if (!anyoneFighting || allDown(raid)) { waiting.delete(r.id); go(true); continue; }
		if (r.turn < furthest) { waiting.delete(r.id); go(false); }
	}
}

/**
 * Run one NPC raider's battle in this process: the AI on both sides, the boss
 * team the people fight, and the raid format, so the shared HP works the same.
 */
async function runNpc(raid, raider, { format, bossName, bossTeam, log = () => {} }) {
	const { BattleStream, getPlayerStreams } = require('pokemon-showdown/dist/sim/battle-stream');
	const { BattleAI } = require('./ai');
	const { BattleState } = require('./battle');
	const { Teams } = require('pokemon-showdown');
	const E = require('./encounters');
	const Dex = require('./rp-dex')();
	const species = Dex.species.get(raider.pokemon);
	const set = E.trainerSet(species, NPC_LEVEL, 8, Math.random);
	set.level = NPC_LEVEL;
	const stream = new BattleStream();
	const streams = getPlayerStreams(stream);
	const ai = { p1: new BattleAI({ difficulty: 'hard' }), p2: new BattleAI({ difficulty: 'hard' }) };
	ai.p1.setFormat(format); ai.p2.setFormat(format);
	void streams.omniscient.write(`>start ${JSON.stringify({ formatid: format })}\n` +
		`>player p1 ${JSON.stringify({ name: raider.name, team: Teams.pack([set]) })}\n` +
		`>player p2 ${JSON.stringify({ name: bossName, team: bossTeam })}\n`);
	const play = async who => {
		const state = new BattleState(`battle-${format}-npc`);
		state.myPlayer = who;
		for await (const chunk of streams[who]) {
			for (const line of chunk.split('\n')) {
				if (!line.startsWith('|')) continue;
				const parts = line.slice(1).split('|');
				if (parts[0] === 'error') { void streams[who].write('default'); continue; }
				if (parts[0] !== 'request') { state.line(parts); continue; }
				const raw = parts.slice(1).join('|');
				if (!raw) continue;
				const request = JSON.parse(raw);
				if (request.wait) continue;
				// The raider waits for the people; the boss answers at once.
				if (who === 'p1' && request.active) {
					// Nobody played for ten minutes (a battle that never opened, everyone gone): it stops.
					const stop = await new Promise(go => {
						const idle = setTimeout(() => { waiting.delete(raider.id); go(true); }, IDLE_MS);
						idle.unref?.();
						waiting.set(raider.id, s => { clearTimeout(idle); go(s); });
						pump(raid);
					});
					if (stop) { void streams.omniscient.write('>forcetie'); return; }
				}
				let choice = 'default';
				try { choice = ai[who].decide(request, state) || 'default'; } catch (e) { choice = 'default'; }
				void streams[who].write(choice);
			}
		}
	};
	try {
		await Promise.all([play('p1'), play('p2'), (async () => { for await (const chunk of streams.omniscient) void chunk; })()]);
	} catch (e) {
		log(`NPC raider ${raider.name}: ${e.message}`);
	}
	waiting.delete(raider.id);
	finished(raid, raider.name, 'out');
}

// ------------------------------------------------------------------ the board

const bar = hp => {
	const pct = Math.max(0, Math.round(hp * 100));
	const colour = pct > 50 ? '#3c3' : pct > 20 ? '#fc3' : '#e33';
	return `<span style="display:inline-block;width:120px;height:9px;border:1px solid #777;border-radius:4px;vertical-align:middle;background:#222">` +
		`<span style="display:block;width:${pct}%;height:100%;border-radius:3px;background:${colour}"></span></span> ${pct}%`;
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const STATE = { fighting: '⚔️', out: '💫 fainted', caught: '🎉 caught one', won: '🏆', left: '🚪 left' };

/** The raid at a glance, for every battle in it: each boss's shared HP and who is still in. */
function board(raid) {
	if (!raid) return '';
	const bosses = raid.bosses.map(b => `<div><b>${esc(b.name)}</b> ${b.down ? '<b style="color:#e33">worn out - throw a ball!</b>' : bar(b.hp)}` +
		`${b.caughtBy ? ` <small>(caught by ${esc(b.caughtBy)})</small>` : ''}</div>`).join('');
	const raiders = raid.raiders.map(r => `${esc(r.name)}${r.npc ? ' <small>(NPC)</small>' : ''}${r.pokemon ? ` <small>· ${esc(r.pokemon)}</small>` : ''} ` +
		`${STATE[r.state] || ''} <small>${Math.round(r.dealt * 100)}% dealt</small>`).join('<br/>');
	return `<div class="infobox" style="margin:4px 0"><b>⚔️ Raid</b>${bosses}<div style="margin-top:3px">${raiders}</div></div>`;
}

module.exports = {
	MAX_RAIDERS, TURN_LIMIT, CATCH_TURNS, NPC_LEVEL,
	create, get, forRaider, raiderIn, hit, allDown, turnPlayed, finished, standing, runNpc, board, raids, toID,
};
