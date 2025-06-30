---
sidebar_position: 1
---

# Concepts & Architecture

## System Architecture

![Example of a Sofie setup with a Playout Gateway and a Spreadsheet Gateway](/img/docs/main/features/playout-and-spreadsheet-example.png)

### Sofie Core

**Sofie&nbsp;Core** is a web server which handle business logic and serves the web GUI.  
It is a [NodeJS](https://nodejs.org/) process backed up by a [MongoDB](https://www.mongodb.com/) database and based on the framework [Meteor](http://meteor.com/).

### Gateways

Gateways are applications that connect to Sofie&nbsp;Core and and exchanges data; such as rundown data from an NRCS or the [Timeline](#timeline) for playout.

An examples of a gateways is the [Spreadsheet Gateway](https://github.com/SuperFlyTV/spreadsheet-gateway).  
All gateways use the [Core Integration Library](https://github.com/nrkno/sofie-core/tree/master/packages/server-core-integration) to communicate with Core.

## System, \(Organization\), Studio & Show Style

To be able to facilitate various workflows and to Here's a short explanation about the differences between the "System", "Organization", "Studio" and "Show Style".

- The **System** defines the whole of the Sofie&nbsp;Core
- The **Organization** \(only available if user accounts are enabled\) defines things that are common for an organization. An organization consists of: **Users, Studios** and **ShowStyles**.
- The **Studio** contains things that are related to the "hardware" or "rig". Technically, a Studio is defined as an entity that can have one \(or none\) rundown active at any given time. In most cases, this will be a representation of your gallery, with cameras, video playback and graphics systems, external inputs, sound mixers, lighting controls and so on. A single System can easily control multiple Studios.
- The **Show Style** contains settings for the "show", for example if there's a "Morning Show" and an "Afternoon Show" - produced in the same gallery - they might be two different Show Styles \(played in the same Studio\).

![Sofie Architecture Venn Diagram](/img/docs/main/features/sofie-venn-diagram.png)

## Playlists, Rundowns, Segments, Parts, Pieces

![Playlists, Rundowns, Segments, Parts, Pieces](/img/docs/main/features/playlist-rundown-segment-part-piece.png)

### Playlist

A Playlist \(or "Rundown Playlist"\) is the entity that "goes on air" and controls the playhead/Take Point.

It contains one or several Rundowns inside, which are playout out in order.

:::info
In some many studios, there is only ever one rundown in a playlist. In those cases, we sometimes lazily refer to playlists and rundowns as "being the same thing".
:::

A Playlist is played out in the context of it's [Studio](#studio), thereby only a single Playlist can be active at a time within each Studio.

A playlist is normally played through and then ends but it is also possible to make looping playlists in which case the playlist will start over from the top after the last part has been played.

### Rundown

The Rundown contains the content for a show. It contains Segments and Parts, which can be selected by the user to be played out.  
A Rundown always has a [showstyle](#showstyle) and is played out in the context of the [Studio](#studio) of its Playlist.

### Segment

The Segment is the horizontal line in the GUI. It is intended to be used as a "chapter" or "subject" in a rundown, where each individual playable element in the Segment is called a [Part](#part).

### Part

The Part is the playable element inside of a [Segment](#segment). This is the thing that starts playing when the user does a [TAKE](#take-point).  
The Part in itself doesn't determine what's going to happen, that's handled by the [Pieces](#piece) in it.

### Piece

The Pieces inside of a Part determines what's going to happen, the could be indicating things like VT:s, cut to cameras, graphics, or what script the host is going to read.

Inside of the pieces are the [timeline-objects](#timeline-object) which controls the playout on a technical level.

:::tip
Tip! If you want to manually play a certain piece \(for example a graphics overlay\), you can at any time double-click it in the GUI, and it will be copied and played at your play head, just like an [AdLib](#adlib-pieces) would!
:::

See also: [Showstyle](#showstyle)

### AdLib Piece

The AdLib pieces are Pieces that isn't programmed to fire at a specific time, but instead intended to be manually triggered by the user.

The AdLib pieces can either come from the currently playing Part, or it could be _global AdLibs_ that are available throughout the show.

An AdLib isn't added to the Part in the GUI until it starts playing, instead you find it in the [Shelf](#shelf).

## Views

Being a web-based system, Sofie has a number of customisable, user-facing web [views](features/sofie-views.mdx) used for control and monitoring.

## Blueprints

Blueprints are plug-ins that run in Sofie&nbsp;Core. They interpret the data coming in from the rundowns and transform them into a rich set of playable elements \(Segments, Parts, AdLibs etc\).

The blueprints are webpacked javascript bundles which are uploaded into Sofie via the GUI. They are custom-made and changes depending on the show style, type of input data \(NRCS\) and the types of controlled devices. A generic [blueprint that works with spreadsheets is available here](https://github.com/SuperFlyTV/sofie-demo-blueprints).

When [Sofie&nbsp;Core](#sofie-core) calls upon a Blueprint, it returns a JavaScript object containing methods callable by Sofie&nbsp;Core. These methods will be called by Sofie&nbsp;Core in different situations, depending on the method.  
Documentation on these interfaces are available in the [Blueprints integration](https://www.npmjs.com/package/@sofie-automation/blueprints-integration) library.

There are 3 types of blueprints, and all 3 must be uploaded into Sofie before the system will work correctly.

### System Blueprints

Handle things on the _System level_.  
Documentation on the interface to be exposed by the Blueprint:  
[https://github.com/nrkno/sofie-sofie-blueprints-integration/blob/master/src/api.ts\#L52](https://github.com/nrkno/sofie-sofie-blueprints-integration/blob/master/src/api.ts#L52)

### Studio Blueprints

Handle things on the _Studio level_, like "which showstyle to use for this rundown".  
Documentation on the interface to be exposed by the Blueprint:  
[https://github.com/nrkno/sofie-sofie-blueprints-integration/blob/master/src/api.ts\#L57](https://github.com/nrkno/sofie-sofie-blueprints-integration/blob/master/src/api.ts#L57)

### Showstyle Blueprints

Handle things on the _Showstyle level_, like generating [_Baseline_](#baseline), _Segments_, _Parts, Pieces_ and _Timelines_ in a rundown.  
Documentation on the interface to be exposed by the Blueprint:  
[https://github.com/nrkno/sofie-sofie-blueprints-integration/blob/master/src/api.ts\#L72](https://github.com/nrkno/sofie-sofie-blueprints-integration/blob/master/src/api.ts#L72)

## Timeline

### What is the timeline?

The Timeline is a collection of timeline-objects, that together form a "target state", i.e. an intent on what is to be played and at what times.

The timeline-objects can be programmed to contain relative references to each other, so programming things like _"play this thing right after this other thing"_ is as easy as `{start: { #otherThing.end }}`

The [Playout Gateway](../for-developers/libraries.md) picks up the timeline from Sofie&nbsp;Core and \(using the [TSR timeline-state-resolver](https://github.com/nrkno/sofie-timeline-state-resolver)\) controls the playout devices to make sure that they actually play what is intended.

![Example of 2 objects in a timeline: The #video object, destined to play at a certain time, and #gfx0, destined to start 15 seconds into the video.](/img/docs/main/features/timeline.png)

### Why a timeline?

The Sofie system is made to work with a modern web- and IT-based approach in mind. Therefore, the Sofie&nbsp;Core can be run either on-site, or in an off-site cloud.

![Sofie Core can run in the cloud](/img/docs/main/features/sofie-web-architecture.png)

One drawback of running in a cloud over the public internet is the - sometimes unpredictable - latency. The Timeline overcomes this by moving all the immediate control of the playout devices to the Playout Gateway, which is intended to run on a local network, close to the hardware it controls.  
This also gives the system a simple way of load-balancing - since the number of web-clients or load on Sofie&nbsp;Core won't affect the playout.

Another benefit of basing the playout on a timeline is that when programming the show \(the blueprints\), you only have to care about "what you want to be on screen", you don't have to care about cleaning up previously played things, or what was actually played out before. Those are things that are handled by the Playout Gateway automatically. This also allows the user to jump around in a rundown freely, without the risk of things going wrong on air.

### How does it work?

:::tip
Fun tip! The timeline in itself is a [separate library available on github](https://github.com/SuperFlyTV/supertimeline).

You can play around with the timeline in the browser using [JSFiddle and the timeline-visualizer](https://jsfiddle.net/nytamin/rztp517u/)!
:::

The Timeline is stored by Sofie&nbsp;Core in a MongoDB collection. It is generated whenever a user does a [Take](#take-point), changes the [Next-point](#next-point-and-lookahead) or anything else that might affect the playout.

_Sofie&nbsp;Core_ generates the timeline using:

- The [Studio Baseline](#baseline) \(only if no rundown is currently active\)
- The [Showstyle Baseline](#baseline), of the currently active rundown.
- The [currently playing Part](#take-point)
- The [Next:ed Part](#next-point-and-lookahead) and Parts that come after it \(the [Lookahead](#lookahead)\)
- Any [AdLibs](#adlib-pieces) the user has manually selected to play

The [**Playout Gateway**](../for-developers/libraries.md#gateways) then picks up the new timeline, and pipes it into the [\(TSR\) timeline-state-resolver](https://github.com/nrkno/sofie-timeline-state-resolver) library.

The TSR then...

- Resolves the timeline, using the [timeline-library](https://github.com/SuperFlyTV/supertimeline)
- Calculates new target-states for each relevant point in time
- Maps the target-state to each playout device.
- Compares the target-states for each device with the currently-tracked-state and..
- ..generates commands to send to each device to account for the change.
- The commands are then put on queue and sent to the devices at the correct time.

:::info
For more information about what playout devices the _TSR_ supports, and examples of the timeline-objects, see the [README of TSR](https://github.com/nrkno/sofie-timeline-state-resolver#timeline-state-resolver)
:::

:::info
For more information about how to program timeline-objects, see the [README of the timeline-library](https://github.com/SuperFlyTV/supertimeline#superfly-timeline)
:::
