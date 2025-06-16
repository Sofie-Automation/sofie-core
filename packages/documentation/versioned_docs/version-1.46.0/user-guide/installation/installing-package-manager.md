---
sidebar_position: 7
---

# Installing Package Manager

### Prerequisites

- [Installed and running Sofie&nbsp;Core](installing-sofie-server-core)
- [Initial Sofie&nbsp;Core Setup](initial-sofie-core-setup)
- [Installed and configured Demo Blueprints](https://github.com/SuperFlyTV/sofie-demo-blueprints)
- [Installed, configured, and running CasparCG&nbsp;Server](installing-connections-and-additional-hardware/casparcg-server-installation)
- [`FFmpeg` and `FFprobe` available in `PATH`](installing-connections-and-additional-hardware/ffmpeg-installation)

Package Manager is used by Sofie to copy, analyze, and process media files. It is what powers Sofie's ability to copy media files to playout devices, to know when a media file is ready for playout, and to display details about media files in the rundown view such as scene changes, black frames, freeze frames, and more.

Although Package Manager can be used to copy any kind of file to/from a wide array of devices, we'll be focusing on a basic CasparCG&nbsp;Server Server setup for this guide.

:::caution

At this time, the Package Manager worker process is Windows-only. Therefore, these instructions as a whole will only work on Windows. The worker will not work on WSL2.

:::

## Installation For Development (Quick Start)

Package Manager is a suite of standalone applications, separate from _Sofie&nbsp;Core_. This guide assumes that Package Manager will be running on the same computer as _CasparCG&nbsp;Server_ and _Sofie&nbsp;Core_, as that is the fastest way to set up a demo. To get all parts of _Package Manager_ up and running quickly, execute these commands:

```bash
git clone https://github.com/nrkno/sofie-package-manager.git
cd sofie-package-manager
yarn install
yarn build
yarn start:single-app -- -- --basePath "C:\your\path\to\casparcg-server\media-folder (i.e. sofie-demo-media)"
```

Note: if Powershell throws `Unknown argument: basePath` error, add one more pair of dashes (`--`) before the basePath argument:

```bash
yarn start:single-app -- -- -- --basePath "C:\your\path\to\casparcg-server\media-folder (i.e. sofie-demo-media)"
```

On first startup, Package Manager will exit with the following message:

```
Not setup yet, exiting process!
To setup, go into Core and add this device to a Studio
```

This first run is necessary to get the Package Manager device registered with _Sofie&nbsp;Core_. We'll restart Package Manager later on in the [Configuration](#configuration) instructions.

## Installation In Production

We provide pre-built executables for Windows (x64) systems that can be used in production environments. These can be found on the [Releases](https://github.com/nrkno/sofie-package-manager/releases) GitHub repository page for Package Manager. For a minimal installation, you'll need the `package-manager-single-app.exe` and `worker.exe`. Put them in a folder of your choice. You can also place `ffmpeg.exe` and `ffprobe.exe` alongside them, if you don't want to make them available in `PATH`.

```bash
package-manager-single-app.exe --coreHost=<Core Host Name> --corePort=<Core HTTP(S) port> --deviceId=<Peripheral Device Id> --deviceToken=<Peripheral Device Token/Password>
```

Package Manager can be launched from [CasparCG Launcher](./installing-connections-and-additional-hardware/casparcg-server-installation#installing-the-casparcg-launcher) alongside Caspar-CG. This will make management and log collection easier on a production Video Server.

You can see a list of available options by running `package-manager-single-app.exe --help`.

## Configuration

1. Open the _Sofie&nbsp;Core_ Settings page ([http://localhost:3000/settings?admin=1](http://localhost:3000/settings?admin=1)), click on your Studio, and scroll down to the Attached Devices section.
1. Click the plus button (`+`) and select Package Manager to add the Package Manager device to your Studio.
1. On this same settings page, scroll down to the Package Manager section.
1. Click the plus button under the Package Containers heading, then click the edit icon (pencil) to the right of the newly-created package container.
1. Give this package container an ID of `casparcgContainer0` and a label of `CasparCG Package Container`.
1. Click on the dropdown under "Playout devices which use this package container" and select `casparcg0`.
   - If you don't have a `casparcg0` device, add it to the Playout Gateway under the Devices heading, then restart the Playout Gateway.
1. Click the plus button under "Accessors", then click the edit icon to the right of the newly-created accessor.
1. Give this accessor an ID of `casparcgHttpProxy0`, a Label of `CasparCG HTTP Proxy Accessor`, an Accessor Type of `HTTP_PROXY`, and a Base URL of `http://localhost:8080/package`. Then, ensure that both the "Allow Read access" and "Allow Write access" boxes are checked. Finally, click the done button (checkmark icon) in the bottom right.
1. Scroll back up a bit to the "Studio Settings" subsection (still in the Package Manager section) and select "CasparCG Package Container" for both "Package Containers to use for previews" and "Package Containers to use for thumbnails".
1. Your settings should look like this once all the above steps have been completed:
   ![Package Manager demo settings](/img/docs/Package_Manager_demo_settings.png)
1. If Package Manager `start:single-app` is running, restart it. If not, start it (see the above [Installation instructions](#installation-quick-start) for the relevant command line).

## Usage

In this basic configuration, Package Manager won't be copying any packages into your CasparCG&nbsp;Server media folder. Instead, it will simply check that the files in the rundown are present in your CasparCG&nbsp;Server media folder, and you'll have to manually place those files in the correct directory. However, thumbnail and preview generation will still function, as will status reporting.

If you're using the demo rundown provided by the [Rundown Editor](rundown-editor), you should already see work statuses on the Package Status page ([Status > Packages](http://localhost:3000/status/expected-packages)).

![Example Package Manager status display](/img/docs/Package_Manager_status_example.jpg)

If all is good, head to the [Rundowns page](http://localhost:3000/rundowns) and open the demo rundown.

### Further Reading

- [Package Manager](https://github.com/nrkno/sofie-package-manager) on GitHub.
