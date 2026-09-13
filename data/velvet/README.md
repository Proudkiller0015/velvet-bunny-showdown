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
| **Queen's Heal** | Restores full HP and cures any status. |

Queen Beam's effectiveness, checked against the chart: resisted by Steel,
super effective on Dark/Dragon and Dragon/Flying, neutral on Rock/Dark.

**Light Ball** works on her as well as Pikachu — the item is hard-coded to one
species, so it is patched rather than her.

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

## What is not done

Her **sprites**. The battle client keeps its own copy of the dex, so a species
that exists only on this server is unknown to it and will not draw correctly on
Showdown's own client at `psim.us`. Serving sprites requires teaching the client
build in `client/`, which is a separate piece of work.
