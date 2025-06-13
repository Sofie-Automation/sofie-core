# Action Triggers - Library

This module is responsible for providing action compilation and execution facilities to any other modules that will
trigger Actions. Right now, only the client-side triggers are implemented and thus the only user of this module is
`TriggersHandler` React component and the Settings GUI components for creating Action Triggers.

## actionFactory

This is a factory creating _ExecutableAction_ objects as described in the `DBTriggeredActions.actions[]` items objects.
An Action object always has an `.execute()` method and may also optionally implement a `.preview()` reactive variable
that will return an array of `IWrappedAdLib` objects. The `IWrappedAdLib` interface is a useful abstraction of various
AdLib objects present in the Sofie system that are ultimately presented to the user as a homogenized AdLib object. These
include Rundown and RundownBaseline AdLibs and AdLib Actions, Source Layer Clear actions and Sticky Source Layer AdLibs.

> I would strongly suggest reworking the entire Shelf system to also use this IWrappedAdLib and replace the awful and
> hackish AdLibPieceUi that is plagueing the Shelf and making everything complicated and ugly. -- Jan Starzak,
> 2021-08-31

An action takes a `ActionContext` context object that describes the context in which a given action is being executed.
This allows to limit the amount of reactivity and observers registed onto collections, while still allowing `.preview()`
to be fully reactive within a given context.

## actionFilterChainCompilers

In order for an Action description (`DBTriggeredActions.action[]`) to be executed, it needs to be converted into an
`ExecutableAction` object. The action depends on the context it is going to be running in and a `filterChain[]`
description of what particular objects a given action should target. This filter chain generally needs to be compiled
into a simple reactive function that registers a minimal amount of observers on collections and/or does a minimal amount
of DB operations. In order to make that step as quick as possible and fetch as little data as possible, the
`actionFilterChainCompilers` converts the `filterChain[]` into a reactive function that then can be executed within a
context. What sort of a context is neccessary depends on the Action type.

## universalDoUserActionAdapter

Because the idea for Action Triggers is that it allows setting up both client- and server-side triggers, a unified way
of executing methods was neccessary. `universalDoUserActionAdapter` provides an isometric implementation of
`doUserAction` that works both client- and server-side.
