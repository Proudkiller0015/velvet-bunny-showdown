# Velvet Bunny Showdown

A hosted **Pokémon Showdown** server with a bot living on it. Challenge the bot in
*any* format and it will build a legal team for that exact format and play you a
real game.

Because it is a real Showdown server, players get the real client: every format,
the teambuilder, team validation, replays, spectating — nothing is reimplemented.

```
you ──► your-server ──► (it bounces you to the official client) ──► Velvet Bunny
```

## Live

**https://velvet-bunny-showdown.onrender.com** - open it and the server bounces you into
the official Showdown client, already pointed at itself. Challenge **Velvet Bunny**.

On Render's free tier the service sleeps after 15 minutes idle, so the first visit
after a quiet spell takes about a minute to wake.

## What it does

**Brings a legal team to anything.** Every format Showdown ships — 283 of them at
the time of writing, from `gen9ou` through VGC regulations, Monotype, Little Cup,
National Dex, Battle Stadium, and the Other Metagames like Inheritance and Cross
Evolution — gets a team that the real `TeamValidator` accepts. This is checked by
the test suite, not assumed.

**Uses real sets.** Set quality comes from the best source that covers the
Pokémon, in order:

1. **Smogon strategy-dex sets for the exact format** (`data.pkmn.cc/sets`)
2. **Usage statistics for the exact format** (`data.pkmn.cc/stats`) — weighted
   sampling of the moves, items, abilities, spreads and Tera types people run
3. Battle Factory sets (gens 6–9), Random Battle sets (gens 2–9), gen 1 data
4. Movepool synthesis, for anything the above do not cover

Species selection is weighted the same way, so `gen9ou` produces an OU team
rather than six legal strangers. Sets are also kept internally coherent: no setup
moves stapled to a Choice item, no status moves under an Assault Vest.

**Plays a decent game.** Every decision is grounded in a real damage calculation
(`@smogon/calc`), not base power. On top of that:

- takes the KO, and prefers the one it lands first
- switches on matchup, charging the switch-in for the hit it will eat
- values each Pokémon by what it can still win — a 1 HP Choice Scarf cleaner is
  protected, a spent slow wall is spendable
- knows Trick Room inverts all of that, and that status or fainting removes it
- sets up when the opponent is under enough pressure to leave, and not otherwise

## Difficulty

PM the bot and it replies with a picker:

| level | plays like |
| --- | --- |
| `easy` | misplays often; a good place to learn a format |
| `normal` | clicks the strongest attack, no tricks |
| `hard` | plays the matchup: switches, sets up, values its win condition |
| `champion` | as above, and counts the speed tiers before committing |

The rungs differ in what they can do, not just how often they slip. Measured over
60 games each: `normal` beats `easy` 73%, `hard` beats `normal` 68%.

## Running it

```bash
npm install          # also writes the Showdown config into place
npm start            # server + bot on $PORT (default 8000)
```

Then open `http://localhost:8000` and challenge **Velvet Bunny**.

### Configuration

| variable | default | meaning |
| --- | --- | --- |
| `PORT` | `8000` | port the server binds |
| `PS_BOT_NAME` | `Velvet Bunny` | the bot's display name |
| `PS_DIFFICULTY` | `hard` | difficulty before a player picks one |
| `PS_HOME_ROOM` | `lobby` | room the bot sits in (it posts the picker from there) |
| `PS_CACHE_DIR` | `./cache` | where Smogon set data is cached |
| `PS_NO_BOT` | — | set to `1` to run the server with no bot |
| `PS_DEBUG` | — | set to `1` to log every protocol line |

### Deploying

`render.yaml` is a ready blueprint — point Render at the repo and it builds and
runs. Any host that runs Node and gives you a `PORT` works the same way; the
server and bot are one process tree on one port.

Players just open the server's own URL. It serves a one-line page that
redirects into the official client with the right host baked in:

```
https://your-host.onrender.com  →  https://your--host-onrender-com.psim.us/
```

Do **not** hand out `play.pokemonshowdown.com/~~your-host/`. That page is
served over HTTPS, so the browser refuses to open a socket back to a host it
cannot verify. The redirect above picks the right scheme for you.

## Tests

```bash
npm test                 # teams for every format, AI behaviour, AI vs random
npm run test:teams       # build + validate a team for all 283 formats
npm run test:behaviour   # the specific judgements (setup gating, tempo, Trick Room)
npm run test:ai          # AI vs random-legal-choice in the real simulator
npm run test:difficulty  # each rung of the ladder against the one below
npm run test:live        # boot the server, log in, challenge, play it out
npm run ablate -- '{"switching":true}' '{"switching":false}' 60
```

`test/ablation.js` plays two configurations of the AI against each other, so a
change can be judged on results rather than on how sensible it looks. It prints a
rough confidence interval, because at 40 games most differences are noise.

## Layout

```
src/teambuilder.js   legal team generation for any format
src/ai.js            damage-calc-driven decisions, difficulty, tempo model
src/battle.js        battle state tracked from the public protocol
src/bot.js           the Showdown client: login, challenges, difficulty, play
src/index.js         boots the server, then the bot
config/              Showdown config (copied into the package before boot)
scripts/setup-config.js
```

## Notes and limits

- Unknown opponent sets are assumed neutral-natured and evenly invested, which
  under-rates them slightly; the switch rule is trigger-happy to compensate.
- `champion`'s turn-order prediction measured 52% ± 13 against `hard` in ablation
  — a real improvement in the cases it fires, but not a decisive one.
- The server runs without a login server: anyone can pick a name and play, and
  nobody is registered. It is a casual battle server, not a ladder.
- Not affiliated with Nintendo, Game Freak, The Pokémon Company or Smogon.
  Pokémon Showdown is AGPLv3; this project is MIT and depends on it.
