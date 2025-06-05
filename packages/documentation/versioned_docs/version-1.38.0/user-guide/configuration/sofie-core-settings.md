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
				<code>NTP_SERVERS</code>
			</td>
			<td>List of time servers to sync the system to (comma separated).</td>
			<td>
				0.pool.ntp.org,
				<br />
				1.pool.ntp.org,
				<br />
				2.pool.ntp.org
			</td>
			<td></td>
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

| **Field name**                 | Use                                                                                                                  | Default value |
| :----------------------------- | :------------------------------------------------------------------------------------------------------------------- | :------------ |
| `frameRate`                    | The framerate used to display time-codes in the GUI                                                                  | `25`          |
| `defaultToCollapsedSegments`   | Should all segments be collapsed by default, until the user expands them                                             | `false`       |
| `autoRewindLeavingSegment`     | Should segments be automatically rewound after they stop playing                                                     | `false`       |
| `autoExpandCurrentNextSegment` | Should the segments be expanded when they are On Air or Next, useful with `defaultToCollapsedSegments`               | `false`       |
| `disableBlurBorder`            | Should a border be displayed around the Rundown View when it's not in focus and studio mode is enabled               | `false`       |
| `defaultTimeScale`             | An arbitrary number, defining the default zoom factor of the Timelines                                               | `1`           |
| `allowGrabbingTimeline`        | Can Segment Timelines be grabbed to scroll them?                                                                     | `true`        |
| `enableUserAccounts`           | Enables User Accounts and Authentication. If disabled, all user stations will be treated as a single, anonymous user | `false`       |
| `allowUnsyncedSegments`        | Switches behavior between unsyncing entire Rundowns or just Segments                                                 | `false`       |
| `allowRundownResetOnAir`       | Should the user be allowed to reset Rundowns when they are On Air                                                    | `false`       |
| `defaultDisplayDuration`       | The fallback duration of a Part, when it's expectedDuration is 0. \_\_In milliseconds                                | `3000`        |

:::info
The exact definition for the settings can be found [in the code here](https://github.com/nrkno/sofie-core/blob/master/meteor/lib/Settings.ts#L12).
:::
