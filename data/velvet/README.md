# Samantha

A custom Pokémon for the Velvet Bunny server. Findable anywhere, playable only
in **Custom Game**.

## What she is

|  |  |
| --- | --- |
| Type | Dark / Fairy |
| Base stats | **250** in every stat (BST 1500) |
| Abilities | Queen Wrath, or Queen's Morph |
| Learnset | every move in the game, plus her own three |
| Legality | `isNonstandard: "Custom"`, `tier: "Illegal"` |

She is deliberately broken. There is no tier she could be added to without
ruining it, which is why she is illegal everywhere that checks.

At level 100 with no investment she has **641 HP** and 500 Attack and Special
Attack once Queen Wrath has doubled them — 1000 of each with a Light Ball.

## Abilities

Each is several real abilities at once. Both survive **Neutralizing Gas**
(`cantsuppress`, the flag Comatose and Multitype use).

### Queen Wrath

| from | what it does |
| --- | --- |
| Mold Breaker | her moves ignore the target's ability |
| Huge Power | Attack doubled |
| — and Special Attack | doubled as well, the way Light Ball does both |
| Queenly Majesty | nothing with priority reaches her or her side |
| Shadow Shield | at full HP, everything hits for half |
| Sturdy | survives a killing blow from full HP on 1; immune to OHKO moves |
| Magic Guard | nothing that is not a move can damage her |

### Queen's Morph

| from | what it does |
| --- | --- |
| Imposter | transforms into whatever is in front of her on the way in |
| — and then | +6 Speed, which a copy could never give her |
| Shadow Shield, Sturdy, Magic Guard | as above |

**Order matters, and it is the reason this one is not simply a list of
handlers.** Transforming *replaces her ability* with whatever she copied, so
anything written as part of the ability stops existing the instant it works. The
sequence is: copy first, then the Speed, then the defensive half — and that half
is kept in a **volatile**, which belongs to the Pokémon rather than to the
ability and therefore survives being overwritten.

The defensive half is applied whether or not the copy succeeded, so she is not
left bare against an empty slot or a failed transform.

**Switching out and back in does not undo it.** Leaving the field clears the
volatile and reverts the transform, and coming back runs the whole sequence
again: she arrives as herself, copies whatever is in front of her *now*, and
rebuilds the same stack. Verified in a battle — switched out, switched back,
re-transformed, and a Sheer Cold still came back `-immune`.

## Moves

| move | |
| --- | --- |
| **Queen Beam** | Fairy, physical, 250 BP. Never misses (`accuracy: true`, which evasion cannot beat). Ignores abilities. Applies **Fairy and Dark effectiveness together**, the Flying Press mechanic. |
| **Queen's Dance** | Raises all five stats to +6. A *dance*, so Dancer copies it. |
| **Queen's Heal** | Restores full HP, cures any status, and returns the item she came in with. Usable while asleep. |
| **Queen's Blitz** | Dark, physical, 200 BP, 10 PP, never misses. Resolves **before every other action in the turn**, switches and Mega Evolution included. Always STAB, always a critical hit, neutral on every type, uses her better attacking stat, and doubles against a target wearing a gimmick. |

Queen Beam's effectiveness, checked against the chart: resisted by Steel,
super effective on Dark/Dragon and Dragon/Flying, neutral on Rock/Dark.

**Queen's Blitz jumps the queue by action order, not by priority.** Priority
only sorts moves against other moves; switching out and Mega Evolution are
different kinds of action and resolve first whatever a move's priority is. So
`beforeTurnCallback` finds this turn's action and sets `action.order = 102`,
which sits below switch (103) and Mega Evolution (104) and above nothing that
matters. Measured: a Blissey ordered to switch faints without leaving, and a
Mega never forms. `priority: 6` on top of that settles it against other moves.

**Queen's Heal reads her team sheet, not `lastItem`.** Recycle's `lastItem` is
set when an item is *consumed*, and says nothing about one that was knocked off
or stolen, which is most of the ways she loses one. `pokemon.set.item` is what
she was built holding and nothing in a battle can change it. The item is
recreated rather than taken back, so a thief keeps theirs.

### Saying so in the battle log

Several of these effects are invisible where it counts: the log prints a number
and never the reason, so a Dark move hitting a Fairy for neutral damage, or a
trap simply not holding, reads as the server being broken. Anything a player
could reasonably mistake for a bug says so in the log - `-message` for the
in-character line, `-hint` for the rule, which the client renders as a small
italic note the way it does for Pursuit or the Sleep Clause. Each is said once
per battle (or once a turn for the ones that can repeat), because an explanation
printed every turn is not an explanation any more.

**Light Ball** works on her as well as Pikachu — the item is hard-coded to one
species, so it is patched rather than her.

## Nuzleaf, and the Broken Pact

The other Pokémon in here, and the only one that is somebody else's: a real
species, in every tier it was already in, carrying one item it should probably
not have been given.

| | |
| --- | --- |
| **Broken Pact** (item) | A reminder of a Trainer who abandoned their partner when it mattered most. A Nuzleaf that would faint while holding it does not faint: it returns at once as **Nuzleaf-SOLD**, at full HP, cured of status, with the item used up. Nuzleaf only, once per battle. |
| **Nuzleaf-SOLD** (forme) | Grass / Dark, **10 / 190 / 10 / 190 / 10 / 190**. Six hundred points spent entirely on going first and hitting hardest, with nothing left over for surviving. Ability: **No Refunds** — cannot be forced out, immune to Intimidate. |
| **Merchant's Call** (move) | Dark, priority +1, 5 PP. Final Gambit: the target takes damage equal to the user's current HP and the user faints. Fails for anybody who is not a Nuzleaf. |

Held together, those three are one combo: Merchant's Call spends the whole HP
bar as damage, the faint is what the item is listening for, and what comes back
is a 190 / 190 / 190 sweeper. Which is why **the item is Ubers-only** — banned by
name in RP OU, UU, RU, NU, PU and ZU, legal in Ubers, AG and RP Battle. Only the
ninth generation needs the ban written down: the item is `gen: 9` and the
validator refuses a later generation's item on its own.

**Nuzleaf-SOLD cannot be selected**, only arrived at — and the obvious marker
for that is the wrong one. `battleOnly` is what Zygarde-Complete and
Ash-Greninja carry, but a battle-only forme with no required ability, item or
move is quietly *rewritten to its base species* by the validator: picking
Nuzleaf-SOLD in the builder handed back a plain Nuzleaf and said nothing about
it. So it is marked `isNonstandard: 'Custom'` instead, the same as Samantha,
which refuses it out loud in every tier that enforces legality — and leaves it
selectable in RP Battle and Custom Game, where she is too. Nothing validates a
`formeChange`, so the battle path is unaffected either way, and
`formeRegression` puts the Nuzleaf back when it finally does faint.

### The hook, and why it is that one

Everything the item does happens in `onBeforeFaint`.

The engine queues a faint the moment HP reaches zero and settles them later, in
`faintMessages`, which asks one question first: `if (!pokemon.fainted &&
this.runEvent('BeforeFaint', ...))`. Answering `false` calls the faint off
before the `|faint|` line is written, before the side loses a Pokémon, and
before anything that feeds on a knockout — Moxie, Destiny Bond, Grim Neigh — is
told there was one. Which is correct: it did not die.

It is also the only hook that catches both roads. A Sturdy-style `onDamage`
guard would catch an attack and miss Merchant's Call entirely, because that move
calls `pokemon.faint()` directly and never goes near the damage path. Nothing in
Showdown's own dex implements `onBeforeFaint` — the event system resolves
handler names off the holder's item and ability generically, so defining one is
enough.

Three things in that handler are load-bearing, each of which was wrong once:

- **`faintQueued` has to be cleared.** `faint()` sets it and checks it on the
  way in, so leaving it set does not undo one knockout — it makes the Nuzleaf
  immortal for the rest of the battle.
- **Heal before the forme change.** `formeChange` hands over the new forme's
  ability through `setAbility`, which opens with `if (!this.hp) return false`.
  Revived afterwards, it kept Chlorophyll while `baseAbility` quietly said No
  Refunds.
- **A null source, not the item.** `formeChange`'s permanent branch treats any
  Item source as a Mega Stone and sends the client a `-mega` line.

And a fourth, which is not in the simulator at all: **the heal has to claim
Revival Blessing.** The client latches fainting — `parseHealth` sets
`fainted = true` the moment it reads an HP string ending in `fnt`, and nothing
in the whole protocol sets it back except one branch of `-heal`, the one whose
`[from]` is Revival Blessing. Without that tag the server healed to full and the
client drew an empty bar on a Pokémon it still believed was gone. Replayed
through Showdown's own `battle.js` in a headless browser, the same log gives
`fainted: true, hpWidth: 0` untagged and `fainted: false, hpWidth: 100` tagged.
The tag names the wrong cause but the right event, and the text it prints —
"was revived and is ready to fight again" — names no move at all.

Measured, each against a control: knocked out by an attack and by its own move,
it comes back at 224 HP with 526 / 374 / 416 offences; without the item, both
faint. Roar drags an ordinary Nuzleaf out and is refused by No Refunds;
Intimidate lands for −2 on the control and is refused here. The second knockout
is real, and it reverts to Nuzleaf.

## How it is installed

Showdown compiles its dex into its own package and offers no hook for adding a
species. A mod would be tidier, but a Pokémon inside a mod does not exist
anywhere else *at all* — not searchable, not in the builder, not lookupable — and
what was wanted was the opposite: findable everywhere, legal only in Custom Game.
That is exactly how Showdown already treats MissingNo., so she is marked the same
way.

So `scripts/setup-config.js` copies this directory into the package and appends
**one line** to each of the six dex files it extends, calling into `index.js`.
The package's own contents are never rewritten, only added to. The line is
marked, so running it again on every boot is harmless, and a reinstall that
restores the originals simply gets the line back.

`learnsets.js` is generated — run `node scripts/build-velvet-learnset.js` after
upgrading Showdown so "every move" picks up whatever was added.

## Sprites

Since this was written, the client in `client/` learned to draw both of them:
`ART` in `client/js/velvet-data.js` names the files, and three hooks — the
battle sprite, the list icon, the teambuilder's set box — read it instead of
building a URL against Showdown's CDN, where neither exists. The files are
served from `client/sprites/` and built with

    node scripts/make-sprite.js <source> <name> <height> [flip]

which keys the background by flood fill from the edges, crops to what is left,
and scales in linear light. Nuzleaf-SOLD's back sprite is its front mirrored and
slightly enlarged; a real rear view would be better and there isn't one.

This applies to **our** client. On Showdown's own client at `psim.us` neither
Pokémon is in the dex at all, and both will draw as a substitute — there is no
fixing that from here.
