import React, { useState, useEffect } from 'react'
import IconExternalLink from '@docusaurus/theme-classic/lib/theme/Icon/ExternalLink'

const GITHUB_API_URL = 'https://api.github.com'

export default function GitHubReleases({ org, repo, releaseLabel, state }) {
	const [isReady, setIsReady] = useState(0) // 0 - not ready, 1 - loaded, 2 - failed permanently
	const [releases, setReleases] = useState([])

	useEffect(() => {
		let mounted = true
		fetch(`${GITHUB_API_URL}/repos/${org}/${repo}/issues?state=${state || 'open'}`, {
			headers: [['Accept', 'application/vnd.github.v3+json']],
		})
			.then((value) => {
				if (value.ok) {
					return value.json()
				} else {
					throw new Error(value.status)
				}
			})
			.then((data) => {
				if (!mounted) return
				setReleases(data.filter((issue) => issue.labels.find((label) => label.name === releaseLabel)))
				setIsReady(1)
			})
			.catch((error) => {
				if (!mounted) return
				console.error(error)
				setIsReady(2)
			})

		return () => {
			mounted = false
		}
	}, [releaseLabel])

	if (isReady !== 1) return null

	return (
		<table>
			<thead>
				<tr>
					<th align="left">Release</th>
					<th align="left">Status</th>
				</tr>
			</thead>
			<tbody>
				{releases.map((releaseIssue) => (
					<tr key={releaseIssue.id}>
						<td>
							<a id={releaseIssue.title.toLowerCase().replace(/\s+/, '-')} href={releaseIssue.html_url}>
								{releaseIssue.title}
								<IconExternalLink />
							</a>
						</td>
						<td>
							{releaseIssue.labels
								.filter((label) => label.name !== releaseLabel)
								.map((label) => (
									<div
										key={label.node_id}
										className="badge margin-right--xs"
										style={{ backgroundColor: `#${label.color}` }}
									>
										{label.name.replace(/^! /, '')}
									</div>
								))}
						</td>
					</tr>
				))}
			</tbody>
		</table>
	)
}
