# Latency Space

A map of Europe where distance is network latency, not geography.

Live at https://latency.themos.dev

Drag the slider and the continent morphs from its real shape into the shape the internet
actually has. Each dot is a RIPE Atlas anchor. On the left of the slider it sits where it
is; on the right it sits where 135,973 measured round trips say it belongs. Well-peered
cities collapse toward the Frankfurt–Amsterdam core. Everything on an edge flies outward:
Greece ends up 2.8 times further from the middle of Europe than geography puts it, Turkey
2.7, Russia 2.6.

Both sides of the slider are in milliseconds. Geography is converted at the speed of light
in fibre — about 200,000 km/s, there and back, so 100 km of ground is 1 ms of round trip.
That is the floor physics sets, which is why nothing ever moves inward. The median
European path takes **2.6 times** longer than that floor.

Hover an anchor for how far the map misses by and which specific pairs it gets most wrong.

## Where the numbers come from

RIPE Atlas runs an anchoring mesh: every anchor pings every other anchor, continuously.
There is no endpoint that hands you the matrix, so `scripts/build-data.ts` assembles it
from three, none of which needs an API key — keys are only for *creating* measurements:

- `/anchor-measurements/` — ~12,700 entries, filtered here for the active IPv4 mesh pings.
  The endpoint ignores a `type` parameter, so the filtering has to happen client-side.
- `/anchors/` — who the anchors are, where they sit, which are still alive.
- `/measurements/<id>/latest/` — one request returns every anchor's most recent ping to one
  target. That is one column of the matrix, and it is what makes a full mesh affordable.

552 European anchors, so 552 requests and a few hundred megabytes, once a week from CI.
Doing that from a browser would be abuse; none of it is reachable from the page. The
output is reduced to coordinates before it is written, and each run's snapshot is kept
rather than overwritten — the raw mesh cannot be read retrospectively, and the map changing
shape over time is the thing worth having.

Forward and reverse RTT for a pair are folded together by taking the smaller, which carries
less queueing. 29 anchors are dropped for having measurements to fewer than 60% of the
others; what is left covers 99.6% of the possible pairs, and the few remaining gaps are
filled with the shortest path through the measured graph. Filled entries are used only to
give the solver something to hold onto. Every stress figure below is computed against
measured pairs alone.

## The embedding

Classical MDS for the global arrangement, then SMACOF to minimise the thing that actually
matters — the squared gap between each drawn distance and its measured RTT. Classical MDS
fits squared distances through an eigendecomposition, which is the wrong objective but a
good starting point; SMACOF has the right objective but will settle into whatever local
minimum it starts near. Neither is enough alone.

MDS fixes distances, not direction: rotate the solution or mirror it and it fits exactly as
well. So the result is turned to sit as close to real geography as an orthogonal transform
can put it. That pins the orientation against a reference that does not move, which keeps
successive snapshots comparable and makes the morph read as the continent deforming rather
than the page turning. Scale is deliberately left alone.

## Why no map of this can be right

Latency is not a distance. Routing detours mean A→C is regularly slower than A→B→C, and
**83% of measured pairs** have some third anchor that gets there faster than the direct
ping does. Wherever that happens, no set of positions — on a plane or in any number of
dimensions — can be right about all three.

The worst of it is not exotic routing, it is the machine next door. 2,126 pairs of anchors
sit under 2 milliseconds apart, and every single one of them has a third anchor whose two
RTTs differ by more than the pair's own distance — in the worst case by 286 ms. Two boxes
in the same Amsterdam building, half a millisecond from each other, disagreeing by fifteen
about how far away Athens is. The triangle inequality is broken before the map is drawn.

So the map misses by **11.7 ms RMS** across every measured pair, and that number is mostly
not a failure of the solver. The stress layer colours each anchor by its own share of it,
which is the part worth looking at: where latency space cannot be flattened, and who is
holding it open.

## What is here and what is not

Built: the morph, the stress layer, per-node worst pairs, and the archive the rest depends
on. Not built yet: colouring each *pair* by its speed-of-light ratio, a time slider across
archived snapshots, and anchors outside Europe.

A caveat worth stating rather than burying: Atlas anchors are unevenly distributed. 112 of
the 523 are in Germany and 59 in the Netherlands, against one in Iceland. The embedding is
a least-squares fit, so it is pulled toward wherever the anchors are dense — the core is
measured far better than the edges, and the edges are what this map is about.

Data: the [RIPE Atlas](https://atlas.ripe.net/) anchoring mesh, read at build time.
