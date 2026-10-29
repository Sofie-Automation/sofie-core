---
title: Rundown Timing
sidebar_position: 13
---

Sofie calculates all rundown timing on the server. It publishes the result as the `playlistTimingState` publication.
The screens and the Live Status Gateway show the same published values. A client calculates only a few values
itself: the T-timers, the clip and freeze countdowns, and the on-air timers for a moment right after a take.

The timing rules are complex. For example, the duration of a Part can come from four sources: its as-played
duration, its expected duration with its transition, its part of a display-duration group, or the default of the
Studio. Countdowns add up in playout
order, and QuickLoop can change that order. A segment budget changes several rules. A copy of these rules in each
client does not stay the same as the others.

## TimerState

A value that moves with the clock is published as a `TimerState`. A `TimerState` tells how the value moves, with
absolute unix timestamps. The client calculates the value from its own clock. Thus the value is correct to the
millisecond, and the server sends a new state only at a playout event.

```ts
type TimerState =
	| { paused: false; zeroTime: number; pauseTime?: number | null; resumesAt?: null }
	| { paused: true; duration: number; pauseTime?: null; resumesAt?: number | null }
```

- A running timer counts down to `zeroTime`. If it has a `pauseTime`, it stops at that time. For example, the
  remaining duration stops when the on-air Part passes its planned end.
- A paused timer holds at `duration`. If it has a `resumesAt`, it starts to run at that time. For example, after a
  take in a multi-gateway studio, the Part starts a moment later.

A state has not more than one of these changes. For a value with more changes, the server publishes a new state
between them.

These functions in
[`corelib/src/dataModel/TimerState.ts`](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/TimerState.ts)
read a state:

| Function                           | Result                                                         |
| ---------------------------------- | -------------------------------------------------------------- |
| `timerStateToDuration(state, now)` | The milliseconds that remain. Use it for a countdown.          |
| `timerStateToZeroTime(state, now)` | The time at which the value is zero. Use it for a time of day. |
| `offsetTimerState(state, ms)`      | The same state, moved by a constant number of milliseconds.    |

**A value that counts up is negative**. The duration of a `TimerState` can hold or decrease, but it cannot increase.
Thus Sofie publishes each value that counts up as a negative value that decreases. These are `played`, `playedOut`,
`duration` of a Part, and `liveDisplayDuration`. The elapsed time is `0 - timerStateToDuration(state, now)`.

## The publication

`playlistTimingState` sends three types of document. The field `type` tells the type. Include `type` in each
projection. The file
[`corelib/src/dataModel/TimingState.ts`](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/TimingState.ts)
gives each field.

| `type`     | One document for each | Fields                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `playlist` | playlist              | The header timers `plannedStart`, `plannedEnd`, `plannedDuration`, `startedPlayback`, `remainingDuration`, `estimatedEnd` and `overUnder`. The on-air timers `remainingOnCurrentPart` and `remainingBudgetOnCurrentSegment`, and `currentPartInstanceId` and `currentSegmentId`, which tell which Part and segment these timers are about. `partCountdownBase`. The fields `timingType` and `currentPartWillAutoNext`. |
| `segment`  | segment               | `plannedDuration`, `playedOut`, `remaining` and `countdownType`.                                                                                                                                                                                                                                                                                                                                                       |
| `part`     | Part                  | The resolved `expectedDuration` and `displayDuration`, which do not move. `duration`, `played` and `liveDisplayDuration`, which count up. `countdownOffset`. `rank`, the playout order. The flags `isInQuickLoop`, `countsTowardsTiming`, `untimed` and `orphaned`.                                                                                                                                                    |

**The part countdown** is the `partCountdownBase` of the playlist, moved by the `countdownOffset` of the Part. In
Sofie code:

```ts
import { offsetTimerState, timerStateToDuration } from '@sofie-automation/corelib/dist/dataModel/TimerState'

if (partDoc.countdownOffset !== undefined) {
	const countdown = offsetTimerState(playlistDoc.partCountdownBase, partDoc.countdownOffset)
	const millisecondsUntilOnAir = timerStateToDuration(countdown, Date.now())
}
```

- Read the base and the offset from the same set of documents. The publication sends them together.
- If a Part has no `countdownOffset`, it will probably not play when the rundown plays in order. Show no countdown
  for it.
- A take moves only the base. The offsets of the Parts that are still to come do not change. Thus a take changes
  about 10 documents, for any number of Parts.

**Totals**. The totals of a segment and of a playlist do not include untimed Parts and orphaned Parts. An orphaned
Part is a Part that an adlib made, or a Part that was removed from the rundown after it was queued or played. If you
add the durations of Parts, do not include these Parts.

If you cannot make a value from the documents, add a field to the publication. Do not calculate the value in a
client.

## Reading the timing

### From an external client

You must have only these items:

1. The three functions above, about 25 lines together. `@sofie-automation/corelib` is not published as a package,
   so copy the functions to your code.
2. For the positions of the Parts in a segment: add the elapsed values of `liveDisplayDuration` of the Parts of the
   segment, in `rank` order. The elapsed value is `0 - timerStateToDuration(liveDisplayDuration, now)`. Positions are
   necessary only in a segment, not in the full playlist.

You do not have to copy the duration rules, display-duration groups or QuickLoop. Use the values from the documents.

### Through the Live Status Gateway

The Live Status Gateway is the supported route for an external system. It puts the published values on its topics:

| Topic              | Field                                                                          |
| ------------------ | ------------------------------------------------------------------------------ |
| `activePlaylist`   | `timing.remainingDuration`, `timing.estimatedEnd`, `timing.timeInHand`         |
| `activePlaylist`   | `currentSegment.timing.playedOut`, `currentSegment.timing.remaining`           |
| `segments`         | `timing.playedOut`, `timing.remaining` of each segment                         |
| `resolvedPlaylist` | `rundownTiming` of each Part: the resolved durations, `countdown` and `played` |

- The timers are `TimerState`s. In `rundownTiming`, `expectedDurationMs` and `displayDurationMs` are plain
  milliseconds, because they do not move. `duration` and `liveDisplayDuration` are `TimerState`s that count up.
- `timeInHand` is the published `overUnder`. It is positive when the show is early.
- The gateway makes the `countdown` of each Part from the base and the offset.
- In the generated TypeScript types, each `TimerState` has `paused: boolean`. Use `'zeroTime' in state` to find the
  type of a state.
- The `expectedDurationMs` of a segment is the length of its content. It is not the budget. The budget is in
  `budgetDurationMs`.

See also [Live Status Gateway API 3.0.0](#live-status-gateway-api-300).

### In the Sofie web UI

The hooks are in
[`webui/src/client/ui/RundownView/RundownTiming/usePlaylistTimingValue.ts`](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/webui/src/client/ui/RundownView/RundownTiming/usePlaylistTimingValue.ts):

```ts
usePlaylistTimingValue(playlistId, 'remainingDuration', TimerValueMode.Duration)
useSegmentTimingValue(segmentId, 'remaining', TimerValueMode.Duration)
usePartTimingValue(partId, 'played', TimerValueMode.CountUp)
usePartCountdownValue(partId, TimerValueMode.Duration)
useSegmentPartTimings(segmentId) // the Parts of a segment, with their positions
```

- Each hook returns a number, or `null` when there is no published timer. `usePartCountdownValue` also returns `null`
  for a Part with no `countdownOffset`. `useSegmentPartTimings` returns a `Map`. The mode `TimerValueMode.CountUp`
  changes the sign of a value that counts up.
- The hook calculates the number again when a new state arrives, and on the timing ticks of
  `RundownTimingProvider`. Each screen that shows a playlist has a `RundownTimingProvider`.
- The default tick resolution is `Synced`. The hook checks the value on each high-resolution tick (60 Hz). It draws
  the component again only when the whole second of the value changes. Thus each countdown changes at its own second.
  Most values count from the start of a Part, which is some milliseconds after the take. A value that holds is not
  drawn again. New data is read at the time it arrives.
- `useTimingNow` gives the time of the clock. It ticks at each whole second of the clock.

A component that shows a number of its own must also change at the second of that number:

- A published timer and a constant, for example `clipEnd - played`: give the hook the option
  `drawnAs: (played) => clipEnd - played`. This option has an effect only with the `Synced` resolution.
- The clock and a constant, for example the time until the end of a clip: use
  `useClockValue((now) => clipEnd - now)`. Do not read `getCurrentTime()` in the render, because then the component
  is not drawn again when the second changes.

For good performance:

- `useSegmentPartTimings` ticks only while a Part of the segment moves with the clock, which is the on-air Part. Each
  call is a live query. Call it one time for each segment, and give the result to the Parts.
- For a value that holds most of the time, set `tickResolutionWhileHolding: TimingTickResolution.None`.
- Use `usePlaylistTimingField` for `timingType` and `currentPartWillAutoNext`, and `usePartTimingField` for `rank`,
  `isInQuickLoop` and `countsTowardsTiming`. They do not tick.

A component that shows one specific Part sets `forPartInstanceId` when it reads an on-air timer. Then the hook never
gives the value of a different Part. Right after a take, the screen has the new Part on air before its timing
arrives. For that moment, the hook gives the value that the server will publish for a Part that was just taken. For a Part
in a display-duration group with no length of its own, it gives `null` for that moment. At other times, when the
on-air timers are about a different Part, the hook gives `null`.

## Live Status Gateway API 3.0.0

This section gives the changes from API version 2.0.1. In 2.0.1, the gateway calculated its own timing. In 3.0.0, it
uses the values of `playlistTimingState`. The other timing fields do not change.

### Fields with a new meaning

| Field                                                                        | In 2.0.1                                                                                                                                                                                 | In 3.0.0                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activePlaylist` `currentPart.timing.startTime`                              | The start that the playout gateway reported. Before that report, the planned start.                                                                                                      | The planned start of the Part (`plannedStartedPlayback`). Sofie's countdowns count from it. While the Part has no planned start, the send time. In multi-gateway mode, the take sets it a moment ahead, so right after a take it is in the future. |
| `currentPart.timing.expectedDurationMs`                                      | The expected duration set on the Part, without its transition.                                                                                                                           | The length that Sofie calculates: the expected duration with its transition; else the played duration after the Part played; else its part of its display-duration group; else 0. Never the Studio default.                                        |
| `currentPart.timing.projectedEndTime`                                        | `startTime` plus the expected duration set on the Part, without its transition. For a Part in a display-duration group with no length of its own: the group total minus the played time. | The time at which the On Air countdown is zero. When the start is known, this is the start plus the countdown length. Until then, it is the send time plus that length. With no timing yet, it is `startTime` plus `expectedDurationMs`.           |
| `currentSegment.timing.projectedEndTime`                                     | Calculated from the start of the on-air Part, or from the start of the segment if it has a budget.                                                                                       | The time at which the `remaining` timer of the segment is zero. While that timer is paused, it is the send time plus the time that remains, or `resumesAt` plus the time that remains. With no timing yet, it is the send time.                    |
| `timing.expectedDurationMs` of a segment, on `segments` and `currentSegment` | The sum of the lengths set on the Parts, with their transitions.                                                                                                                         | The sum of the lengths that Sofie calculates. It can change during the show, for example in a display-duration group. As before, it does not include untimed, adlibbed and removed Parts.                                                          |
| `timing.countdownType` of a segment                                          | An unknown value was sent as it is.                                                                                                                                                      | Absent for a value that the API does not know.                                                                                                                                                                                                     |
| A paused `TimerState`                                                        | It always holds.                                                                                                                                                                         | It can have `resumesAt`. Then it holds until that time and then counts down. Calculate it as the functions above do. The schema gives the rule.                                                                                                    |

### New fields

| Topic                                         | Field                                                                  | Notes                                                                                                                                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activePlaylist`                              | `timing.remainingDuration`, `timing.estimatedEnd`, `timing.timeInHand` | The header timers. `null` when no playlist is active, and until the timing arrives. `timeInHand` is also `null` in the `none` timing mode with no planned duration and no playback. |
| `segments`, `activePlaylist` `currentSegment` | `timing.playedOut`, `timing.remaining`                                 | Absent until the timing arrives.                                                                                                                                                    |
| `resolvedPlaylist`                            | `rundownTiming` of each Part                                           | `expectedDurationMs`, `displayDurationMs`, `isInQuickLoop`, `countsTowardsTiming`, and the timers `countdown`, `played`, `duration` and `liveDisplayDuration`.                      |
| All topics with a `TimerState`                | `resumesAt`                                                            | See the last row of the table above.                                                                                                                                                |

### Other changes

- **Strict validation**. The 2.0.1 schema does not let `activePlaylist` `timing` have more fields. Thus a client
  that checks each `activePlaylist` message against the 2.0.1 schema refuses the 3.0.0 messages. Use the 3.0.0 schema.
  The messages of the other topics pass a 2.0.1 check. The generated TypeScript types get only new optional fields.
- **No version in the messages**. The API version is only in the schema. A 3.0.0 gateway always sends the key
  `activePlaylist.timing.remainingDuration`, also when its value is `null`. A 2.0.1 gateway never sends it.
- **Fewer messages**. A topic does not send all subscribers a copy of a message that they all have. A new subscriber
  still gets the current message. `packages` still sends each message. Use the heartbeat to know that the
  connection is alive, not the messages.
- **Messages at timing changes**. `activePlaylist`, `resolvedPlaylist` and `segments` send a message when the
  published timing changes. Thus `segments` now also sends at each take and at each start report.
- **Larger `resolvedPlaylist` messages**. Each Part now has `rundownTiming`. See [Known limitations](#known-limitations).

### Upgrading and rolling back

| Gateway | Core                          | Result                                                                                                                                                                                                                                                                                                         |
| ------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.0.0   | With `playlistTimingState`    | All values.                                                                                                                                                                                                                                                                                                    |
| 3.0.0   | Without `playlistTimingState` | The gateway logs a failed subscription. It tries again only when a different playlist, or no playlist, is active, or when the gateway starts again. Until then, it sends 0 for each `expectedDurationMs`, `null` for the playlist timers, zeros and `false` in `rundownTiming`, and no segment or Part timers. |
| 2.0.1   | With `playlistTimingState`    | As before, with the same data as before.                                                                                                                                                                                                                                                                       |

Upgrade the core first, then start the gateway again. A gateway that started before the core upgrade keeps empty
timing values while the same playlist stays active. Sofie stores no new data, so there is no migration. To roll
back, go back to the earlier version.

## Differences from earlier versions

In earlier versions, each browser calculated the timing, and the gateway had its own calculation. The unit test
`__tests__/timing/comparisonWithMain.test.ts` is in the folder of the publication. It compares each value of the
screens and of the gateway with the formulas of the earlier version, in all timing modes. It lists each difference, and it
fails on a difference that is not on its list. The full table is `comparisonWithMain.txt`, next to the test.

### Values

| Case                                                                         | Before                                                                                                                       | Now                                                                                                                                   |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| A back-timed playlist after deactivation                                     | The over/under moved with the clock.                                                                                         | The over/under compares the played duration with the planned duration, and holds.                                                     |
| A take in multi-gateway mode, until the Part starts                          | The remaining duration held. The estimated end and the over/under moved with the clock.                                      | The remaining duration includes the wait until the start. The estimated end and the over/under hold at their values at the start.     |
| A Part in a display-duration group with no length of its own, on the gateway | 0                                                                                                                            | Its part of the group. The segment total includes it.                                                                                 |
| A retake, on the gateway                                                     | `currentSegment.timing.projectedEndTime` counted the Part one time.                                                          | It counts the Part two times, as the segment header does.                                                                             |
| An auto-next in multi-gateway mode, before the start report                  | The remaining duration did not include the next Part, and the segment counted the time two times. This changed on each tick. | The remaining duration and the countdowns hold, and the segment counts the time one time. The values agree again at the start report. |

### On the screens

- **Each countdown changes at its own second**. Before, a countdown changed at the whole second of the clock. A Part
  starts some milliseconds after its take. Thus a countdown showed 1 s too much for most of each second.
- **Rounding**. The time that remains rounds up, also in its last 0.1 s. Past zero, a countdown shows 00:00 for one
  second, then +00:01. A time that counts up rounds down, as a stopwatch does. Late on the over/under chip rounds
  down: up to 1 s late shows +00:00.
- **Right after a take**, the on-air countdowns show the planned length of the new Part until its timing arrives. A
  Part in a display-duration group with no length of its own shows no On Air for that moment.
- **The over/under chip** on the Presenter screen and the prompter shows the same value as the header. Where the
  header shows nothing, the chip shows nothing. The chip on the Director screen shows 00:00 when no value is
  published.
- **Values hold between playout events**. Before, each value was calculated on each tick. Now these values do not
  move as before:
  - the later Parts of a display-duration group: when the on-air Part of the group overruns, they become shorter in
    one step at each new calculation, not all the time;
  - when the playout gateway does not report a start: the played time of the Part before and of its segment, the
    estimated end and the over/under.
- **Countdowns that a screen makes itself** also change at their own second: the freeze countdowns on the Presenter
  and Director screens, and the clip countdown and the Part duration in the storyboard and on the camera screen.

## Known limitations

- **Just after a take, some values can be wrong for about 0.1–0.3 s**. In a late show, the estimated end and the
  over/under can go one second on and back. Near zero, the over/under chip can change between −00:00, +00:00 and
  −00:01. The gateway can hold the remaining time of the on-air segment for about 0.1 s after a take in the segment.
- **Just after a take, the gateway can send old values**. Until the timing for the new Part arrives,
  `currentPart.timing.projectedEndTime` can be the end of the Part before. One message can also have Part
  countdowns that are wrong. The next message has the correct values.
- **Before the timing arrives, the gateway sends zeros**. The first message after the activation of a playlist can
  have zeros. See the row "3.0.0, without `playlistTimingState`" in
  [Upgrading and rolling back](#upgrading-and-rolling-back).
- **`resolvedPlaylist` is large at scale**. Each message has the timing of each Part. At 1,000 Parts, each message is
  about 1.2 MB, and a take sends about 3.5 MB to each client. The first `activePlaylist` message after a take comes
  about 4 s after the take, behind the `resolvedPlaylist` messages. At 300 Parts, it comes after about 0.15 s.
- **A Part in a retake has one timing document**. The document describes the PartInstance with the highest take
  count. When the operator sets the on-air Part as Next again, its document describes the queued play.
- **An adlib or a retake changes all later Part documents**, because the `rank` of each later Part changes.
- **A failed PartInstances subscription is not tried again** until the activation changes, a rundown is added or
  removed, or the publication starts again. Until then, the timing does not follow playout.
- **A segment budget does not count down on the last segment**. Its `remaining` holds at the full budget.

:::info Planned improvements

- **T-timers.** The T-timers get the same rules as the other countdowns: each changes at its own second, with the
  same rounding.
- **A reference client for the Live Status Gateway.** A small library that reads the timer states and applies the
  display rules of the Sofie UI. Then a client does not have to copy code from Sofie.
- **The gateway at scale.** The timing of each Part in its own topic, and `activePlaylist` before `resolvedPlaylist`.
  Then a take sends less data, and the on-air timers arrive sooner.
- **The moments around a take.** No short wrong values just after a take.

:::

## Where the code is

- `corelib/src/dataModel/TimerState.ts`: the state type and its functions.
- `corelib/src/dataModel/TimingState.ts`: the published documents.
- `sofie-core/src/publications/playlistTimingState/`: the publication. The calculator is in `rundownTiming/`. This
  code is in the `sofie-core` package, which the web UI does not use.
- `corelib/src/playout/rundownTiming.ts`: the formulas for the remaining duration and the estimated end.
- `webui/src/client/ui/RundownView/RundownTiming/`: the hooks for the web UI.
- Tests: `__tests__/` in the folder of the publication, and `__tests__/` next to the hooks. `takeChurn.test.ts` checks
  which documents a take changes.
