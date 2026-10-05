---
sidebar_position: 40
---

# Installing Blueprints

#### Prerequisites

- [Installed and running Sofie&nbsp;Core](quick-install.md)
- [Initial Sofie&nbsp;Core Setup](initial-sofie-core-setup.md)

Blueprints are little plug-in programs that runs inside _Sofie_. They are the logic that determines how _Sofie_ interacts with rundowns, hardware, and media.

Blueprints are custom JavaScript scripts that you create yourself \(or download an existing one\). There are a set of example Blueprints for the Spreadsheet Gateway and Rundown Editor available for use here: [https://github.com/SuperFlyTV/sofie-demo-blueprints](https://github.com/SuperFlyTV/sofie-demo-blueprints). You can learn more about them in the [Blueprints section](../../for-developers/for-blueprint-developers/intro.md)

To begin installing any Blueprint, navigate to the _Settings page_. Getting there is covered in the [Access Levels](../features/access-levels.md) page.

![The Settings Page](/img/docs/getting-started/settings-page.jpg)

To upload a new blueprint, click the _+_ icon next to Blueprints menu option. Select the newly created Blueprint and upload the local blueprint JS file. You will get a confirmation if the installation was successful.

There are 3 types of blueprints: System, Studio and Show Style:

### System Blueprint

_System Blueprints handles some basic functionality on how the Sofie system will operate._

After you've uploaded your System Blueprint JS bundle, click _Assign_ in the blueprint-page to assign it as system-blueprint.

### Studio Blueprint

_Studio Blueprints determine how Sofie will interact with the hardware in your studio._

After you've uploaded your Studio Blueprint JS bundle, navigate to a Studio in the settings and assign the new Blueprint to it \(under the label _Blueprint_ \).

After having installed the Blueprint, the Studio's baseline will need to be reloaded. On the Studio page, click the button _Reload Baseline_. This will also be needed whenever you have changed any settings.

### Show Style Blueprint

_Show Style Blueprints determine how your show will look / feel._

After you've uploaded your Show Style Blueprint JS bundle, navigate to a Show Style in the settings and assign the new Blueprint to it \(under the label _Blueprint_ \).

### Further Reading

- [Community Blueprints Supporting Spreadsheet Gateway and Rundown Editor](https://github.com/SuperFlyTV/sofie-demo-blueprints)
