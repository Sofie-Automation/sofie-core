# Action Triggers - Client-side

This module is responsible for handling client-side triggers in the Sofie GUI. It reactively tracks the
`TriggeredActions` collection and creates _actions_ for the TriggeredActions objects. These _actions_ are compositions
of underlying actions created by `createAction()` found in `actionFactory.ts`, combining their previews and execution
effects into a single `preview()` reactive function and an event listener that can be directly bound to an event
handler.

## TriggersHandler

This is a React component that is responsible for Meteor subscriptions to the TriggeredActions data as well as
reactively handling the data. It maintains an internal, singular reactive RundownPlaylist context. This is not a React
context, mind you, but rather an action context to be injected into the executed actions and their previews. It also
means that there can be only a single instance of TriggersHandler in a React tree and the component will throw an
exception if an attempt to mount a second one is made.

TriggersHandler is also responsible for setting up and maintaining two client-side (_unmanaged_) collections:
`MountedAdLibTriggers` and `MountedGenericTriggers`. These can be used by other client components to monitor what
actions are mounted to what keys (`MountedGenericTriggers`) and also what AdLibs will be triggered by what keys
(`MountedAdLibTriggers`). `MountedGenericTriggers` just provides a map of keys registered by a given action and the
label assigned to that action, while `MountedAdLibTriggers` also has a `targetId` and `type` fields, which allows
finding out what keys is a given AdLib triggered by.

The component utilizes a Sorensen instance to bind to the hotkeys and uses the same syntax for specifying the key
sequences.

## codesToKeyLabels

This is a utility library file that has conveniance methods for converting key `code` values to the labels on those keys
and vice-versa. The functions require an initialized Sorensen instance.

## ActionAdLibHotkeyPreview

This is a tiny component that will print the hotkeys assigned to an AdLib, given it's ID and type. For _Sticky_ and
_Clear Source Layer_ "virtual AdLibs", a SourceLayer ID should be provided in place of `targetId`. The returned hotkeys
are wrapped in some HTML, allowing targetted styling, and zero-width-space is inserted after each `+` combination
character, as so:

```html
<span class="hotkeys"> <span>Control+&#8203;KeyB</span><span>KeyB</span> </span>
```
