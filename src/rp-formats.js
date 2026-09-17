'use strict';
/**
 * Which formats are the roleplay, and which are only named after it.
 *
 * "RP" in a format name means two unrelated things on this server. [Gen 9] RP
 * Battle, its doubles and the encounter formats are the story: a character's
 * own Pokemon, a bag, EXP on Discord afterwards. [Gen 9] RP OU, RP Ubers, RP
 * Random Battle and the rest of the tiers only mean "played on this server's
 * own dex", and are an ordinary rated ladder anyone can search for - twenty-six
 * formats, back to gen 1.
 *
 * Deciding between them by the shape of the name confused the two. A finished
 * battle in any format starting `gen<n>rp` was put in the replay feed as
 * `kind: 'pvp'`, exactly like a battle between two characters, and the Discord
 * bot pays a PvP win (350 EXP, and party EXP for everything brought) for one of
 * those. Winning a ladder game in RP OU levelled up an RP character. The house
 * bot was the only thing hiding it: the Discord side skips battles against
 * Bunny, so it took a ladder game between two people to show up.
 *
 * So the roleplay's formats are listed rather than matched. The three sets are
 * nested: every PvP format is a story format, and so is every wild one.
 */

/** Wild encounters and the tutorial: where balls can be thrown and /run works. */
const RP_FORMATS = new Set(['gen9rpbattlewildencounter', 'gen9rpbattlewilddoubles', 'gen9rptutorial']);

/** Battles between two characters, where bag items work (not RP Custom Game). */
const RP_PVP_FORMATS = new Set(['gen9rpbattle', 'gen9rpbattledoubles']);

/**
 * Every format the story is played in: the ones Discord hears about.
 *
 * RP Custom Game is in here because its replay is still posted to Discord; the
 * bot knows that format by name and gives it no EXP. The tutorial is in here
 * because it keeps a replay too, and is dropped later by being a tutorial.
 */
const RP_STORY_FORMATS = new Set([...RP_FORMATS, ...RP_PVP_FORMATS, 'gen9rpcustomgame']);

module.exports = { RP_FORMATS, RP_PVP_FORMATS, RP_STORY_FORMATS };
