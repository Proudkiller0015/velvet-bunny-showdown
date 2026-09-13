'use strict';
/**
 * What the bot ladder runs, by default.
 *
 * Separated from src/ladder.js so that anything needing only the names can have
 * them without dragging in the dex, the damage calculator and a websocket
 * client. scripts/setup-config.js is the case that matters: it has to grant the
 * bot's avatar to every queue account, and it runs before the server starts.
 *
 * Keeping one copy is not tidiness. When setup-config worked the names out for
 * itself it went on granting the avatar to "Velvet Bunny Easy" long after the
 * queues had been renamed to fit Showdown's eighteen-character user id limit, so
 * four accounts that did not exist held the rights and every queue that did was
 * refused its own face.
 */

/**
 * Random Battle, and our own.
 *
 * Random Battle stays first, which is load-bearing: the first format's queues
 * keep their plain account names, so the ratings those four have been building
 * since the start survive a second format being added.
 *
 * RP Random Battle is here because a tier nobody is queuing for is a tier
 * nobody can play. It is also the only RP format the bots can take on cheaply -
 * the server generates both teams, so there is nothing for them to build.
 */
const DEFAULT_FORMATS = ['gen9randombattle', 'gen9rprandombattle'];

// One queue per difficulty, each carrying its own rating.
const DEFAULT_DIFFICULTIES = ['easy', 'normal', 'hard', 'champion', 'stockfish'];

module.exports = { DEFAULT_FORMATS, DEFAULT_DIFFICULTIES };
