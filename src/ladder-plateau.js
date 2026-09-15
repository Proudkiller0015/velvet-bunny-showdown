'use strict';
/**
 * Every bot rung has a plateau it never drops below.
 *
 * Bots can climb, but a run of losses to people used to drag a rung down until
 * beating it was worth almost nothing. Each rung is held at its own floor (its
 * starting rating, BOT_FLOORS in src/ladder-seed.js), so there is always rating
 * to win from it. Showdown still prints its own rating lines; this adds one saying
 * why the bot didn't go down.
 *
 * @param {object} proto   Showdown's LadderStore.prototype
 * @param {(userid: string) => string|undefined} rungOf  bot userid -> difficulty
 */
function installPlateaus(proto, rungOf, { floors = require('./ladder-seed').BOT_FLOORS, escape = s => String(s) } = {}) {
	if (!proto || proto.velvetPlateau) return false;
	proto.velvetPlateau = true;

	const updateRow = proto.updateRow;
	proto.updateRow = function (row, score, foeElo) {
		updateRow.call(this, row, score, foeElo);
		const floor = floors[rungOf(row[0])];
		if (floor && Number(row[1]) < floor) {
			row[1] = floor;
			(this.velvetPlateaued || (this.velvetPlateaued = [])).push({ name: row[2], floor });
		}
	};

	const updateRating = proto.updateRating;
	proto.updateRating = async function (p1name, p2name, p1score, room) {
		this.velvetPlateaued = [];
		const out = await updateRating.call(this, p1name, p2name, p1score, room);
		try {
			for (const bot of this.velvetPlateaued) {
				if (room && room.battle) {
					room.addRaw(`<small>${escape(bot.name)} is at its plateau (${bot.floor}): a bot's rating never drops below it, ` +
						`so it stays at ${bot.floor} (-0). Your win still counts in full.</small>`).update();
				}
			}
		} catch (e) { /* the battle room may be gone */ }
		this.velvetPlateaued = [];
		return out;
	};
	return true;
}

module.exports = { installPlateaus };
