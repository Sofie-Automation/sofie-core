# Sofie Server Core Playout Logic

<!-- All of the server core playout functions run in a lock and cache: [api/playout/lockFunction.ts#L66](./lockFunction.ts#L66) -->

The user functions for playout (server side) are found here: [api/userActions.ts](../userActions.ts)

### How Sofie Creates a Playout Cache

Any cache consists of a set of DBCacheReadObject's, DBCacheWriteObject's, DBCacheReadCollection's, DBCacheWriteCollection's. DBCacheReadObject's and DBCacheWriteObject's can only contain a single object whereas the others can contain multiple objects. The primary function of a cache is to reduce the traffic between Sofie server-core and the MongoDB database, this is done by reading from the database upon initialization and deferring any write operation until "Cache.saveAllToDatabase()" is called.

### How Sofie Creates a Playout Lock

Before any playout operation can proceed a studio and playlist lock must be created. This is done by running the operation in a syncfunction: this is essentially a queue of similar functions that will be executed one by one (sort of like a promise queue). Note that the studio and playlist have separate locks.

### How Sofie Activates a Rundown

- First the studio is prepared for broadcast
  - This calls a function in the playout-gateway/TSR called '`devicesMakeReady`'
- Then the rundown playlist is activated
  - Check that no other rundown playlist in the studio is active
  - Reset the rundown if previously inactive
  - Set activationId and rehearsal mode on the playlist
  - If there is no currently active partInstance, set the first part as next
  - Update the timeline
  - Call the blueprints `onRundownActive` callback

### How Sofie Selects Which Part will be Next

[Definition of a Part](https://sofie-automation.github.io/sofie-core/docs/user-guide/concepts-and-architecture/#part)

From an optional current part instance and a selection of parts and segments Sofie can select the next part:

- If current part is in the set of parts, start searching from the current part and on
- If the segment of the current part is in the set of parts, start searching from the first part in the segment with a rank that is greater than the current part
- If the segment of the current part is in the set of segments, look for the next segment. If there is no next segment we are at the end of the rundown (search from n + 1)
- If all else fails start to search from the beginning of the rundown

At this point there are 2 more edge cases to account for, when a segment is queued and when the playlist loops. To account for the former, we see if the nextPart (if we found one) has a different segmentId from the current part. If so, we search for the first playable part in the queued segment. For looped playlists we first see if any nextPart has been found, if not we search again starting from the start of the playlist up to the current part.

### How Sofie Sets a Part as Next

_Prerequisites: rundown playlist is active and there is no current hold_

- Get the raw part from the partId
- Check that part is in playlist
- Reuse part instance if possible
  - If raw part from step 1 has a '`playlistActivationId`' (hence already is a part instance)
  - If part instance for the same part was set as next previously
- Else create a part instance
  - Set `segmentPlayoutId` from the current part or create a new one if it's a different segment
  - Fetch pieces that may be active for part
  - Get piece instances from the possibly active pieces
- Reset any previous part instances and piece instances by setting `instance.reset = true`
- Reset parts and piece instances after the current part in the segment (or the entire segment if the current part isn't in this segment)
- Clean up any orphaned segments and part instances when they are done playing
  - Note that this is classed as an ingest operation therefore done outside the playout lock

### How Sofie Removes Orphaned Segments and Part Instances

<!-- [https://github.com/Sofie-Automation/sofie-core/blob/release35/meteor/server/api/playout/lib.ts#L442](https://github.com/Sofie-Automation/sofie-core/blob/release35/meteor/server/api/playout/lib.ts#L442) -->

- Gather segments that have `orphaned === 'deleted'`
- Find the part instances from the orphaned segment
- If part instance isn't current or next, queue the segment for removal
- Outside the playout lock, inside a ingest lock, check the orphaned segments again for removal (_why?)_
- Queue part instances for removal

### How Sofie Executes a Take

_Prerequisites: previous take must be over 1000ms (configurable on a per-studio basis) ago, playlist must be active, there must be a next part instance, any transitions in the current part must be finished, any autonext must be over 1000ms ahead, current time is after blockTakeUntil from the current part_

- Load the showstyle blueprints
- If hold state is COMPLETE, then clear the hold state (set to NONE)
- If hold state is Active, complete the hold (to document)
- Select the next part after the current next (but don't set it as next yet)
- Run blueprint pretake function
- Run blueprint.getEndStateForPart
- on the current part instance
  - Set isTaken = true
  - calculate the current preroll/delay timings for the part and store it
- Update the playlist with the new previous and current part instance and the hold state
  - If hold state is missing, set to none or active: update to be None
  - Otherwise +1 the hold state (going from pending to active, or active to complete)
- Update the next and previous part instance with timings
- resetPreviousSegmentAndClearNextSegmentId: reset previous segment during autonext if the playlist is looping

- Set the previously selected next part as actually next part

- Start hold if hold state is ACTIVE
- Update the timeline

- Defer till after playout is settled: call `IngestActions.notifyCurrentPlayingPart` for the current playing part if `shouldNotifyCurrentPlayingPart` is true
- afterTakeUpdateTimingsAndEvents

- Defer till just before saveAllToDb is called:
  - Set part instance timings.takeDone
  - Simulate playout if no gateway is assigned to the studio
  - Call blueprints.onRundownFirstTake if this is the first take (and not an untimed part)
  - Call blueprints.onPostTake

### How Sofie Plays an AdLib

_Prerequisites: an active playlist, currently not in hold, a currently playing part_

- Find the adlib and check that it is not invalid or floated
- If the adlib is to be queued
  - Create a new PartIntance in the segment
  - Convert the ad lib to a piece instance
    - Create a new piece instance in the part instance
    - Set up the infinite properties
    - Prefix the timeline object id's with the piece id
    - Get the following part
    - Set a rank between the current and the following part
    - Insert the part instance
    - Set all related piece instances as dynamically inserted and insert them
    - Update part instance ranks
    - Insert any infinites that the adlibbed part needs to inherit
    - Set the adlib part as next
- If the adlib is to be inserted in the current part

  - Label the piece as dynamic
  - Set up infinite properties
  - Insert the piece instance

- Sync playhead infinites for next part instance
  - Process and prune
- Update the timeline

### How Sofies Executes an AdLib Action

_prerequisites: activated playlist & a current part instance_

- Create ActionExecutionContext from showstyle and rundown
- Load showstyle blueprint and see that it has a executeAction method
- Call blueprint.executeAction
- If current part state or next part state changed then resync the infinites
- If takeAfterExecute is true, execute a take
- Else only update timeline

### How Sofie Activates/Executea/Deactivates a Hold

_Prerequisites for activate: active playlist, current part, next part and hold state is None or undefined_

- Get current and next part instance
- Current part instance should have a PartHoldMode.FROM and next part instance a PartHoldMode.TO
- Check that no adlibs have been used
- Set the playlist hold state to PENDING
- Update the timeline

_Prerequisites for deactivate: hold state is Pending_

- Set the playlist hold state to NONE
- Update the timeline

### How Sofie Reset a Rundown

_Prerequisite: deactivated rundown, or in rehearsal mode, or Settings.allowRundownResetOnAir is true_

- Remove part instances that were created in rehearsal mode
- Remove piece instances that are attached to the removed part instances
- Reset part instances and piece instances (that weren't already removed)
- Reset the playlist
- If rundown is active, create a new rundown id and select the first part and set it as next
- Else, set the next part to null

### How Sofie Deactivates a Rundown

- Call playout gateway devicesStandDown
- Get part instances from Cache
- Defer till after save: notify ingest system of current playing part set to null
- Update the as played duration of the current part
- Update the playlist (i.e. unset activation id)
- Set the next part to null
- Set the take out time of the current part
- Update studio timeline
- Call blueprint.onRundownDeActivate

### How Sofie Creates the Timeline for Playout from the Data Structures it has

- Lookahead objects
- Part groups > Piece instances (excluding infinites)
- Infinites
- Baseline timeline

- Get rundown timeline objects

  - Get the current, next and previous part instance
  - Get the showstyle (compound from base and variant) and fetch the showstyle blueprints
  - Get the processed and pruned piece instances
    - Group pieces by exclusivity group or source layer
    - Group pieces inside the group/layer by start
    - Per group, find piece instances on infinite layers
      - This groups the piece instances into different types of infinites as well as non-infinites
    - Update with the newly found piece instances
      - todo: there seems to be some magic involved here
    - Strip any pieces that start and end at the same time (start == end)
  - Get the lookahead objects
  - Get the rundown baseline items and transform into timeline
  - Build the timeline from piece instances
    - Add a rundown status timeline object
    - Separate the pieces from the current part into infinites and normal pieces
    - Create enable object for the current part (with duration if autonext and start with partInstance.startedPlayback)
    - Create timeline group for the current part
    - If there is a previous part instance, create a timeline group for it with endTime currentPart.start + overlap and priority -1
    - Remove infinites that are in the current part from the previous one's timeline group
    - Transform the previous part into a timeline
    - For every infinite piece in the current part
      - Create a part group for the infinite
      - Add classes 'current_part' and 'continues_infinite' if appropriate
      - Set the start of the group to the infinite piece's start time if it has one, else use the current part's start time
      - Also overwrite the duration if userDuration has been set
      - If the infinite continues to the next part and has a duration, copy that duration into the current part
      - If the piece doesn't continue in the next part but the current part has autonext, set it to end in the current part explicitly
      - Transform the infinite part group into a timeline and add it
    - Transform the remainder of the current part into a timeline (without infinites)
    - If the current part has autoNext enabled, add the next part to the timeline as well
  - Add the lookahead timeline and baseline timeline
  - If the blueprints implement the onTimelineGenerate method
    - Get resolved pieces for all objects on the timeline
      - Fetch all piece instances that could be on the timeline
      - Look at metadata to collect all timeline piece groups
      - Resolve that collection of timeline objects (with the timeline library)
      - Take the timings from the timeline resolving result and add them to the piece instances
    - Call onTimelineGenerate
    - Set the timeline to the result of onTimelineGenerate
    - Update the persistent state and tracked AB sessions

- Process and save timeline

**_What does a typical part group look_** _**like**:_

- For every piece instance, if the piece instance is not disabled or part of a transition while a transition is not allowed
  - create a piece group with the correct duration
    - correct duration is left undefined in this document
  - add first timeline object with the piece callbacks
  - add timeline objects to piece group if they are allowed by the hold state
  - prefix the timeline object's id by the piece instance's id
