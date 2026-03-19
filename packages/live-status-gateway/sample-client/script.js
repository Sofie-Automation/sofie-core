/* eslint-disable no-undef */

const ws = new WebSocket(`ws://localhost:8080`)
ws.addEventListener('message', (message) => {
	const data = JSON.parse(message.data)
	console.log('Received message', data)
	switch (data.event) {
		case 'pong':
			handlePong(data)
			break
		case 'heartbeat':
			handleHeartbeat(data)
			break
		case 'subscriptionStatus':
			handleSubscriptionStatus(data)
			break
		case 'studio':
			handleStudio(data)
			break
		case 'activePlaylist':
			handleActivePlaylist(data)
			break
		case 'segments':
			handleSegments(data)
			break
		case 'activePieces':
			handleActivePieces(data)
			break
		case 'adLibs':
			handleAdLibs(data)
			break
	}
})

ws.addEventListener('open', () => {
	console.log('socket open')

	ws.send(JSON.stringify({ event: 'subscribe', subscription: { name: 'activePlaylist' }, reqid: 1 }))

	ws.send(JSON.stringify({ event: 'subscribe', subscription: { name: 'segments' }, reqid: 2 }))
	ws.send(JSON.stringify({ event: 'subscribe', subscription: { name: 'activePieces' }, reqid: 3 }))
	ws.send(JSON.stringify({ event: 'subscribe', subscription: { name: 'adLibs' }, reqid: 4 }))
})

ws.addEventListener('close', () => {
	console.log('socket close')
})

ws.addEventListener('error', (error) => {
	console.log('socket error', error)
})

function handlePong() {
	//
}

function handleHeartbeat() {
	//
}

function handleSubscriptionStatus() {
	//
}

function handleStudio() {
	//
}

const TIME_OF_DAY_SPAN_ID = 'time-of-day'
const SEGMENT_DURATION_SPAN_CLASS = 'segment-duration'
const SEGMENT_REMAINIG_SPAN_ID = 'segment-remaining'
const PART_REMAINIG_SPAN_ID = 'part-remaining'
const T_TIMERS_DIV_ID = 't-timers'
const ACTIVE_PIECES_SPAN_ID = 'active-pieces'
const NEXT_PIECES_SPAN_ID = 'next-pieces'
const SEGMENTS_DIV_ID = 'segments'
const ADLIBS_DIV_ID = 'adlibs'
const GLOBAL_ADLIBS_DIV_ID = 'global-adlibs'
const ENABLE_SYNCED_TICKS = true

let activePlaylist = {}
function handleActivePlaylist(data) {
	activePlaylist = data

	const nextPiecesEl = document.getElementById(NEXT_PIECES_SPAN_ID)
	nextPiecesEl.innerHTML =
		'<ul><li>' +
		activePlaylist.nextPart.pieces.map((p) => `${p.name} [${p.tags || []}]`).join('</li><li>') +
		'</li><ul>'

	handleTTimers(data.tTimers)
}
let activePieces = {}
function handleActivePieces(data) {
	activePieces = data
	const activePiecesEl = document.getElementById(ACTIVE_PIECES_SPAN_ID)
	activePiecesEl.innerHTML =
		'<ul><li>' + activePieces.activePieces.map((p) => `${p.name} [${p.tags || []}]`).join('</li><li>') + '</li><ul>'
}
let adLibs = {}
function handleAdLibs(data) {
	adLibs = data
	const activePiecesEl = document.getElementById(ADLIBS_DIV_ID)
	activePiecesEl.innerHTML =
		'<ul><li>' + adLibs.adLibs.map((p) => `${p.name} [${p.tags || []}]`).join('</li><li>') + '</li><ul>'
	const globalActivePiecesEl = document.getElementById(GLOBAL_ADLIBS_DIV_ID)
	globalActivePiecesEl.innerHTML =
		'<ul><li>' + adLibs.globalAdLibs.map((p) => `${p.name}`).join('</li><li>') + '</li><ul>'
}

setInterval(() => {
	const segmentRemainingEl = document.getElementById(SEGMENT_REMAINIG_SPAN_ID)
	const partRemainingEl = document.getElementById(PART_REMAINIG_SPAN_ID)
	const segmentEndTime = activePlaylist.currentSegment && activePlaylist.currentSegment.timing.projectedEndTime
	const partEndTime = activePlaylist.currentPart && activePlaylist.currentPart.timing.projectedEndTime

	const currentSegmentId = activePlaylist.currentPart && activePlaylist.currentPart.segmentId
	const now = ENABLE_SYNCED_TICKS ? Math.floor(Date.now() / 1000) * 1000 : Date.now()
	if (currentSegmentId && activePlaylist.currentPart) {
		const currentSegmentEl = document.getElementById(activePlaylist.currentPart.segmentId)
		if (currentSegmentEl) {
			const durationEl = currentSegmentEl.querySelector('.' + SEGMENT_DURATION_SPAN_CLASS)
			durationEl.textContent = formatMillisecondsToTime(segmentEndTime - now)
		}
	}
	if (segmentEndTime) segmentRemainingEl.textContent = formatMillisecondsToTime(segmentEndTime - now)
	if (partEndTime) partRemainingEl.textContent = formatMillisecondsToTime(Math.ceil(partEndTime / 1000) * 1000 - now)

	updateClock()
	updateTTimers(activePlaylist.tTimers)
}, 100)

function updateClock() {
	const now = new Date()
	const hours = now.getHours()
	const minutes = now.getMinutes()
	const seconds = now.getSeconds()
	const formattedTime = formatMillisecondsToTime(hours * 3600000 + minutes * 60000 + seconds * 1000)

	const clockElement = document.getElementById(TIME_OF_DAY_SPAN_ID)
	if (clockElement) {
		clockElement.textContent = formattedTime
	}
}

function handleSegments(data) {
	const targetDiv = document.getElementById(SEGMENTS_DIV_ID)

	if (targetDiv) {
		const existingUl = targetDiv.querySelector('ul')
		if (existingUl) {
			targetDiv.removeChild(existingUl)
		}

		const ul = document.createElement('ul')

		data.segments.forEach((segment) => {
			const li = document.createElement('li')
			li.id = segment.id
			const spanElement = document.createElement('span')
			spanElement.classList = [SEGMENT_DURATION_SPAN_CLASS]
			spanElement.textContent = formatMillisecondsToTime(
				segment.timing.budgetDurationMs || segment.timing.expectedDurationMs
			)
			const textNodeAfter = document.createTextNode(' ' + segment.name)
			li.appendChild(spanElement)
			li.appendChild(textNodeAfter)
			ul.appendChild(li)
		})

		targetDiv.appendChild(ul)
	}
}

function formatMillisecondsToTime(milliseconds) {
	const isNegative = milliseconds < 0
	milliseconds = Math.abs(milliseconds)

	const totalSeconds = Math.round(milliseconds / 1000)
	const totalMinutes = Math.floor(totalSeconds / 60)
	const totalHours = Math.floor(totalMinutes / 60)

	const formattedHours = String(totalHours).padStart(2, '0')
	const formattedMinutes = String(totalMinutes % 60).padStart(2, '0')
	const formattedSeconds = String(totalSeconds % 60).padStart(2, '0')

	return `${isNegative ? '+' : ''}${formattedHours}:${formattedMinutes}:${formattedSeconds}`
}

function handleTTimers(tTimers) {
	const tTimersDiv = document.getElementById(T_TIMERS_DIV_ID)
	if (!tTimersDiv || !tTimers) return

	const ul = document.createElement('ul')

	tTimers.forEach((timer) => {
		const li = document.createElement('li')
		li.id = `t-timer-${timer.index}`
		li.textContent = `Timer ${timer.index}:`

		const detailUl = document.createElement('ul')

		if (timer.configured) {
			// Type
			const typeLi = document.createElement('li')
			typeLi.textContent = `Type: "${timer.mode.type}"`
			detailUl.appendChild(typeLi)

			// Label
			const labelLi = document.createElement('li')
			labelLi.textContent = `Label: ${timer.label ? JSON.stringify(timer.label) : '(no label)'}`
			detailUl.appendChild(labelLi)

			// Value
			const valueLi = document.createElement('li')
			valueLi.appendChild(document.createTextNode('Value: '))
			const valueSpan = document.createElement('span')
			valueSpan.id = `t-timer-value-${timer.index}`
			valueLi.appendChild(valueSpan)
			detailUl.appendChild(valueLi)

			// Projected (if available)
			if (timer.projected && timer.anchorPartId) {
				const projectedLi = document.createElement('li')
				projectedLi.id = `t-timer-projected-${timer.index}`
				detailUl.appendChild(projectedLi)
			}
		} else {
			// Show "Not set" for unconfigured timers
			const notSetLi = document.createElement('li')
			notSetLi.textContent = 'Not set'
			detailUl.appendChild(notSetLi)
		}

		li.appendChild(detailUl)
		ul.appendChild(li)
	})

	tTimersDiv.innerHTML = ''
	tTimersDiv.appendChild(ul)
}

function updateTTimers(tTimers) {
	if (!tTimers) return

	const now = ENABLE_SYNCED_TICKS ? Math.floor(Date.now() / 1000) * 1000 : Date.now()

	tTimers.forEach((timer) => {
		if (!timer.configured) return

		const valueSpan = document.getElementById(`t-timer-value-${timer.index}`)
		if (!valueSpan) return

		// Calculate current timer value
		let currentTime
		if (timer.state.paused) {
			currentTime = timer.state.duration
		} else {
			currentTime = timer.state.zeroTime - now
		}

		valueSpan.textContent = formatMillisecondsToTime(currentTime)

		// Update projected time if available
		const projectedLi = document.getElementById(`t-timer-projected-${timer.index}`)
		if (projectedLi && timer.projected) {
			let projectedTime
			if (timer.projected.paused) {
				projectedTime = timer.projected.duration
			} else {
				projectedTime = timer.projected.zeroTime - now
			}

			const diff = currentTime - projectedTime
			const diffStr = formatMillisecondsToTime(Math.abs(diff))
			const status = diff > 0 ? 'under' : 'over'

			projectedLi.textContent = `Projected: ${formatMillisecondsToTime(projectedTime)} (${diffStr} ${status})`
		}
	})
}
