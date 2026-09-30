import React, { useState } from 'react'

/**
 * This is a demo showing the interactions between the part and piece groups on the timeline.
 * The maths should be the same as in `packages/corelib/src/playout/timings.ts`, but in a simplified form
 */

const MS_TO_PIXEL_CONSTANT = 0.1

const viewPortStyle = {
	width: '100%',
	backgroundSize: '40px 40px',
	backgroundImage:
		'linear-gradient(to right, grey 1px, transparent 1px), linear-gradient(to bottom, grey 1px, transparent 1px)',
	overflowX: 'hidden',
	display: 'flex',
	flexDirection: 'column',
	position: 'relative',
}

export function PartTimingsDemo() {
	const [postrollA1, setPostrollA1] = useState(0)
	const [postrollA2, setPostrollA2] = useState(0)
	const [prerollB1, setPrerollB1] = useState(0)
	const [prerollB2, setPrerollB2] = useState(0)
	const [outTransitionDuration, setOutTransitionDuration] = useState(0)
	const [inTransitionBlockDuration, setInTransitionBlockDuration] = useState(0)
	const [inTransitionContentsDelay, setInTransitionContentsDelay] = useState(0)
	const [inTransitionKeepaliveDuration, setInTransitionKeepaliveDuration] = useState(0)
	const [inTransitionPieceDuration, setInTransitionPieceDuration] = useState(0)
	const [exclusiveOutTransition, setExclusiveOutTransition] = useState(false)
	const [exclusiveOutBlockDuration, setExclusiveOutBlockDuration] = useState(0)
	const [exclusiveOutContentsDelay, setExclusiveOutContentsDelay] = useState(0)
	const [exclusiveOutKeepaliveDuration, setExclusiveOutKeepaliveDuration] = useState(0)
	const [exclusiveOutPieceDuration, setExclusiveOutPieceDuration] = useState(0)

	// Arbitrary point in time for the take to be based around
	const takeTime = 2400

	// Exactly one transition is used. An 'exclusive' outTransition on Part A replaces the inTransition of Part B
	const keepaliveDuration = exclusiveOutTransition ? exclusiveOutKeepaliveDuration : inTransitionKeepaliveDuration
	const contentsDelay = exclusiveOutTransition ? exclusiveOutContentsDelay : inTransitionContentsDelay
	const blockDuration = exclusiveOutTransition ? exclusiveOutBlockDuration : inTransitionBlockDuration
	// The additive outTransition duration is not used by an 'exclusive' outTransition
	const additiveOutTransitionDuration = exclusiveOutTransition ? 0 : outTransitionDuration

	const outTransitionTime = additiveOutTransitionDuration - keepaliveDuration

	// The amount of time needed to preroll Part B before the 'take' point
	const partBPreroll = Math.max(prerollB1, prerollB2)
	const prerollTime = partBPreroll - contentsDelay

	// The amount to delay the part 'switch' to, to ensure the outTransition has time to complete as well as any prerolls for part B
	const takeOffset = Math.max(0, outTransitionTime, prerollTime)
	const takeDelayed = takeTime + takeOffset

	// Calculate the part A objects
	const pieceA1 = { time: 0, duration: takeDelayed + keepaliveDuration + postrollA1 }
	const pieceA2 = { time: 0, duration: takeDelayed + keepaliveDuration + postrollA2 }
	const partA = { time: 0, duration: Math.max(pieceA1.duration, pieceA2.duration) } // part stretches to contain the piece

	// Calculate the transition objects
	const pieceOutTransition = exclusiveOutTransition
		? // An 'exclusive' outTransition piece starts with the transition
			{ time: takeDelayed, duration: exclusiveOutPieceDuration }
		: {
				time: partA.time + partA.duration - outTransitionDuration - Math.max(postrollA1, postrollA2),
				duration: outTransitionDuration,
			}
	// The inTransition piece is not played when it has been replaced
	const pieceInTransition = exclusiveOutTransition ? null : { time: takeDelayed, duration: inTransitionPieceDuration }

	// Calculate the part B objects
	const partBBaseDuration = 2600
	const partB = { time: takeTime, duration: partBBaseDuration + takeOffset }
	const pieceB1 = { time: takeDelayed + contentsDelay - prerollB1, duration: partBBaseDuration + prerollB1 }
	const pieceB2 = { time: takeDelayed + contentsDelay - prerollB2, duration: partBBaseDuration + prerollB2 }
	const pieceB3 = { time: takeDelayed + contentsDelay + 300, duration: 200 }

	return (
		<div>
			<div style={viewPortStyle}>
				{pieceInTransition && <TimelineGroup {...pieceInTransition} name="In Transition" color="pink" />}
				<TimelineGroup {...pieceOutTransition} name="Out Transition" color="lightblue" />

				<TimelineGroup {...partA} name="PartGroup A" color="green" />
				<TimelineGroup {...pieceA1} name="Piece A1" color="orange" />
				<TimelineGroup {...pieceA2} name="Piece A2" color="orange" />

				<TimelineGroup {...partB} name="PartGroup B" color="green" />
				<TimelineGroup {...pieceB1} name="Piece B1" color="orange" />
				<TimelineGroup {...pieceB2} name="Piece B2" color="orange" />
				<TimelineGroup {...pieceB3} name="Super B3" color="orange" />

				<TimelineMarker time={takeTime} title="Take time" />
				<TimelineMarker time={takeDelayed} title="Take Delayed" />
				<TimelineMarker time={takeDelayed + contentsDelay} title="Content Base time" />
				<TimelineMarker time={takeTime + blockDuration} title="Takes out of Part B allowed" color="blue" />
			</div>

			{/* Controls */}
			<table className="margin-top--md">
				<InputRow label="Piece B1 Preroll Duration" max={1000} value={prerollB1} setValue={setPrerollB1} />
				<InputRow label="Piece B2 Preroll Duration" max={1000} value={prerollB2} setValue={setPrerollB2} />
				<InputRow label="Piece A1 Postroll Duration" max={1000} value={postrollA1} setValue={setPostrollA1} />
				<InputRow label="Piece A2 Postroll Duration" max={1000} value={postrollA2} setValue={setPostrollA2} />
				<CheckboxRow
					label="Part A has an 'exclusive' Out Transition"
					value={exclusiveOutTransition}
					setValue={setExclusiveOutTransition}
				/>
				{exclusiveOutTransition ? (
					<>
						<InputRow
							label="Part A Out Transition Block Duration"
							max={1000}
							value={exclusiveOutBlockDuration}
							setValue={setExclusiveOutBlockDuration}
						/>
						<InputRow
							label="Part A Out Transition Next Part Contents Delay"
							max={1000}
							value={exclusiveOutContentsDelay}
							setValue={setExclusiveOutContentsDelay}
						/>
						<InputRow
							label="Part A Out Transition Keepalive"
							max={1000}
							value={exclusiveOutKeepaliveDuration}
							setValue={setExclusiveOutKeepaliveDuration}
						/>
						<InputRow
							label="Part A Out Transition Piece Duration"
							max={1000}
							value={exclusiveOutPieceDuration}
							setValue={setExclusiveOutPieceDuration}
						/>
					</>
				) : (
					<>
						<InputRow
							label="Part A Out Transition Duration"
							max={1000}
							value={outTransitionDuration}
							setValue={setOutTransitionDuration}
						/>
						<InputRow
							label="Part B In Transition Block Duration"
							max={1000}
							value={inTransitionBlockDuration}
							setValue={setInTransitionBlockDuration}
						/>
						<InputRow
							label="Part B In Transition Contents Delay"
							max={1000}
							value={inTransitionContentsDelay}
							setValue={setInTransitionContentsDelay}
						/>
						<InputRow
							label="Part B In Transition Keepalive"
							max={1000}
							value={inTransitionKeepaliveDuration}
							setValue={setInTransitionKeepaliveDuration}
						/>
						<InputRow
							label="Part B In Transition Piece Duration"
							max={1000}
							value={inTransitionPieceDuration}
							setValue={setInTransitionPieceDuration}
						/>
					</>
				)}
			</table>
		</div>
	)
}

function TimelineGroup({ duration, time, name, color }) {
	return (
		<div
			style={{
				height: '25px',
				marginBottom: '2px',
				whiteSpace: 'nowrap',

				marginLeft: `${time * MS_TO_PIXEL_CONSTANT}px`,
				width: `${duration * MS_TO_PIXEL_CONSTANT}px`,
				background: color,
			}}
		>
			{name}
		</div>
	)
}

function TimelineMarker({ time, title, color = 'red' }) {
	return (
		<div
			style={{
				borderLeft: `2px dashed ${color}`,
				display: 'inline-block',
				width: '1px',

				float: 'left',
				position: 'absolute',
				top: 0,
				height: '100%',

				marginLeft: `${time * MS_TO_PIXEL_CONSTANT}px`,
			}}
			title={title}
		>
			&nbsp;
		</div>
	)
}

function InputRow({ label, max, value, setValue }) {
	return (
		<tr>
			<td>{label}</td>
			<td>
				<input
					type="range"
					min={0}
					max={max}
					value={value}
					onChange={(e) => setValue(parseInt(e.currentTarget.value))}
				/>
			</td>
		</tr>
	)
}

function CheckboxRow({ label, value, setValue }) {
	return (
		<tr>
			<td>{label}</td>
			<td>
				<input type="checkbox" checked={value} onChange={(e) => setValue(e.currentTarget.checked)} />
			</td>
		</tr>
	)
}
