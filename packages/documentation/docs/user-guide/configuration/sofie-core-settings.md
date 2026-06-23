---
sidebar_position: 1
---

# Sofie Core: System Configuration

_Sofie&nbsp;Core_ is configured at it's most basic level using environment variables.

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
		<tr>
			<td>
				<code>SOFIE_ENABLE_HEADER_AUTH</code>
			</td>
			<td>
				If set to <code>1</code> or <code>true</code>, enables http header based security measures. See{' '}
				<a href="../features/access-levels">here</a> for details on using this
			</td>
			<td>
				<code>false</code>
			</td>
			<td>
				<code>1</code>
			</td>
		</tr>
	</tbody>
</table>

Installation behaviour is otherwise configured through the Studio settings and the System Management page in the UI.
