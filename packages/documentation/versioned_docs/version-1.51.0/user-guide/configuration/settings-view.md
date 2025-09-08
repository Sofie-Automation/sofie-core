---
sidebar_position: 2
---
# Settings View

:::caution
The settings views are only visible to users with the correct [access level](../features/access-levels.md)!
:::

Recommended read before diving into the settings: [System, \(Organization\), Studio & Show Style](../concepts-and-architecture.md#system-organization-studio-and-show-style).

## System

The _System_ settings are settings for this installation of Sofie. In here goes the settings that are applicable system-wide.

:::caution
Documentation for this section is yet to be written.
:::

### Name and logo

Sofie contains the option to change the name of the installation. This is useful to identify different studios or regions.

We have also provided some seasonal logos just for fun.

### System-wide notification message

This option will show a notification to the user containing some custom text. This can be used to inform the user about on-going problems or maintenance information.

### Support panel

The support panel is shown in the rundown view when the user clicks the "?" button in the right bottom corner. It can contain some custom HTML which can be used to refer your users to custom information specific to your organisation.

### Action triggers

The action triggers section lets you set custom keybindings for system-level actions such as doing a take or resetting a rundown.

### Monitoring

Sofie can be configured to send information to Elastic APM. This can provide useful information about the system's performance to developers. In general this can reduce the performance of Sofie altogether though so it is recommended to disable it in production.

Sofie can also monitor for blocked threads, and will log a message if it discovers any. This is also recommended to disable in production.

### CRON jobs

Sofie contains cron jobs for restarting any casparcg servers through the casparcg launcher as well as a job to create rundown snapshots periodically.

### Clean up

The clean up process in Sofie will search the database for unused data and indexes and removes them. If you have had an installation running for many versions this may increase database informance and is in general safe to use at any time.

## Studio

A _Studio_ in Sofie-terms is a physical location, with a specific set of devices and equipment. Only one show can be on air in a studio at the same time.  
The _studio_ settings are settings for that specific studio, and contains settings related to hardware and playout, such as:

* **Attached devices** - the Gateways related to this studio
* **Blueprint configuration** - custom config option defined by the blueprints
* **Layer Mappings** - Maps the logical _timeline layers_ to physical devices and outputs

The Studio uses a studio-blueprint, which handles things like mapping up an incoming rundown to a Showstyle.

### Attached Devices

This section allows you to add and remove Gateways that are related to this _Studio_. When a Gateway is attached to a Studio, it will react to the changes happening within it, as well as feed the neccessary data into it.

### Blueprint Configuration

Sofie allows the Blueprints to expose custom configuration fields that allow the System Administrator to reconfigure how these Blueprints work through the Sofie UI. Here you can change the configuration of the [Studio Blueprint](../concepts-and-architecture.md#studio-blueprints).

### Layer Mappings

This section allows you to add, remove and configure how logical device-control will be translated to physical automation control. [Blueprints](../concepts-and-architecture.md#blueprints) control devices through objects placed on a [Timeline](../concepts-and-architecture.md#timeline) using logical device identifiers called _Layers_. A layer represents a single aspect of a device that can be controlled at a given time: a video switcher's M/E bus, an audio mixers's fader, an OSC control node, a video server's output channel. Layer Mappings translate these logical identifiers into physical device aspects, for example:

![A sample configuration of a Layer Mapping for the M/E1 Bus of an ATEM switcher](/img/docs/main/features/atem-layer-mapping-example.png)

This _Layer Mapping_ configures the `atem_me_program` Timeline-layer to control the `atem0` device of the `ATEM` type. No Lookahead will be enabled for this layer. This layer will control a `MixEffect` aspect with the Index of `0` \(so M/E 1 Bus\).

These mappings allow the System Administrator to reconfigure what devices the Blueprints will control, without the need of changing the Blueprint code.

#### Route Sets

In order to allow the Producer to reconfigure the automation from the Switchboard in the [Rundown View](../concepts-and-architecture.md#rundown-view), as well as have some pre-set automation control available for the System Administrator, Sofie has a concept of Route Sets. Route Sets work on top of the Layer Mappings, by configuring sets of [Layer Mappings](settings-view.md#layer-mappings) that will re-route the control from one device to another, or to disable the automation altogether. These Route Sets are presented to the Producer in the [Switchboard](../concepts-and-architecture.md#switchboard) panel.

A Route Set is essentially a distinct set of Layer Mappings, which can modify the settings already configured by the Layer Mappings, but can be turned On and Off. Called Routes, these can change:

* the Layer ID to a new Layer ID
* change the Device being controlled by the Layer
* change the aspect of the Device that's being controlled.

Route Sets can be grouped into Exclusivity Groups, in which only a single Route Set can be enabled at a time. When activating a Route Set within an Exclusivity Group, all other Route Sets in that group will be deactivated. This in turn, allows the System Administrator to create entire sections of exclusive automation control within the Studio that the Producer can then switch between. One such example could be switching between Primary and Backup playout servers, or switching between Primary and Backup talent microphone.

![The Exclusivity Group Name will be displayed as a header in the Switchboard panel](/img/docs/main/features/route-sets-exclusivity-groups.png)

A Route Set has a Behavior property which will dictate what happens how the Route Set operates:

| Type            | Behavior                                                                                                                        |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| `ACTIVATE_ONLY` | This RouteSet cannot be deactivated, only a different RouteSet in the same Exclusivity Group can cause it to deactivate         |
| `TOGGLE`        | The RouteSet can be activated and deactivated. As a result, it's possible for the Exclusivity Group to have no Route Set active |
| `HIDDEN`        | The RouteSet can be activated and deactivated, but it will not be presented to the user in the Switchboard panel                |

![An active RouteSet with a single Layer Mapping being re-configured](/img/docs/main/features/route-set-remap.png)

Route Sets can also be configured with a _Default State_. This can be used to contrast a normal, day-to-day configuration with an exceptional one \(like using a backup device\) in the [Switchboard](../concepts-and-architecture#switchboard) panel.

| Default State | Behavior                                                      |
| :------------ | :------------------------------------------------------------ |
| Active        | If the Route Set is not active, an indicator will be shown    |
| Not Active    | If the Route Set is active, an indicator will be shown        |
| Not defined   | No indicator will be shown, regardless of the Route Set state |

## Show style

A _Showstyle_ is related to the looks and logic of a _show_, which in contrast to the _studio_ is not directly related to the hardware.  
The Showstyle contains settings like

* **Source Layers** - Groups different types of content in the GUI
* **Output Channels** - Indicates different output targets \(such as the _Program_ or _back-screen in the studio_\)
* **Action Triggers** - Select how actions can be started on a per-show basis, outside of the on-screen controls
* **Blueprint configuration** - custom config option defined by the blueprints

:::caution
Please note the difference between _Source Layers_ and _timeline-layers_:

[Pieces](../concepts-and-architecture.md#piece) are put onto _Source layers_, to group different types of content \(such as a VT or Camera\), they are therefore intended only as something to indicate to the user what is going to be played, not what is actually going to happen on the technical level.

[Timeline-objects](../concepts-and-architecture.md#timeline-object) \(inside of the [Pieces](../concepts-and-architecture.md#piece)\) are put onto timeline-layers, which are \(through the Mappings in the studio\) mapped to physical devices and outputs.  
The exact timeline-layer is never exposed to the user, but instead used on the technical level to control playout.

An example of the difference could be when playing a VT \(that's a Source Layer\), which could involve all of the timeline-layers _video\_player0_, _audio\_fader\_video_, _audio\_fader\_host_ and _mixer\_pgm._
:::

### Action Triggers

This is a way to set up how - outside of the Point-and-Click Graphical User Interface - actions can be performed in the User Interface. Commonly, these are the *hotkey combinations* that can be used to either trigger AdLib content or other actions in the larger system. This is done by creating sets of Triggers and Actions to be triggered by them. These pairs can be set at the Show Style level or at the _Sofie&nbsp;Core_ (System) level, for common actions such as doing a Take or activating a Rundown, where you want a shared method of operation. _Sofie&nbsp;Core_ migrations will set up a base set of basic, system-wide Action Triggers for interacting with rundowns, but they can be changed by the System blueprint.

![Action triggers define modes of interacting with a Rundown](/img/docs/main/features/action_triggers_3.png)

#### Triggers

The triggers are designed to be either client-specific or issued by a peripheral device module.

Currently, the Action Triggers system supports setting up two types of triggeers: Hotkeys and Device Triggers. 

Hotkeys are valid in the scope of a browser window and can be either a single key, a combination of keys (*combo*) or a *chord* - a sequnece of key combinations pressed in a particular order. *Chords* are popular in some text editing applications and vastly expand the amount of actions that can be triggered from a keyboard, at the expense of the time needed to execute them. Currently, the Hotkey editor in Sofie does not support creating *Chords*, but they can be specified by Blueprints during migrations.

To edit a given trigger, click on the trigger pill on the left of the Trigger-Action set. When hovering, a **+** sign will appear, allowing you to add a new trigger to the set.

Device Triggers are valid in the scope of a Studio and will be evaluated on the currently active Rundown in a given Studio. To use Device Triggers, you need to have at least a single [Input Gateway](../installation/installing-input-gateway) attached to a Studio and a Device configured in the Input Gateway. Once that's done, when selecting a **Device** trigger type in the pop-up, you can invoke triggers on your Input Device and you will see a preview of the input events shown at the bottom of the pop-up. You can select which of these events should be the trigger by clicking on one of the previews. Note, that some devices differentiate between _Up_ and _Down_ triggers, while others don't. Some may also have other activites that can be done _to_ a trigger. What they are and how they are identified is device-specific and is best discovered through interaction with the device.

If you would like to set up combination Triggers, using Device Triggers on an Input Device that does not support them natively, you may want to look into [Shift Registers](#shift-registers)

#### Actions

The actions are built using a base *action* (such as *Activate a Rundown* or *AdLib*) and a set of *filters*, limiting the scope of the *action*. Optionally, some of these *actions* can take additional *parameters*. These filters can operate on various types of objects, depending on the action in question. All actions currently require that the chain of filters starts with scoping out the Rundown the action is supposed to affect. Currently, there is only one type of Rundown-level filter supported: "The Rundown currently in view".

The Action Triggers user interface guides the user in a wizzard-like fashion through the available *filter* options on a given *action*.

![Actions can take additional parameters](/img/docs/main/features/action_triggers_2.png)

If the action provides a preview of the triggered items and there is an available matching Rundown, a preview will be displayed for the matching objects in that Rundown. The system will select the current active rundown, if it is of the currently-edited ShowStyle, and if not, it will select the first available Rundown of the currently-edited ShowStyle.

![A preview of the action, as scoped by the filters](/img/docs/main/features/action_triggers_4.png)

Clicking on the action and filter pills allows you to edit the action parameters and filter parameters. *Limit* limits the amount of objects to only the first *N* objects matched - this can significantly improve performance on large data sets. *Pick* and *Pick last* filters end the chain of the filters by selecting a single item from the filtered set of objects (the *N-th* object from the beginning or the end, respectively). *Pick* implicitly contains a *Limit* for the performance improvement. This is not true for *Pick last*, though.

##### Shift Registers

Shift Register modification actions are a special type of an Action, that modifies an internal state memory of the [Input Gateway](../installation/installing-input-gateway.md) and allows combination triggers, pagination, etc. on devices that don't natively support them or combining multiple devices into a single Control Surface. Refer to _Input Gateway_ documentation for more information on Shift Registers.

Shift Register actions have no effect in the browser, triggered from a _Hotkey_.

## Migrations

The migrations are automatic setup-scripts that help you during initial setup and system upgrades.

There are system-migrations that comes directly from the version of _Sofie&nbsp;Core_ you're running, and there are also migrations added by the different blueprints.

It is mandatory to run migrations when you've upgraded _Sofie&nbsp;Core_ to a new version, or upgraded your blueprints.

