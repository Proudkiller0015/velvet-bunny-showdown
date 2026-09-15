'use strict';
/**
 * The Showdown half of RP encounters. Loaded by the server config, so it runs
 * in the process that owns the rooms, the users and the battles.
 *
 * How an encounter happens:
 *
 *   1. On Discord, a player types `!encounter 3 25` in the channel their
 *      character is standing in. The Discord bot signs a request - who, where,
 *      how many badges, level cap, which balls the character is carrying - and
 *      POSTs it to /rp/encounter.
 *   2. This checks the signature, works out the place from the channel, and
 *      rolls what appears (src/encounters.js). It hands the result to the RP
 *      bot, which challenges the player under the wild Pokemon's or trainer's
 *      name, and answers Discord with what appeared so it can be announced.
 *   3. The battle is played. A ball can only be thrown from the button, and
 *      only while the character has one of that kind left.
 *   4. Discord asks /rp/result/<id> until the battle is over, then pays the
 *      character, takes away the balls that were thrown, and records anything
 *      that was caught.
 *
 * Why signed: the endpoint is on the public internet, and anyone who could
 * post to it could hand themselves any encounter they liked. The Discord bot
 * holds a private key and this holds only the public half, so there is no
 * secret on this server to leak and nothing to configure on the host.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const E = require('./encounters');

const REGIONS = { kagura: () => require('./encounter-tables/kagura') };
const PUBLIC_KEY_FILE = path.join(__dirname, '..', 'config', 'rp-encounter-key.pub.pem');
const RP_ROOM = 'roleplay';
const MAX_SKEW_MS = 5 * 60 * 1000;
const CHALLENGE_MS = 5 * 60 * 1000;
const RESULT_KEEP_MS = 6 * 60 * 60 * 1000;

const toID = E.toID;

// ------------------------------------------------------------------ signing

function publicKey() {
	const pem = process.env.RP_ENCOUNTER_PUBLIC_KEY || (fs.existsSync(PUBLIC_KEY_FILE) ? fs.readFileSync(PUBLIC_KEY_FILE, 'utf8') : '');
	return pem ? crypto.createPublicKey(pem) : null;
}

/** `{ payload, sig }`, both base64: payload is the JSON request, sig its ed25519 signature. */
function verify(body, key = publicKey()) {
	if (!key) return { error: 'This server has no RP key configured.' };
	let payload;
	try {
		const bytes = Buffer.from(String(body.payload || ''), 'base64');
		const sig = Buffer.from(String(body.sig || ''), 'base64');
		if (!crypto.verify(null, bytes, key, sig)) return { error: 'Bad signature.' };
		payload = JSON.parse(bytes.toString('utf8'));
	} catch (e) {
		return { error: 'Unreadable request.' };
	}
	if (!payload || Math.abs(Date.now() - Number(payload.at)) > MAX_SKEW_MS) return { error: 'Request is too old.' };
	return { payload };
}

// ------------------------------------------------------------------- places

/** Which place a Discord channel is in. Channel names are unique across the region. */
function placeFor(region, channel) {
	const load = REGIONS[toID(region || 'kagura')];
	if (!load) return null;
	const tables = load();
	const name = String(channel || '').replace(/^#/, '').toLowerCase();
	for (const [id, place] of Object.entries(tables.locations)) {
		const channels = new Set([...(place.wild || []), ...(place.noTrainers || []), ...(place.channels || [])]);
		if (channels.has(name) || id === name) return { id, place, channel: name };
	}
	return null;
}

// --------------------------------------------------------------- encounters

/** id -> everything about one encounter, from the roll to the result. */
const encounters = new Map();

function sweep() {
	const now = Date.now();
	for (const [id, enc] of encounters) {
		if (now - enc.createdAt > RESULT_KEEP_MS) encounters.delete(id);
		else if (enc.status === 'waiting' && now - enc.createdAt > CHALLENGE_MS + 30000) enc.status = 'expired';
	}
}

/** The encounter a player already has open, if any - so declining one doesn't reroll it. */
function openFor(userid) {
	sweep();
	for (const enc of encounters.values()) {
		if (enc.userid === userid && (enc.status === 'waiting' || enc.status === 'battling')) return enc;
	}
	return null;
}

/**
 * Handle a verified request. Returns the JSON to answer with.
 *
 * `deps` is what this needs from the running server - kept separate so the
 * logic can be tested without one.
 */
function requestEncounter(payload, deps) {
	const userid = toID(payload.showdown);
	if (!userid) return { ok: false, code: 'noname', message: 'No Showdown name given.' };

	let found = placeFor(payload.region, payload.channel);
	// Staff can summon something anywhere - an event channel isn't on the map.
	if (!found && payload.summon) {
		const name = String(payload.channel || 'event').replace(/^#/, '').toLowerCase();
		found = { id: 'event', channel: name, place: { name: `#${name}`, types: [], trainers: [], wild: [name], channels: [name] } };
	}
	if (!found) {
		return { ok: false, code: 'noplace', message: `#${payload.channel} isn't a place on the map, so nothing can be met here. Use it in the channel your character is in.` };
	}
	const { place } = found;
	const wildHere = (place.wild || []).includes(found.channel);
	const trainersHere = (place.trainers || []).length && !(place.noTrainers || []).includes(found.channel);

	let kind = payload.kind === 'wild' || payload.kind === 'trainer' ? payload.kind : 'any';
	if (payload.summon) kind = payload.summon.kind === 'trainer' ? 'trainer' : 'wild';
	else if (kind === 'wild' && !wildHere) {
		const where = (place.wild || []).map(c => `#${c}`).join(', ');
		return { ok: false, code: 'nowild', message: `No wild Pokémon in #${found.channel}.` + (where ? ` Try ${where}.` : '') };
	}
	if (!payload.summon && kind === 'trainer' && !trainersHere) {
		return { ok: false, code: 'notrainers', message: `Nobody is looking for a battle in #${found.channel}.` };
	}
	if (kind === 'any') {
		if (!wildHere && !trainersHere) {
			return { ok: false, code: 'nothing', message: `Nothing to encounter in #${found.channel}. Head outside, onto a route or into the wilds.` };
		}
		kind = wildHere && (!trainersHere || Math.random() < 0.7) ? 'wild' : 'trainer';
	}

	const existing = openFor(userid);
	if (existing && payload.summon) {
		return { ok: false, code: 'busy', message: `${payload.showdown} already has an encounter open (${E.describe(existing)}). Finish it or use !complete first.` };
	}
	if (existing) {
		if (!deps.isOnline(userid)) {
			return { ok: false, code: 'offline', message: `You're not on Showdown as ${payload.showdown} right now.`, encounter: publicView(existing) };
		}
		// Declining it and asking again brings the same one back.
		if (existing.status === 'waiting') deps.spawn(existing);
		return { ok: true, again: true, encounter: publicView(existing) };
	}

	if (!deps.isOnline(userid)) {
		return { ok: false, code: 'offline', message: `You're not on Showdown as **${payload.showdown}** right now. Open the Showdown site, log in with that name, then try again.` };
	}

	const badges = E.clampBadges(payload.badges);
	const levelCap = payload.levelCap ? E.clampLevel(payload.levelCap) : null;
	let rolled;
	if (payload.summon) {
		// Staff choosing what appears. The Discord bot only signs this for admins.
		rolled = summoned(payload.summon, { place, badges, levelCap });
		if (rolled.error) return { ok: false, code: 'summon', message: rolled.error };
	} else {
		rolled = kind === 'wild'
			? E.rollWild({ place, badges, levelCap, shiny: payload.shiny || {} })
			: E.rollTrainer({ place, badges, levelCap });
	}
	if (!rolled.team.length) return { ok: false, code: 'empty', message: 'Nothing turned up. Try again.' };

	const enc = {
		id: crypto.randomBytes(8).toString('hex'),
		createdAt: Date.now(),
		userid,
		showdown: payload.showdown,
		character: payload.character || '',
		discord: payload.discord || '',
		place: found.id,
		placeName: place.name,
		channel: found.channel,
		balls: payload.balls && typeof payload.balls === 'object' ? normaliseBalls(payload.balls) : null,
		items: payload.items && typeof payload.items === 'object' ? normaliseItems(payload.items) : null,
		warning: String(payload.warning || '').slice(0, 300),
		...rolled,
		status: 'waiting',
		result: null,
	};
	encounters.set(enc.id, enc);
	deps.spawn(enc);
	return { ok: true, encounter: publicView(enc) };
}

/**
 * An encounter staff asked for by name: a species and level, or a trainer
 * class. Legendaries can be summoned - an event might want one to battle - but
 * the battle still refuses to let anyone catch one.
 */
function summoned(summon, { place, badges, levelCap }) {
	if (summon.kind === 'trainer') {
		const cls = summon.classId ? E.findClass(summon.classId) : null;
		if (summon.classId && !cls) return { error: `No trainer class called "${summon.classId}".` };
		return E.rollTrainer({ place, badges, levelCap, classId: cls && cls.id });
	}
	const { Dex } = require('pokemon-showdown');
	const species = Dex.species.get(summon.species);
	if (!species.exists || !E.encounterable(species)) return { error: `No Pokémon called "${summon.species}".` };
	const level = E.clampLevel(summon.level || levelCap || 5);
	const set = E.wildSet(species, level);
	if (summon.shiny) set.shiny = true;
	return {
		kind: 'wild', double: false, name: E.wildName(species), avatar: '', team: [set],
		ai: badges >= 6 ? 'hard' : badges >= 3 ? 'normal' : 'easy', format: E.WILD_FORMAT, badges,
	};
}

/**
 * Finish an encounter without a battle, for staff: it counts as caught, won
 * or lost as they say, and the RP bot stops waiting for the player.
 */
function completeEncounter(payload, deps) {
	const enc = payload.id ? encounters.get(payload.id) : openFor(toID(payload.showdown));
	if (!enc) return { ok: false, code: 'none', message: 'No open encounter to complete.' };
	const outcome = ['caught', 'won', 'lost', 'cancelled'].includes(payload.outcome) ? payload.outcome : null;
	if (!outcome) return { ok: false, code: 'bad', message: 'Say caught, won, lost or cancel.' };
	if (outcome === 'caught' && enc.kind !== 'wild') return { ok: false, code: 'bad', message: "You can't catch a trainer's Pokémon." };
	const mon = enc.team[enc.team.length - 1];
	const ball = E.findBall(payload.ball || 'poke');
	enc.result = {
		outcome,
		caught: outcome === 'caught' ? { species: mon.species, level: mon.level, ball: ball ? ball.id : 'poke', shiny: !!mon.shiny } : null,
		ballsUsed: outcome === 'caught' && ball ? { [ball.id]: 1 } : {},
		player: enc.showdown,
		byStaff: true,
	};
	enc.status = 'done';
	if (deps.cancel) deps.cancel(enc);
	return { ok: true, encounter: publicView(enc) };
}

function normaliseItems(items) {
	const out = {};
	for (const [name, count] of Object.entries(items)) {
		const item = E.findBattleItem(name);
		if (item && Number(count) > 0) out[item.id] = (out[item.id] || 0) + Math.floor(Number(count));
	}
	return out;
}

/** Items of a kind used so far in a battle by this player, read off its log. */
function usedInLog(lines, side, itemName) {
	const needle = `|-message|${side} used `;
	return lines.filter(l => l.startsWith(needle) && new RegExp(`^\\|-message\\|.+ used an? ${itemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} on `).test(l)).length;
}

/** Whether a character may use this item now: an encounter, and one left in the bag. */
function canUseItem(enc, itemId, usedSoFar) {
	if (!enc) return { ok: false, message: 'Items can only be used in RP encounters (from !encounter on Discord).' };
	const item = E.findBattleItem(itemId);
	const have = enc.items ? enc.items[itemId] || 0 : 0;
	if (have - usedSoFar > 0) return { ok: true, left: have - usedSoFar - 1 };
	return { ok: false, message: have ? `That was your last ${item.name}.` : `${enc.character || 'Your character'} doesn't have a ${item.name}. Buy some with !buy on Discord.` };
}

function normaliseBalls(balls) {
	const out = {};
	for (const [name, count] of Object.entries(balls)) {
		const ball = E.findBall(name);
		if (ball && Number(count) > 0) out[ball.id] = (out[ball.id] || 0) + Math.floor(Number(count));
	}
	return out;
}

/** What Discord gets told: enough to announce it, nothing about its moves. */
function publicView(enc) {
	return {
		id: enc.id,
		kind: enc.kind,
		double: enc.double,
		name: enc.name,
		className: enc.className || null,
		place: enc.placeName,
		channel: enc.channel,
		badges: enc.badges,
		format: enc.format,
		pokemon: enc.team.map(s => ({ species: s.species, level: s.level, shiny: !!s.shiny })),
		text: E.describe(enc),
		status: enc.status,
		result: enc.result,
	};
}

// -------------------------------------------------------------------- balls

/** Balls of a kind thrown so far in a battle, read off its own log. */
function thrownInLog(lines, side, ballName) {
	const needle = `|-message|${side} threw `;
	return lines.filter(l => l.startsWith(needle) && l.endsWith(`${ballName}!`)).length;
}

/**
 * Whether a character may throw this ball now.
 *
 * Without a bag (a staff-made encounter) any ball goes. With one, a ball of
 * that kind has to be left after the ones already thrown this battle.
 */
function canThrow(enc, ballId, thrownSoFar) {
	if (!enc || !enc.balls) return { ok: true };
	const have = enc.balls[ballId] || 0;
	if (have - thrownSoFar > 0) return { ok: true, left: have - thrownSoFar - 1 };
	const ball = E.findBall(ballId);
	return { ok: false, message: have ? `That was your last ${ball.name}.` : `${enc.character || 'Your character'} doesn't have any ${ball.name}s. Buy some with !buy on Discord.` };
}

// ------------------------------------------------------------------ results

/** Read what happened out of a finished battle's log. */
function resultFromLog(enc, lines, winnerid) {
	const playerName = enc.showdown;
	const used = {};
	for (const line of lines) {
		const m = /^\|-message\|(.+) threw an? (.+)!$/.exec(line);
		if (!m || toID(m[1]) !== enc.userid) continue;
		const ball = E.findBall(m[2]);
		if (ball) used[ball.id] = (used[ball.id] || 0) + 1;
	}
	let caught = null;
	for (const line of lines) {
		const m = /\(\(Caught (.+?), Lv\. (\d+), with an? (.+?)\)\)/.exec(line);
		if (m) caught = { species: m[1], level: Number(m[2]), ball: E.findBall(m[3]) ? E.findBall(m[3]).id : null };
	}
	if (caught) {
		// The details a Pokemon is sent out with say "shiny" when it is one.
		caught.shiny = lines.some(l => /^\|(switch|drag)\|p\d[ab]?: /.test(l) && l.split('|')[3] &&
			l.split('|')[3].startsWith(caught.species) && /, shiny/.test(l.split('|')[3]));
	}
	const itemsUsed = {};
	for (const line of lines) {
		const m = /^\|-message\|(.+) used an? (.+) on .+!$/.exec(line);
		if (!m || toID(m[1]) !== enc.userid) continue;
		const item = E.findBattleItem(m[2]);
		if (item) itemsUsed[item.id] = (itemsUsed[item.id] || 0) + 1;
	}
	const won = winnerid === enc.userid;
	return {
		outcome: caught ? 'caught' : won ? 'won' : winnerid ? 'lost' : 'tie',
		caught,
		ballsUsed: used,
		itemsUsed,
		player: playerName,
	};
}

// ------------------------------------------------------------ replay feed

/**
 * Recently finished RP battles, newest last, for Discord's replay channels.
 *
 * In memory, so a restart forgets the last few - which only means a replay or
 * two isn't posted, never that one is posted twice. Each has a rising number;
 * Discord remembers the last one it posted and asks for anything after it.
 */
const finished = [];
let finishedSeq = 0;
function recordFinished(entry) {
	finished.push({ seq: ++finishedSeq, endedAt: Date.now(), ...entry });
	while (finished.length > 200) finished.shift();
}
function finishedSince(seq) {
	return finished.filter(f => f.seq > seq);
}

// ------------------------------------------------------------------- HTTP

function readJson(req, limit = 16 * 1024) {
	return new Promise((resolve, reject) => {
		let size = 0;
		const chunks = [];
		req.on('data', c => {
			size += c.length;
			if (size > limit) { reject(new Error('too large')); req.destroy(); return; }
			chunks.push(c);
		});
		req.on('end', () => {
			try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(e); }
		});
		req.on('error', reject);
	});
}

function send(res, status, body) {
	res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
	res.end(JSON.stringify(body));
}

/** An HTTP route for src/http-hooks.js. Returns true when it answered. */
function httpRoute(deps, log) {
	return (req, res) => {
		const url = String(req.url || '');
		if (url === '/rp/encounter' && req.method === 'POST') {
			readJson(req).then(body => {
				const checked = verify(body);
				if (checked.error) return send(res, 403, { ok: false, code: 'forbidden', message: checked.error });
				let answer;
				try {
					answer = checked.payload.complete ? completeEncounter(checked.payload, deps) : requestEncounter(checked.payload, deps);
				} catch (e) {
					log(`encounter failed: ${e.stack || e.message}`);
					answer = { ok: false, code: 'error', message: 'Something went wrong rolling that encounter.' };
				}
				send(res, 200, answer);
			}).catch(() => send(res, 400, { ok: false, code: 'bad', message: 'Bad request.' }));
			return true;
		}
		const feed = /^\/rp\/finished(?:\?since=(\d+))?$/.exec(url);
		if (feed && req.method === 'GET') {
			// Server-restart aware: a `since` above anything this boot has seen
			// means the numbers started again, so everything is new.
			let since = Number(feed[1] || 0);
			if (since > finishedSeq) since = 0;
			send(res, 200, { ok: true, latest: finishedSeq, battles: finishedSince(since) });
			return true;
		}
		const m = /^\/rp\/result\/([a-f0-9]{16})$/.exec(url);
		if (m && req.method === 'GET') {
			sweep();
			const enc = encounters.get(m[1]);
			send(res, enc ? 200 : 404, enc ? { ok: true, encounter: publicView(enc) } : { ok: false, code: 'gone' });
			return true;
		}
		return false;
	};
}

module.exports = {
	verify, placeFor, requestEncounter, completeEncounter, canUseItem, usedInLog, publicView, canThrow, thrownInLog, resultFromLog, openFor,
	httpRoute, encounters, RP_ROOM, CHALLENGE_MS, recordFinished, finishedSince,
};
