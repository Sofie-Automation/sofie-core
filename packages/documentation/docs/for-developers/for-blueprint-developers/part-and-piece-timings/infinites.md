# Infinites

An **Infinite** is a timeline object that has no predefined end in the context of the piece, rather its context determines when they are terminated.

- Infinites are governed by:
  - Type
  - Activation order
  - Playhead progression
  - Level
    - Showstyle
    - Rundown
    - Segment
    - Part

![Infinite hierarchy](/img/docs/for-developers/timing/infinites/infinite-hierarchy.png)

## Types of infinites and their lifecycle

There are two types of infinites in Sofie:

- OnEnd
  - Mainly used for planned content and most of the time originates from NRCS
  - Resolved at ingest (1, 3)
    - Its resulting state is known before we enter the piece (1, 3)
  - It only propagates forward until the end of its content level. (5, 7)
- OnChange (also referred to as playhead tracking infinite)
  - Mainly used for unplanned content and most of the time originates from AdLibs
  - It can only be resolved when it is triggered which happens when the original piece is entered (2, 4, 6)
    - It propagates forward from the playhead, its lifecycle is dependent on playout order, therefore its resulting state is unknown at ingest.
      - This means that it can propagate before and after the triggering piece depending on where the next take will be. (6, 8)

Both types can only live within their content level.

![Infinite lifecycle](/img/docs/for-developers/timing/infinites/infinite-lifecycle.png)
![Infinite lifecycle between parents](/img/docs/for-developers/timing/infinites/infinite-lifecycle-levels.png)

## Infinites inserted by AdLibs

The infinite activates when it is entered in the AdLib part, then it behaves identically to its default behavior.
![Infinite AdLibs](/img/docs/for-developers/timing/infinites/infinite-adlibs.png)

## Piece priority

- Normal pieces or lower level infinites can temporarily override a higher level infinite.
  - OnEnd behavior:
    - After the higher priority pieces end the higher level infinite resumes.
  - OnChange behavior:
    - After the higher priority pieces end the infinite is terminated until its starting point is entered again.

![Infinite priority](/img/docs/for-developers/timing/infinites/infinite-priority.png)

## Permanently terminating an infinite

An infinite piece can be permanently terminated by another infinite that has the same or higher content level.
In this case the latest infinite overrides the previous one, because it has the same or higher lifecycle and takes priority like any piece as described above.

Instead of overriding it with a new state terminating an infinite can be achieved by inserting a new infinite with an empty or baseline state.

![Infinite Termination](/img/docs/for-developers/timing/infinites/infinite-termination.png)

## Comprehensive infinites cheat sheet

Everything we outlined in this document can also be found on this cheat sheet for easy reference during development:
![Infinites cheat sheet](/img/docs/for-developers/timing/infinites/cheat-sheet.png)
