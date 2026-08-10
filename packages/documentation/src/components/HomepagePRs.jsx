import React, { useEffect, useLayoutEffect, useState, useRef } from "react";
import './HomepagePRs.css';

const GITHUB_API_URL = 'https://api.github.com'

const GITHUB_ORGANIZATION = "Sofie-Automation"
const GITHUB_REPO = "sofie-core"

export function HomepagePRs() {
	const [isReady, setIsReady] = useState("error")
	const [pulls, setPulls] = useState([])

	useEffect(() => {
		let mounted = true
		fetch(`${GITHUB_API_URL}/repos/${GITHUB_ORGANIZATION}/${GITHUB_REPO}/pulls?state=all&sort=updated&direction=desc&per_page=100`, {
			headers: [['Accept', 'application/vnd.github.text+json']],
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
				setPulls(data.filter((pull) => !pull.draft && (pull.state === 'closed' && pull.merged_at || pull.state === 'open')))
				setIsReady("done")
			})
			.catch((error) => {
				if (!mounted) return
				console.error(error)
				setIsReady("error")
			})

		return () => {
			mounted = false
		}
	}, [])

	return (
		<React.Fragment>
			<div className="container">
				<h2 className="homepage-prs-title">What's the latest in Sofie?</h2>
			</div>
			{isReady === "error" && <div className="homepage-prs-error">Failed to load recent pull requests from GitHub.</div>}
			{isReady === "loading" && <div className="homepage-prs-loading">Loading recent pull requests...</div>}
			{isReady === "done" && <div className="homepage-pr-gallery">
				{chunkArray(pulls, 3).map((chunk, chunkIndex) => (
					<AnimatedRow pulls={chunk} key={chunkIndex} speed={0.025 * (chunkIndex + 1)} />
				))}
			</div>}
		</React.Fragment>
	)
}

function AnimatedRow(props) {
	const { pulls, speed } = props
	const ref = useRef()
	const pausedRef = useRef(false)

	const [elementWidth, setElementWidth] = useState(0)
	const [containerWidth, setContainerWidth] = useState(0)

	useLayoutEffect(() => {
		const element = ref.current
		if (!element) return

		console.log(elementWidth, containerWidth)

		let animationFrameId
		let lastTimestamp = null

		let scrollAmount = 0

		function animate(timestamp) {
			if (elementWidth <= containerWidth) return // No need to scroll if content fits
			if (elementWidth - scrollAmount < containerWidth) {
				scrollAmount = 0 // Reset scroll to start when we've scrolled through all content
			}
			if (lastTimestamp !== null && !pausedRef.current) {
				const delta = timestamp - lastTimestamp
				scrollAmount += delta * (speed || 0.05) // Adjust the speed here (0.05 is the default speed factor)
				element.style.transform = `translateX(-${scrollAmount}px)`;
			}
			lastTimestamp = timestamp
			animationFrameId = requestAnimationFrame(animate)
		}

		animationFrameId = requestAnimationFrame(animate)

		return () => {
			cancelAnimationFrame(animationFrameId)
		}
	}, [speed, elementWidth, containerWidth])

	useLayoutEffect(() => {
		const element = ref.current
		if (!element) return

		const updateWidth = () => {
			setElementWidth(element.scrollWidth)
		}
		const updateContainerWidth = () => {
			setContainerWidth(element.clientWidth)
		}

		updateWidth()
		updateContainerWidth()

		window.addEventListener('resize', updateWidth)
		window.addEventListener('resize', updateContainerWidth)
		return () => {
			window.removeEventListener('resize', updateWidth)
			window.removeEventListener('resize', updateContainerWidth)
		}
	}, [pulls])

	function handleMouseEnter() {
		pausedRef.current = true
	}

	function handleMouseLeave() {
		pausedRef.current = false
	}

	return (
		<div className="homepage-pr-gallery-row" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
			<div className="homepage-pr-gallery-row-inner" ref={ref}>
				{pulls.map((pull) => {
					return (
						<div className="homepage-pr-gallery-pull" key={String(pull.id)}>
							<div className="homepage-pr-gallery-pull-header">
								<div className="homepage-pr-gallery-pull-number">#{pull['number']}</div>
								<div className="homepage-pr-gallery-pull-title">
									<a href={pull.html_url} target="_blank" rel="noopener noreferrer">{pull.title}</a>
								</div>
							</div>
							<SponsorBadge sponsorLabel={pull.labels.find((label) => label.name.match(/contr(\w+) (from|by)/i))} />
							<div className="homepage-pr-gallery-pull-author">
								<div className="homepage-pr-gallery-pull-author-avatar" style={{ "--user-avatar": `url("${pull.user.avatar_url}")` }}></div>
								<div className="homepage-pr-gallery-pull-author-name">{pull.user.login}</div>
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}

function chunkArray(arr, chunkCount) {
	const arrLength = arr.length;
	const chunkSize = Math.floor(arrLength / chunkCount);

	const result = [];
	for (let i = 0; i < chunkCount - 1; i++) {
		result.push(arr.slice(i * chunkSize, (i + 1) * chunkSize))
	}

	// last chunk contains the remainer of stuff
	result.push(arr.slice((chunkCount - 1) * chunkSize))
	return result
}

function SponsorBadge(props) {
	if (!props.sponsorLabel) return null

	const { sponsorLabel: label } = props

	return (
		<div className="homepage-pr-gallery-pull-sponsor" style={{ '--label-color': `#${label.color}` }}>{label.name}</div>
	)
}
