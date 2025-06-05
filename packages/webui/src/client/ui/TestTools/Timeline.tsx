import * as React from 'react'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import * as _ from 'underscore'
import { deserializeTimelineBlob, TimelineHash } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { applyToArray, clone, normalizeArray, protectString } from '../../lib/tempLib'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import {
	TimelineState,
	ResolvedTimelineObjectInstance,
	ResolvedTimeline,
	ResolvedTimelineObject,
	TimelineObjectInstance,
	resolveTimeline,
	getResolvedState,
} from 'superfly-timeline'
import { TimelineContentObject, transformTimeline } from '@sofie-automation/corelib/dist/playout/timeline'
import { useCurrentTime } from '../../lib/lib'
import { StudioSelect } from './StudioSelect'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Classnames from 'classnames'
import { createSyncPeripheralDeviceCustomPublicationMongoCollection } from '../../collections/lib'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevicePubSubCollectionsNames } from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'

export const StudioTimeline = createSyncPeripheralDeviceCustomPublicationMongoCollection(
	PeripheralDevicePubSubCollectionsNames.studioTimeline
)

interface TimelineViewRouteParams {
	studioId: string | undefined
}
function TimelineView(): JSX.Element {
	const { t } = useTranslation()

	const { studioId } = useParams<TimelineViewRouteParams>()

	return (
		<div className="mtl gutter">
			<header className="mvs">
				<h1>{t('Timeline')}</h1>
			</header>
			<div className="mod mvl">
				{studioId && (
					<div>
						<ComponentTimelineSimulate studioId={protectString(studioId)} />
					</div>
				)}
			</div>
		</div>
	)
}

interface ITimelineSimulateProps {
	studioId: StudioId
}
function ComponentTimelineSimulate({ studioId }: Readonly<ITimelineSimulateProps>) {
	useSubscription(MeteorPubSub.timelineForStudio, studioId)

	const now = useCurrentTime()
	const tlComplete = useTracker(() => StudioTimeline.findOne(studioId), [studioId])

	const [resolvedTimeline, errorMsgResolve] = useMemo(() => {
		try {
			const timelineObj = tlComplete && deserializeTimelineBlob(tlComplete.timelineBlob)
			console.log('regen timeline', tlComplete?.timelineHash, tlComplete?.generated)

			let timeline: TimelineContentObject[] = []
			if (tlComplete && timelineObj) {
				timeline = transformTimeline(
					timelineObj.sort((a, b) => {
						if (a.id > b.id) {
							return 1
						}
						if (a.id < b.id) {
							return -1
						}
						return 0
					})
				)

				// Replace now's with concrete times approximating now
				for (const obj of timeline) {
					// is part group/cap object
					applyToArray(obj.enable, (enable) => {
						if (enable.start === 'now') {
							enable.start = now
						}
					})

					const groupStart = !Array.isArray(obj.enable) ? obj.enable.start : null
					if (typeof groupStart === 'number') {
						const relativeNow = now - groupStart
						// is a piece group or piece related object
						for (const child of obj.children ?? []) {
							applyToArray(child.enable, (enable) => {
								if (enable.start === 'now') {
									enable.start = relativeNow
								}
							})
						}
					}
				}
			}

			// TODO - dont repeat unless changed
			const tl = resolveTimeline(timeline as any, { time: now })
			return [tl, undefined]
		} catch (e) {
			return [undefined, `Failed to resolveTimeline:\n${e}`]
		}
	}, [tlComplete, now])

	return (
		<div>
			<div>
				<h2 className="mhn">Timeline state</h2>
				{errorMsgResolve ? (
					<p>{errorMsgResolve}</p>
				) : (
					<TimelineStateTable resolvedTimeline={resolvedTimeline} now={now} />
				)}

				<div>
					<h2 className="mhn">Instances</h2>
					<TimelineInstancesTable resolvedTl={resolvedTimeline} />
				</div>

				<div>
					<h2 className="mhn">Events</h2>
					<TimelineChangesLog resolvedTl={resolvedTimeline} timelineHash={tlComplete?.timelineHash} />
				</div>
			</div>
		</div>
	)
}

type FilterInputValue = RegExp | string | undefined
interface FilterInputProps {
	filterChanged: (val: FilterInputValue) => void
}
function FilterInput({ filterChanged }: Readonly<FilterInputProps>) {
	const [filterText, setFilterText] = useState<string>('')
	const changeFilter = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setFilterText(e.target.value)
	}, [])
	const [isError, setIsError] = useState(false)

	useEffect(() => {
		if (!filterText || typeof filterText !== 'string') {
			filterChanged(undefined)
			setIsError(false)
		} else if (RegExp(/^\/.+\/$/).exec(filterText)) {
			try {
				filterChanged(new RegExp(filterText.substr(1, filterText.length - 2)))
				setIsError(false)
			} catch (e) {
				setIsError(true)
			}
		} else {
			filterChanged(filterText)
			setIsError(false)
		}
	}, [filterText])

	return (
		<input
			type="text"
			value={filterText}
			onChange={changeFilter}
			placeholder="Text or /RegEx/"
			className={Classnames({
				'highlight-is-error': isError,
			})}
		/>
	)
}

interface TimelineStateTableProps {
	now: number
	resolvedTimeline: ResolvedTimeline | undefined
}
function TimelineStateTable({ resolvedTimeline, now }: Readonly<TimelineStateTableProps>) {
	const [viewTime, setViewTime] = useState<number | null>(null)
	const selectViewTime = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
		const val = Number(e.target.value)
		setViewTime(isNaN(val) ? null : val)
	}, [])

	const [layerFilter, setLayerFilter] = useState<FilterInputValue>(undefined)

	if (!resolvedTimeline) return null

	const state = getResolvedState(resolvedTimeline, viewTime ?? now, 1)
	const times = _.uniq((state?.nextEvents ?? []).map((e) => e.time))

	return (
		<div>
			<div className="flex-row mbl">
				<div className="col mrl">
					Time:{' '}
					<select onChange={selectViewTime} value={viewTime ?? 'now'}>
						<option id="now">Now: {now}</option>
						{times.map((e) => (
							<option id={e + ''} key={e}>
								{e}
							</option>
						))}
					</select>
				</div>
				<div className="col">
					Layer Filter: <FilterInput filterChanged={setLayerFilter} />
				</div>
			</div>
			<table className="testtools-timelinetable">
				<tbody>
					<tr>
						<th>Layer</th>
						<th>id</th>
						<th>Enable</th>
						<th>Instance Times</th>
						<th>type</th>
						<th>classes</th>
						<th>content</th>
					</tr>
					{state ? renderTimelineState(state, layerFilter) : ''}
				</tbody>
			</table>
		</div>
	)
}

function renderTimelineState(state: TimelineState, filter: RegExp | string | undefined) {
	const sortedLayers = _.sortBy(Object.values<ResolvedTimelineObjectInstance>(state.layers), (o) => o.layer)
	let filteredLayers: ResolvedTimelineObjectInstance[] = sortedLayers
	if (filter) {
		if (typeof filter === 'string') {
			filteredLayers = filteredLayers.filter((o) => String(o.layer).includes(filter))
		} else {
			filteredLayers = filteredLayers.filter((o) => !!RegExp(filter).exec(String(o.layer)))
		}
	}

	return filteredLayers.map((o) => (
		<tr key={o.layer}>
			<td>{o.layer}</td>
			<td style={{ maxWidth: '25vw', minWidth: '10vw', overflowWrap: 'anywhere' }}>{o.id}</td>
			<td style={{ whiteSpace: 'pre', maxWidth: '15vw', overflowX: 'auto' }}>
				<pre>{JSON.stringify(o.enable, undefined, '\t')}</pre>
			</td>
			<td>
				Start: {o.instance.start}
				<br />
				End: {o.instance.end}
			</td>
			<td>{o.content.type}</td>
			<td>{(o.classes ?? []).join('<br />')}</td>
			<td style={{ whiteSpace: 'pre' }}>
				<pre>{JSON.stringify(o.content, undefined, '\t')}</pre>
			</td>
		</tr>
	))
}

interface TimelineInstancesTableProps {
	resolvedTl: ResolvedTimeline | undefined
}
function TimelineInstancesTable({ resolvedTl }: Readonly<TimelineInstancesTableProps>) {
	const [idFilter, setIdFilter] = useState<FilterInputValue>(undefined)

	return (
		<div>
			<div className="flex-row mbl">
				<div className="col">
					Id Filter: <FilterInput filterChanged={setIdFilter} />
				</div>
			</div>
			<table className="testtools-timelinetable">
				<tbody>
					<tr>
						<th>Id</th>
						<th>Layer</th>
						<th>Parent</th>
						<th>Instance Times</th>
					</tr>
					{resolvedTl ? renderTimelineInstances(resolvedTl, idFilter) : ''}
				</tbody>
			</table>
		</div>
	)
}

function renderTimelineInstances(resolvedTl: ResolvedTimeline, filter: RegExp | string | undefined) {
	const sortedObjects = _.sortBy(
		Object.values<ResolvedTimelineObject>(resolvedTl.objects),
		(o) => `${o.layer}:::${o.id}`
	)

	let filteredObjects: ResolvedTimelineObject[] = sortedObjects
	if (filter) {
		if (typeof filter === 'string') {
			filteredObjects = filteredObjects.filter((o) => o.id.includes(filter))
		} else {
			filteredObjects = filteredObjects.filter((o) => !!RegExp(filter).exec(o.id))
		}
	}

	return filteredObjects.map((o) => (
		<tr key={o.id}>
			<td>{o.id}</td>
			<td>{o.layer}</td>
			<td>{o.resolved?.parentId ?? ''}</td>
			<td>
				{o.resolved?.instances?.map((instance) => <p key={instance.id}>{`${instance.start} - ${instance.end}`}</p>) ??
					'NONE'}
			</td>
		</tr>
	))
}

interface TimelineChangesLogProps {
	timelineHash: TimelineHash | undefined
	resolvedTl: ResolvedTimeline | undefined
}

interface ChangeEntry {
	forceShow?: boolean
	msg: string
}

function TimelineChangesLog({ resolvedTl, timelineHash }: Readonly<TimelineChangesLogProps>) {
	const [lastResolvedTl, setLastResolvedTl] = useState<ResolvedTimeline | null>(null)
	const [idFilter, setIdFilter] = useState<FilterInputValue>(undefined)

	const [entries, setEntries] = useState<ChangeEntry[]>([])

	useEffect(() => {
		setEntries((old) => [
			...old,
			{
				forceShow: true,
				msg: `New timeline ${timelineHash}!`,
			},
		])
	}, [timelineHash])

	useEffect(() => {
		const newEntries: ChangeEntry[] = [
			// {
			// 	msg: 'New timeline!',
			// },
		]

		if (resolvedTl && lastResolvedTl) {
			const keys = Array.from(
				new Set([...Object.keys(lastResolvedTl.objects), ...Object.keys(resolvedTl.objects)])
			).sort((a, b) => a.localeCompare(b))

			for (const objectId of keys) {
				const oldObj = lastResolvedTl.objects[objectId] as ResolvedTimelineObject | undefined
				const newObj = resolvedTl.objects[objectId] as ResolvedTimelineObject | undefined

				if (oldObj && !newObj) {
					newEntries.push({ msg: `Object "${objectId}" removed` })
				} else if (!oldObj && newObj) {
					newEntries.push({ msg: `Object "${objectId}" added with ${newObj.resolved.instances.length} instances` })
					for (const instance of newObj.resolved.instances) {
						newEntries.push({
							msg: `Instance "${objectId}${instance.id}" added - start: ${instance.start} end: ${instance.end}`,
						})
					}
				} else if (newObj && oldObj) {
					const oldInstancesMap = normalizeArray(oldObj.resolved.instances, 'id')
					const newInstancesMap = normalizeArray(newObj.resolved.instances, 'id')

					const instanceKeys = Array.from(
						new Set([...Object.keys(oldInstancesMap), ...Object.keys(newInstancesMap)])
					).sort((a, b) => a.localeCompare(b))

					for (const instanceId of instanceKeys) {
						const oldInstance = oldInstancesMap[instanceId] as TimelineObjectInstance | undefined
						const newInstance = newInstancesMap[instanceId] as TimelineObjectInstance | undefined

						if (oldInstance && !newInstance) {
							newEntries.push({ msg: `Instance "${objectId}${oldInstance.id}" removed` })
						} else if (!oldInstance && newInstance) {
							newEntries.push({
								msg: `Instance "${objectId}${newInstance.id}" added - start: ${newInstance.start} end: ${newInstance.end}`,
							})
						} else if (newInstance && oldInstance) {
							let changes = ''

							if (newInstance.start !== oldInstance.start)
								changes += ` start: ${newInstance.start} !== ${oldInstance.start}`
							if (newInstance.end !== oldInstance.end) changes += ` end: ${newInstance.end} !== ${oldInstance.end}`

							if (changes.length > 0) {
								newEntries.push({ msg: `Instance "${objectId}${oldInstance.id}" changed:${changes}` })
							}
						} else {
							// Ignore instance that is not present in either
						}
					}
				} else {
					// Ignore object that is not present in either
				}
			}
		}

		if (newEntries.length) setEntries((old) => [...old, ...newEntries])
		setLastResolvedTl(clone(resolvedTl) ?? null)
	}, [resolvedTl])

	const doClear = useCallback(() => {
		setEntries([])
	}, [])

	const showEntries = useMemo(() => {
		if (idFilter) {
			if (typeof idFilter === 'string') {
				return entries.filter((o) => !!o.forceShow || o.msg.includes(idFilter))
			} else {
				return entries.filter((o) => !!o.forceShow || !!RegExp(idFilter).exec(o.msg))
			}
		} else {
			return entries
		}
	}, [entries, idFilter])

	return (
		<div>
			<div className="flex-row mbl">
				<div className="col">
					Id Filter: <FilterInput filterChanged={setIdFilter} />
				</div>
				<div className="col">
					<button onClick={doClear}>Clear Events</button>
				</div>
			</div>
			<table className="testtools-timelinetable">
				<tbody>
					<tr>
						<th>Msg</th>
					</tr>
					{showEntries.map((e, i) => (
						<tr key={i}>
							<td>{e.msg}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}

function TimelineStudioSelect(): JSX.Element {
	return <StudioSelect path="timeline" title="Timeline" />
}

export { TimelineView, TimelineStudioSelect }
