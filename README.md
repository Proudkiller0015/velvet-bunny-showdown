# Velvet Bunny Showdown

A hosted **Pokémon Showdown** server with a bot living on it. Play it in any
format and it will build a legal team for that exact format and play you a real
game — by challenge, or straight off the ladder.

## Play

**https://velvet-bunny-showdown.onrender.com**

That opens the real Pokémon Showdown client — Smogon's own — pointed at this
server, so the news, the teambuilder and the whole interface are exactly as
usual. Pick a name at the top right; there is no password and no sign-up.

Two ways to get a battle:

- **Press Battle!** with a format chosen. The bot sits in the ladder queue, so
  it finds you, and the result is **rated** and counts on the server's ladder.
  The **Opponent** row above the button decides who that is: leave *House bot*
  ticked and pick a difficulty, or untick it for **players only** and wait for
  a real one.
- **Open the Lobby.** The panel at the top of the room lists every format as a
  button, with Easy / Normal / Hard / Champion alongside.

Random Battle needs no team of your own. For anything else, build one in the
Teambuilder first — the bot always brings its own legal team.

On Render's free tier the service sleeps after 15 minutes idle, so the first
visit after a quiet spell takes about a minute to wake.

### A second client, at `/play/`

`/play/` serves our own build of the client, which puts the bot panel on the
main menu next to the ladder button and is the only one that knows about
Samantha. Both clients sign people in the same way.

### Accounts

Accounts here are **real Pokémon Showdown accounts**, and this server runs no
account system of its own. Logging in works the way it does on the official
client: this server issues a challstr, Showdown's login server signs an
assertion binding that challstr to a userid, and this server checks the
signature against Showdown's public key. An assertion names one account and one
challstr, so it is worth nothing anywhere else.

- **Already have an account?** Log in with it. Nothing to re-register.
- **Don't want one?** Pick a name and play — the login server signs assertions
  for unregistered userids too, so you appear as an unregistered player exactly
  as you would on Showdown.
- **Registering** from either client is real registration on Pokémon Showdown.

Because a name now belongs to whoever owns it, ranks and avatars are granted to
accounts rather than to whoever typed the name first. A name nobody has
registered is still anybody's to take, so any name carrying rank should be a
registered one.

Where a password goes depends on which address you use:

- On the **psim.us** address the client is served by Showdown, so it asks its
  own origin and nothing to do with logging in touches this server.
- On **our own domain** the browser cannot reach them — Showdown's cross-domain
  handshake returns an empty page for hosts they do not route, and their login
  server sends no CORS headers — so `src/http-hooks.js` forwards that one
  request. A password typed there passes through this server on its way to
  Showdown. It is never stored or logged, but it does pass through.

The bot's own accounts are exempt: they are unregistered names accepted only
from the loopback address, so they work without passwords and cannot be claimed
from anywhere else. `PS_REAL_ACCOUNTS=0` turns the whole thing off and goes back
to any-name-no-proof, which is useful for local testing.

## What it does

**Brings a legal team to anything.** Every format Showdown ships — 283 of them,
from `gen9ou` through VGC regulations, Monotype, Little Cup, National Dex and
Other Metagames like Inheritance and Cross Evolution — gets a team the real
`TeamValidator` accepts. Checked by the test suite, not assumed.

**Uses real sets**, best source first: Smogon strategy-dex sets for the exact
format, then usage statistics for it, then Battle Factory and Random Battle
data, then movepool synthesis. Species are picked the same way, so `gen9ou`
produces an OU team rather than six legal strangers. Sets are kept coherent: no
setup moves on a Choice item, no status under an Assault Vest.

**Plays a real game.** Decisions come from actual damage calculations
(`@smogon/calc`), and on top of that:

- takes the KO, and prefers the one it lands first
- switches on matchup, charging the switch-in for the hit it will eat
- values each Pokémon by what it can still win — a 1 HP Choice Scarf cleaner is
  protected, a spent slow wall is spendable
- knows Trick Room inverts that, and that status or fainting removes it
- sets up only when the opponent is under enough pressure to leave
- Terastallizes for defence as well as offence, and never on a turn it dies anyway
- **guesses abilities properly**: an unrevealed ability is every ability the
  species could have, weighted by usage — and the battle narrows it. A move that
  lands rules out everything that would have absorbed it; one that bounces off
  identifies what did; a Knock Off that fails to take an item is Sticky Hold.

## Difficulty

The **Opponent** row on the search form, the Lobby panel, a PM to the bot, or
`/bot <level>` in any chat - all four set the same thing:

| level | plays like |
| --- | --- |
| `easy` | misplays often; a good place to learn a format |
| `normal` | clicks the strongest attack, no tricks |
| `hard` | plays the matchup: switches, sets up, values its win condition |
| `champion` | as above, and counts the speed tiers before committing |
| `stockfish` | **experimental** — adds a one-turn search, tuned by self-play |

Measured over 60 games each: `normal` beats `easy` 73%, `hard` beats `normal`
70%, and `stockfish` beats `champion` 60%.

**Which rungs are queued depends on the format.** A queue is an account and a
socket, and this host is short of memory, so the two Random Battles carry the
whole ladder while the team formats carry the middle of it - nobody is learning
a tier against Easy, and Stockfish thinks longest for the smallest difference.
The table is `LADDER` in `src/ladder-defaults.js`:

| format | rungs |
| --- | --- |
| Random Battle | easy, normal, hard, champion, stockfish |
| RP Random Battle | easy, normal, hard, champion, stockfish |
| RP Battle | normal, hard, champion |
| RP OU | normal, hard |

Every other format is still playable against the bot - challenge it directly,
or use the Lobby panel - it simply has nobody sitting in that queue.

## Training

Training runs on a PC, not on the server — 512MB and a disk wiped on every
restart is the wrong place to learn anything.

```bash
npm run train -- --games 60 --generations 10 --format gen9ou
```

It plays candidate weightings against champion, keeps only what beats the
incumbent by more than the noise band, and writes `data/brain.json`. Commit and
deploy that file to put it on the server; the boot log says which brain it has.

Be suspicious of a single good sample: a run that accepted a change at 73%
re-measured at 60% over fresh games, which is why the acceptance test is
deliberately conservative.

## Running it

```bash
npm install          # also puts the config, client and avatars in place
npm start            # server + bot on $PORT (default 8000)
```

| variable | default | meaning |
| --- | --- | --- |
| `PORT` | `8000` | port the server binds |
| `PS_BOT_NAME` | `Velvet Bunny` | the bot's display name |
| `PS_DIFFICULTY` | `hard` | difficulty before a player picks one |
| `PS_OWNERS` | `Unseen Face,SlimeQueenSamantha` | promoted to owner on sight |
| `PS_LADDER_FORMATS` | see `src/ladder-defaults.js` | which formats the bot queues for, overriding the table there |
| `PS_LADDER_DIFFICULTIES` | per format | which rungs queue, overriding the table there |
| `PS_LADDER` | — | set to `0` to keep the bot off the ladder |
| `PS_FORMAT_CACHE` | `8` | format contexts held in memory |
| `PS_BRAIN` | `data/brain.json` | trained search weights |
| `PS_CACHE_DIR` | `./cache` | where Smogon set data is cached |
| `PS_NO_BOT` | — | set to `1` to run the server with no bot |
| `PS_DEBUG` | — | set to `1` to log every protocol line |

### Deploying

`render.yaml` is a blueprint for Render. **Auto-deploy is off on purpose**: every
push used to restart the server and disconnect whoever was mid-battle. Deploy
manually from the dashboard when nobody is playing.

Memory is the live constraint on the free tier — 512MB, against a ~234MB live
heap. `NODE_OPTIONS=--max-old-space-size=400` is set in the blueprint. If it ever
dies with exit 137, the next cuts are the format cache down to 4, and
lazy-loading the damage calculator.

## Tests

```bash
npm test                 # teams for every format, AI behaviour, AI vs random
npm run test:teams       # build and validate a team for all 283 formats
npm run test:behaviour   # the specific judgements: setup, tempo, Tera, abilities
npm run test:ai          # AI vs random-legal-choice in the real simulator
npm run test:difficulty  # each rung of the ladder against the one below
npm run test:lobby       # the lobby panel, locally or against a live server
npm run test:live        # boot, log in, challenge, play it out
npm run test:remote -- wss://host/showdown/websocket   # the same, deployed
npm run ablate -- '{"switching":true}' '{"switching":false}' 60
```

`test/ablation.js` plays two configurations against each other so a change is
judged on results. It prints a confidence interval, because at 40 games most
differences are noise.

**A deploy is only verified by `test:remote`.** Local tests say nothing about
whether the hosted thing booted, the bot logged in, or the host allows sockets.

## Layout

```
src/teambuilder.js   legal team generation for any format
src/ai.js            damage-calc decisions, difficulty, tempo, ability inference
src/search.js        one-turn search, weights the trainer tunes
src/brain.js         loads data/brain.json
src/battle.js        battle state tracked from the public protocol
src/bot.js           the Showdown client: login, challenges, difficulty, play
src/ladder.js        one queue per format, so Battle! finds the bot
src/index.js         boots the server, then the bot and the queues
client/              our build of the Showdown client, served at /play/
client-build/        scripts that produce it, and why each patch is needed
server-static/       the stock root page, restored on every boot
avatars/             custom avatars, copied into the package config
config/              Showdown config, copied into the package before boot
```

## Notes and limits

- Unknown opponent *sets* are assumed neutral-natured and evenly invested, which
  under-rates them slightly; the switch rule is trigger-happy to compensate.
- `stockfish` search replaced the heuristic outright in its first form and
  measured **worse** (40%). It blends with it now. Search is not free strength.
- `node_modules` survives between deploys on Render, so anything written into the
  package has to be rewritten on every boot rather than assumed intact — an
  overwrite of its `index.html` outlived the change that stopped doing it, and
  kept the root serving the wrong client.
- Not affiliated with Nintendo, Game Freak, The Pokémon Company or Smogon.
  Pokémon Showdown is AGPLv3; this project is MIT and depends on it.
