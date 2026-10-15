'use strict';
/**
 * The inactivity rule for games against a bot (the owner, 14 Oct 2026).
 *
 * A player who leaves a game against a bot, or sits on one turn for five minutes,
 * gets a two-minute countdown; if they still have not moved (or come back) when it
 * runs out, they forfeit. Without it such a game never ended: the bot waits on a
 * move that never comes. Player-vs-player games are left alone - Showdown's own
 * timer is theirs to turn on.
 *
 * "A bot" is any account connected only from this machine: the Velvet Bunny ladder
 * rungs, the house bot and every RP encounter (each one its own account, named for
 * what it is), all of which run in-process.
 *
 * Driven by config/showdown-config.js every few seconds; pure enough to test with
 * stand-in rooms (test/bot-idle.test.js).
 */

const IDLE_MS = 5 * 60 * 1000;
const GRACE_MS = 2 * 60 * 1000;
const LOOPBACK = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

/** Connected only from this host: one of ours. */
function isBotUser(user, botIds) {
	if (!user) return false;
	if (botIds && botIds.has(user.id)) return true;
	const conns = user.connections || [];
	return conns.length > 0 && conns.every(c => LOOPBACK.includes(c.ip));
}

const say = (room, line) => { room.add(line); if (room.update) room.update(); };

/**
 * One pass over the battle rooms. `getUser(id)` finds a player's account.
 * Returns what it did, for the log and the tests.
 */
function tick(rooms, { getUser, botIds = null, now = Date.now(), idleMs = IDLE_MS, graceMs = GRACE_MS } = {}) {
	const done = [];
	for (const room of rooms) {
		const battle = room && room.battle;
		if (!battle || battle.ended || !battle.started || !battle.players || battle.players.length !== 2) continue;
		const bots = battle.players.filter(p => isBotUser(getUser(p.id), botIds));
		if (bots.length !== 1) continue;   // player vs player, or two bots
		const human = battle.players.find(p => !bots.includes(p));
		if (!human || human.eliminated) continue;

		const st = battle.velvetIdle || (battle.velvetIdle = { rqid: null, since: now, deadline: 0 });
		const req = human.request || {};
		const waiting = req.isWait === false && !!req.request;
		const left = !human.active;
		// A new request (they moved, or the turn moved on) starts the five minutes again.
		if (req.rqid !== st.rqid) {
			st.rqid = req.rqid;
			st.since = now;
			if (st.deadline && !left) {
				st.deadline = 0;
				say(room, `|inactiveoff|${human.name} is back; the countdown is off.`);
				done.push({ room: room.roomid, did: 'off' });
			}
		}
		if (!st.deadline) {
			const idle = waiting && now - st.since >= idleMs;
			if (left || idle) {
				st.deadline = now + graceMs;
				st.why = left ? 'left' : 'idle';
				say(room, `|inactive|${human.name} has ${Math.round(graceMs / 60000)} minutes to ${left ? 'come back and ' : ''}make a move, or they forfeit.`);
				done.push({ room: room.roomid, did: 'start', why: st.why });
			}
			continue;
		}
		if (now < st.deadline) continue;
		// Time is up: still gone, or still sitting on the same choice.
		if (left || waiting) {
			battle.forfeitPlayer(human, ' lost due to inactivity.');
			done.push({ room: room.roomid, did: 'forfeit' });
		} else {
			st.deadline = 0;
		}
	}
	return done;
}

module.exports = { tick, isBotUser, IDLE_MS, GRACE_MS };
