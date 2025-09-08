---
sidebar_position: 1
---

# Sofie Core: System Configuration

_Sofie&nbsp;Core_ is configured at it's most basic level using a settings file and environment variables.

### Environment Variables

<table>
	<thead>
		<tr>
			<th>Setting</th>
			<th>Use</th>
			<th>Default value</th>
			<th>Example</th>
		</tr>
	</thead>
	<tbody>
		<tr>
			<td>
				<code>METEOR_SETTINGS</code>
			</td>
			<td>Contents of settings file (see below)</td>
			<td></td>
			<td>
				<code>$(cat settings.json)</code>
			</td>
		</tr>
		<tr>
			<td>
				<code>TZ</code>
			</td>
			<td>The default time zone of the server (used in logging)</td>
			<td></td>
			<td>
				<code>Europe/Amsterdam</code>
			</td>
		</tr>
		<tr>
			<td>
				<code>MAIL_URL</code>
			</td>
			<td>
				Email server to use. See{' '}
				<a href="https://docs.meteor.com/api/email.html">https://docs.meteor.com/api/email.html</a>
			</td>
			<td></td>
			<td>
				<code>smtps://USERNAME:PASSWORD@HOST:PORT</code>
			</td>
		</tr>
		<tr>
			<td>
				<code>LOG_TO_FILE</code>
			</td>
			<td>File path to log to file</td>
			<td></td>
			<td>
				<code>/logs/core/</code>
			</td>
		</tr>
	</tbody>
</table>

### Settings File

The settings file is an optional JSON file that contains some configuration settings for how the _Sofie&nbsp;Core_ works and behaves.

To use a settings file:

- During development: `meteor --settings settings.json`
- During prod: environment variable \(see above\)

The structure of the file allows for public and private fields. At the moment, Sofie only uses public fields. Below is an example settings file:

```text
{
    "public": {
        "frameRate": 25
    }
}
```

There are various settings you can set for an installation. See the list below:

| **Field name**                | Use                                                                                                                           | Default value                          |
| :---------------------------- | :---------------------------------------------------------------------------------------------------------------------------- | :------------------------------------- |
| `defaultToCollapsedSegments`  | Should all segments be collapsed by default, until the user expands them                                                      | `false`                                |
| `autoRewindLeavingSegment`    | Should segments be automatically rewound after they stop playing                                                              | `false`                                |
| `disableBlurBorder`           | Should a border be displayed around the Rundown View when it's not in focus and studio mode is enabled                        | `false`                                |
| `defaultTimeScale`            | An arbitrary number, defining the default zoom factor of the Timelines                                                        | `1`                                    |
| `allowGrabbingTimeline`       | Can Segment Timelines be grabbed to scroll them?                                                                              | `true`                                 |
| `enableUserAccounts`          | Enables User Accounts and Authentication. If disabled, all user stations will be treated as a single, anonymous user          | `false`                                |
| `defaultDisplayDuration`      | The fallback duration of a Part, when it's expectedDuration is 0. \_\_In milliseconds                                         | `3000`                                 |
| `allowMultiplePlaylistsInGUI` | If true, allows creation of new playlists in the Lobby Gui (rundown list). If false; only pre-existing playlists are allowed. | `false`                                |
| `followOnAirSegmentsHistory`  | How many segments of history to show when scrolling back in time (0 = show current segment only)                              | `0`                                    |
| `maximumDataAge`              | Clean up stuff that are older than this [ms])                                                                                 | 100 days                               |
| `poisonKey`                   | Enable the use of poison key if present and use the key specified.                                                            | `'Escape'`                             |
| `enableNTPTimeChecker`        | If set, enables a check to ensure that the system time doesn't differ too much from the speficied NTP server time.            | `null`                                 |
| `defaultShelfDisplayOptions`  | Default value used to toggle Shelf options when the 'display' URL argument is not provided.                                   | `buckets,layout,shelfLayout,inspector` |
| `enableKeyboardPreview`       | The KeyboardPreview is a feature that is not implemented in the main Fork, and is kept here for compatibility                 | `false`                                |
| `keyboardMapLayout`           | Keyboard map layout (what physical layout to use for the keyboard)                                                            | STANDARD_102_TKL                       |
| `customizationClassName`      | CSS class applied to the body of the page. Used to include custom implementations that differ from the main Fork.             | `undefined`                            |
| `useCountdownToFreezeFrame`   | If true, countdowns of videos will count down to the last freeze-frame of the video instead of to the end of the video        | `true`                                 |
| `confirmKeyCode`              | Which keyboard key is used as "Confirm" in modal dialogs etc.                                                                 | `'Enter'`                              |

:::info
The exact definition for the settings can be found [in the code here](https://github.com/Sofie-Automation/sofie-core/blob/main/meteor/lib/Settings.ts#L12).
:::
