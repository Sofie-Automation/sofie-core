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

| **Field name**     | Use                                                                                                                  | Default value |
| :----------------- | :------------------------------------------------------------------------------------------------------------------- | :------------ |
| `enableHeaderAuth` | If true, enable http header based security measures. See [here](../features/access-levels) for details on using this | `false`       |

:::info
The exact definition for the settings can be found [in the code here](https://github.com/Sofie-Automation/sofie-core/blob/main/meteor/lib/Settings.ts#L12).
:::
