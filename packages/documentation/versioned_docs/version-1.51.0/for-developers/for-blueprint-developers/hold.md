# Hold

_Hold_ is a feature in Sofie to allow for a special form of take between two parts. It allows for the new part to start with some portions of the old part being retained, with the next 'take' stopping the remaining portions of the old part and not performing a true take.

For example, it could be setup to hold back the video when going between two clips, creating what is known in film editing as a [split edit](https://en.wikipedia.org/wiki/Split_edit) or [J-cut](https://en.wikipedia.org/wiki/J_cut). The first _Take_ would start the audio from an _A-Roll_ (second clip), but keep the video playing from a _B-Roll_ (first clip). The second _Take_ would stop the first clip entirely, and join the audio and video for the second clip.

![A timeline of a J-Cut in a Non-Linear Video Editor](/img/docs/video_edit_hold_j-cut.png)

## Flow

While _Hold_ is active or in progress, an indicator is shown in the header of the UI.
![_Hold_ in Rundown View header](/img/docs/rundown-header-hold.png)

It is not possible to run any adlibs while a hold is active, or to change the nexted part. Once it is in progress, it is not possible to abort or cancel the _Hold_ and it must be run to completion. If the second part has an autonext and that gets reached before the _Hold_ is completed, the _Hold_ will be treated as completed and the autonext will execute as normal.

When the part to be held is playing, with the correct part as next, the flow for the users is:

- Before
  - Part A is playing
  - Part B is nexted
- Activate _Hold_ (By hotkey or other user action)
  - Part A is playing
  - Part B is nexted
- Perform a take into the _Hold_
  - Part B is playing
  - Portions of Part A remain playing
- Perform a take to complete the _Hold_
  - Part B is playing

Before the take into the _Hold_, it can be cancelled in the same way it was activated.

## Supporting Hold in blueprints

:::note
The functionality here is a bit limited, as it was originally written for one particular use-case and has not been expanded to support more complex scenarios.
Some unanswered questions we have are:

- Should _Hold_ be rewritten to be done with adlib-actions instead to allow for more complex scenarios?
- Should there be a way to more intelligently check if _Hold_ can be done between two Parts? (perhaps a new blueprint method?)
  :::

The blueprints have to label parts as supporting _Hold_.
You can do this with the [`holdMode`](https://sofie-automation.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.IBlueprintPart.html#holdMode) property, and labelling it possible to _Hold_ from or to the part.

Note: If the user manipulates what part is set as next, they will be able to do a _Hold_ between parts that are not sequential in the Rundown.

You also have to label Pieces as something to extend into the _Hold_. Not every piece will be wanted, so it is opt-in.
You can do this with the [`extendOnHold`](https://sofie-automation.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.IBlueprintPiece.html#extendOnHold) property. The pieces will get extended in the same way as infinite pieces, but limited to only be extended into the one part. The usual piece collision and priority logic applies.

Finally, you may find that there are some timeline objects that you don't want to use inside of the extended pieces, or there are some objects in the part that you don't want active while the _Hold_ is.
You can mark an object with the [`holdMode`](https://sofie-automation.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.TimelineObjectCoreExt.html#holdMode) property to specify its presence during a _Hold_.
The `HoldMode.ONLY` mode tells the object to only be used when in a _Hold_, which allows for doing some overrides in more complex scenarios.
