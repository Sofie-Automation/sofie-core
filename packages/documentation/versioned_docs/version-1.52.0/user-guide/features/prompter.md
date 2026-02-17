---
sidebar_position: 3
---

# Prompter

See [Sofie views](sofie-views.mdx#prompter-view) for how to access the prompter page.

![Prompter screen before the first Part is taken](/img/docs/main/features/prompter-view.png)

The prompter will display the script for the Rundown currently active in the Studio. On Air and Next parts and segments are highlighted - in red and green, respectively - to aid in navigation. In top-right corner of the screen, a Diff clock is shown, showing the difference between planned playback and what has been actually produced. This allows the host to know how far behind/ahead they are in regards to planned execution.

![Indicators for the On Air and Next part shown underneath the Diff clock](/img/docs/main/features/prompter-view-indicators.png)

If the user scrolls the prompter ahead or behind the On Air part, helpful indicators will be shown in the right-hand side of the screen. If the On Air or Next part's script is above the current viewport, arrows pointing up will be shown. If the On Air part's script is below the current viewport, a single arrow pointing down will be shown.

## Customize looks

The prompter UI can be configured using query parameters:

| Query parameter | Type   | Description                                                                                                                                                         | Default |
| :-------------- | :----- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------ |
| `mirror`        | 0 / 1  | Mirror the display horizontally                                                                                                                                     | `0`     |
| `mirrorv`       | 0 / 1  | Mirror the display vertically                                                                                                                                       | `0`     |
| `fontsize`      | number | Set a custom font size of the text. 20 will fit in 5 lines of text, 14 will fit 7 lines etc..                                                                       | `14`    |
| `marker`        | string | Set position of the read-marker. Possible values: "center", "top", "bottom", "hide"                                                                                 | `hide`  |
| `margin`        | number | Set margin of screen \(used on monitors with overscan\), in %.                                                                                                      | `0`     |
| `showmarker`    | 0 / 1  | If the marker is not set to "hide", control if the marker is hidden or not                                                                                          | `1`     |
| `showscroll`    | 0 / 1  | Whether the scroll bar should be shown                                                                                                                              | `1`     |
| `followtake`    | 0 / 1  | Whether the prompter should automatically scroll to current segment when the operator TAKE:s it                                                                     | `1`     |
| `showoverunder` | 0 / 1  | The timer in the top-right of the prompter, showing the overtime/undertime of the current show.                                                                     | `1`     |
| `debug`         | 0 / 1  | Whether to display a debug box showing controller input values and the calculated speed the prompter is currently scrolling at. Used to tweak speedMaps and ranges. | `0`     |

Example: [http://127.0.0.1/prompter/studio0/?mode=mouse&followtake=0&fontsize=20](http://127.0.0.1/prompter/studio0/?mode=mouse&followtake=0&fontsize=20)

## Controlling the prompter

The prompter can be controlled by different types of controllers. The control mode is set by a query parameter, like so: `?mode=mouse`.

| Query parameter         | Description                                                                                                                                                                                                                                    |
| :---------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default                 | Controlled by both mouse and keyboard                                                                                                                                                                                                          |
| `?mode=mouse`           | Controlled by mouse only. [See configuration details](prompter.md#control-using-mouse-scroll-wheel)                                                                                                                                            |
| `?mode=keyboard`        | Controlled by keyboard only. [See configuration details](prompter.md#control-using-keyboard)                                                                                                                                                   |
| `?mode=shuttlekeyboard` | Controlled by a Contour Design ShuttleXpress, X-keys Jog and Shuttle or any compatible, configured as keyboard-ish device. [See configuration details](prompter.md#control-using-contour-shuttlexpress-or-x-keys)                              |
| `?mode=shuttlewebhid`   | Controlled by a Contour Design ShuttleXpress, using the browser's WebHID API [See configuration details](prompter.md#control-using-contour-shuttlexpress-via-webhid)                                                                               |
| `?mode=pedal`           | Controlled by any MIDI device outputting note values between 0 - 127 of CC notes on channel 8. Analogue Expression pedals work well with TRS-USB midi-converters. [See configuration details](prompter.md#control-using-midi-input-mode-pedal) |
| `?mode=joycon`          | Controlled by Nintendo Switch Joycon, using the HTML5 GamePad API. [See configuration details](prompter.md#control-using-nintendo-joycon-gamepad)                                                                                              |

#### Control using mouse \(scroll wheel\)

The prompter can be controlled in multiple ways when using the scroll wheel:

| Query parameter             | Description                                                                                                                                                                              |
| :-------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `?controlmode=normal`       | Scrolling of the mouse works as "normal scrolling"                                                                                                                                       |
| `?controlmode=speed`        | Scrolling of the mouse changes the speed of scrolling. Left-click to toggle, right-click to rewind                                                                                        |
| `?controlmode=smoothscroll` | Scrolling the mouse wheel starts continuous scrolling. Small speed adjustments can then be made by nudging the scroll wheel. Stop the scrolling by making a "larger scroll" on the wheel. |

has several operating modes, described further below. All modes are intended to be controlled by a computer mouse or similar, such as a presenter tool.

#### Control using keyboard

Keyboard control is intended to be used when having a "keyboard"-device, such as a presenter tool.

| Scroll up    | Scroll down   |
| :----------- | :------------ |
| `Arrow Up`   | `Arrow Down`  |
| `Arrow Left` | `Arrow Right` |
| `Page Up`    | `Page Down`   |
|              | `Space`       |

#### Control using Contour ShuttleXpress or X-keys \(_?mode=shuttlekeyboard_\)

This mode is intended to be used when having a Contour ShuttleXpress or X-keys device, configured to work as a keyboard device. These devices have jog/shuttle wheels, and their software/firmware allow them to map scroll movement to keystrokes from any key-combination. Since we only listen for key combinations, it effectively means that any device outputting keystrokes will work in this mode.

| Query parameter    | Type             | Description                                                                                                                                                                                                                                                                                  | Default                    |
| :----------------- | :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------- |
| `shuttle_speedMap` | Array of numbers | Speeds to scroll by \(px. pr. frame - approx 60fps\) when scrolling forwards. The beginning of the forwards-range maps to the first number in this array, and the end of the forwards-range map to the end of this array. All values in between are being interpolated using a spline curve. | `0, 1, 2, 3, 5, 7, 9, 30]` |

| Key combination                                            | Function                               |
| :--------------------------------------------------------- | :------------------------------------- |
| `Ctrl` `Alt` `F1` ... `Ctrl` `Alt` `F7`                    | Set speed to +1 ... +7 \(Scroll down\) |
| `Ctrl` `Shift` `Alt` `F1` ... `Ctrl` `Shift` `Alt` `F7`    | Set speed to -1 ... -7 \(Scroll up\)   |
| `Ctrl` `Alt` `+`                                           | Increase speed                         |
| `Ctrl` `Alt` `-`                                           | Decrease speed                         |
| `Ctrl` `Alt` `Shift` `F8`, `Ctrl` `Alt` `Shift` `PageDown` | Jump to next Segment and stop          |
| `Ctrl` `Alt` `Shift` `F9`, `Ctrl` `Alt` `Shift` `PageUp`   | Jump to previous Segment and stop      |
| `Ctrl` `Alt` `Shift` `F10`                                 | Jump to top of Script and stop         |
| `Ctrl` `Alt` `Shift` `F11`                                 | Jump to Live and stop                  |
| `Ctrl` `Alt` `Shift` `F12`                                 | Jump to next Segment and stop          |

Configuration files that can be used in their respective driver software:

- [Contour ShuttleXpress](https://github.com/Sofie-Automation/sofie-core/blob/release26/resources/prompter_layout_shuttlexpress.pref)
- [X-keys](https://github.com/Sofie-Automation/sofie-core/blob/release26/resources/prompter_layout_xkeys.mw3)

#### Control using Contour ShuttleXpress via WebHID

This mode uses a Contour ShuttleXpress (Multimedia Controller Xpress) through web browser's WebHID API.

When opening the Prompter View for the first time, it is necessary to press the _Connect to Contour Shuttle_ button in the top left corner of the screen, select the device, and press _Connect_.

![Contour ShuttleXpress input mapping](/img/docs/main/features/contour-shuttle-webhid.jpg)

####

#### Control using midi input \(_?mode=pedal_\)

This mode listens to MIDI CC-notes on channel 8, expecting a linear range like i.e. 0-127. Sutiable for use with expression pedals, but any MIDI controller can be used. The mode picks the first connected MIDI device, and supports hot-swapping \(you can remove and add the device without refreshing the browser\).

Web-Midi requires the web page to be served over HTTPS, or that the Chrome flag `unsafely-treat-insecure-origin-as-secure` is set.

If you want to use traditional analogue pedals with 5 volt TRS connection, a converter such as the _Beat Bars EX2M_ will work well.

| Query parameter         | Type             | Description                                                                                                                                                                                                                                                                                  | Default                                 |
| :---------------------- | :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------- |
| `pedal_speedMap`        | Array of numbers | Speeds to scroll by \(px. pr. frame - approx 60fps\) when scrolling forwards. The beginning of the forwards-range maps to the first number in this array, and the end of the forwards-range map to the end of this array. All values in between are being interpolated using a spline curve. | `[1, 2, 3, 4, 5, 7, 9, 12, 17, 19, 30]` |
| `pedal_reverseSpeedMap` | Array of numbers | Same as `pedal_speedMap` but for the backwards range.                                                                                                                                                                                                                                        | `[10, 30, 50]`                          |
| `pedal_rangeRevMin`     | number           | The end of the backwards-range, full speed backwards.                                                                                                                                                                                                                                        | `0`                                     |
| `pedal_rangeNeutralMin` | number           | The beginning of the backwards-range.                                                                                                                                                                                                                                                        | `35`                                    |
| `pedal_rangeNeutralMax` | number           | The minimum input to run forward, the start of the forward-range \(min speed\). This is also the end of any "deadband" you want filter out before starting moving forwards.                                                                                                                  | `80`                                    |
| `pedal_rangeFwdMax`     | number           | The maximum input, the end of the forward-range \(max speed\)                                                                                                                                                                                                                                | `127`                                   |

- `pedal_rangeNeutralMin` has to be greater than `pedal_rangeRevMin`
- `pedal_rangeNeutralMax` has to be greater than `pedal_rangeNeutralMin`
- `pedal_rangeFwdMax` has to be greater than `pedal_rangeNeutralMax`

![Yamaha FC7 mapped for both a forward (80-127) and backwards (0-35) range.](/img/docs/main/features/yamaha-fc7.jpg)

The default values allow for both going forwards and backwards. This matches the _Yamaha FC7_ expression pedal. The default values create a forward-range from 80-127, a neutral zone from 35-80 and a reverse-range from 0-35.

Any movement within forward range will map to the `pedal_speedMap` with interpolation between any numbers in the `pedal_speedMap`. You can turn on `?debug=1` to see how your input maps to an output. This helps during calibration. Similarly, any movement within the backwards rage maps to the `pedal_reverseSpeedMap`.

**Calibration guide:**

| **Symptom**                                                                               | Adjustment                                                                                                                                                                                                                                 |
| :---------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _"I can't rest my foot without it starting to run"_                                       | Increase `pedal_rangeNeutralMax`                                                                                                                                                                                                           |
| _"I have to push too far before it starts moving"_                                        | Decrease `pedal_rangeNeutralMax`                                                                                                                                                                                                           |
| _"It starts out fine, but runs too fast if I push too hard"_                              | Add more weight to the lower part of the `pedal_speedMap` by adding more low values early in the map, compared to the large numbers in the end.                                                                                            |
| _"I have to go too far back to reverse"_                                                  | Increase `pedal_rangeNeutralMin`                                                                                                                                                                                                            |
| _"As I find a good speed, it varies a bit in speed up/down even if I hold my foot still"_ | Use `?debug=1` to see what speed is calculated in the position the presenter wants to rest the foot in. Add more of that number in a sequence in the `pedal_speedMap` to flatten out the speed curve, i.e. `[1, 2, 3, 4, 4, 4, 4, 5, ...]` |

**Note:** The default values are set up to work with the _Yamaha FC7_ expression pedal, and will probably not be good for pedals with one continuous linear range from fully released to fully depressed. A suggested configuration for such pedals \(i.e. the _Mission Engineering EP-1_\) will be like:

| Query parameter         | Suggestion                              |
| :---------------------- | :-------------------------------------- |
| `pedal_speedMap`        | `[1, 2, 3, 4, 5, 7, 9, 12, 17, 19, 30]` |
| `pedal_reverseSpeedMap` | `-2`                                    |
| `pedal_rangeRevMin`     | `-1`                                    |
| `pedal_rangeNeutralMin` | `0`                                     |
| `pedal_rangeNeutralMax` | `1`                                     |
| `pedal_rangeFwdMax`     | `127`                                   |

#### Control using Nintendo Joycon \(_?mode=joycon_\)

This mode uses the browsers Gamapad API and polls connected Joycons for their states on button-presses and joystick inputs.

The Joycons can operate in 3 modes, the L-stick, the R-stick or both L+R sticks together. Reconnections and jumping between modes works, with one known limitation: **Transition from L+R to a single stick blocks all input, and requires a reconnect of the sticks you want to use.** This seems to be a bug in either the Joycons themselves or in the Gamepad API in general.

| Query parameter          | Type             | Description                                                                                                                                                                                                                                                                                | Default                      |
| :----------------------- | :--------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------- |
| `joycon_speedMap`        | Array of numbes  | Speeds to scroll by \(px. pr. frame - approx 60fps\) when scrolling forwards. The beginning of the forwards-range maps to the first number in this array, and thee end of the forwards-range map to the end of this array. All values in between are being interpolated in a spline curve. | `[1, 2, 3, 4, 5, 8, 12, 30]` |
| `joycon_reverseSpeedMap` | Array of numbers | Same as `joycon_speedMap` but for the backwards range.                                                                                                                                                                                                                                     | `[1, 2, 3, 4, 5, 8, 12, 30]` |
| `joycon_rangeRevMin`     | number           | The end of the backwards-range, full speed backwards.                                                                                                                                                                                                                                      | `-1`                         |
| `joycon_rangeNeutralMin` | number           | The beginning of the backwards-range.                                                                                                                                                                                                                                                      | `-0.25`                      |
| `joycon_rangeNeutralMax` | number           | The minimum input to run forward, the start of the forward-range \(min speed\). This is also the end of any "deadband" you want filter out before starting moving forwards.                                                                                                                | `0.25`                       |
| `joycon_rangeFwdMax`     | number           | The maximum input, the end of the forward-range \(max speed\)                                                                                                                                                                                                                              | `1`                          |
| `joycon_rightHandOffset` | number           | A ratio to increase or decrease the R Joycon joystick sensitivity relative to the L Joycon.                                                                                                                                                                                                | `1.4`                        |

- `joycon_rangeNeutralMin` has to be greater than `joycon_rangeRevMin`
- `joycon_rangeNeutralMax` has to be greater than `joycon_rangeNeutralMin`
- `joycon_rangeFwdMax` has to be greater than `joycon_rangeNeutralMax`

![Nintendo Switch Joycons](/img/docs/main/features/nintendo-switch-joycons.jpg)

You can turn on `?debug=1` to see how your input maps to an output.

**Button map:**

| **Button** | Acton                     |
| :--------- | :------------------------ |
| L2 / R2    | Go to the "On-air" story  |
| L / R      | Go to the "Next" story    |
| Up / X     | Go top the top            |
| Left / Y   | Go to the previous story  |
| Right / A  | Go to the following story |

**Calibration guide:**

| **Symptom**                                                                                 | Adjustment                                                                                                                                                                                                                                      |
| :------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _"The prompter drifts upwards when I'm not doing anything"_                                 | Decrease `joycon_rangeNeutralMin`                                                                                                                                                                                                               |
| _"The prompter drifts downwards when I'm not doing anything"_                               | Increase `joycon_rangeNeutralMax`                                                                                                                                                                                                               |
| _"It starts out fine, but runs too fast if I move too far"_                                 | Add more weight to the lower part of the `joycon_speedMap / joycon_reverseSpeedMap` by adding more low values early in the map, compared to the large numbers in the end.                                                                       |
| _"I can't reach max speed backwards"_                                                       | Increase `joycon_rangeRevMin`                                                                                                                                                                                                                   |
| _"I can't reach max speed forwards"_                                                        | Decrease `joycon_rangeFwdMax`                                                                                                                                                                                                                   |
| _"As I find a good speed, it varies a bit in speed up/down even if I hold my finger still"_ | Use `?debug=1` to see what speed is calculated in the position the presenter wants to rest their finger in. Add more of that number in a sequence in the `joycon_speedMap` to flatten out the speed curve, i.e. `[1, 2, 3, 4, 4, 4, 4, 5, ...]` |
