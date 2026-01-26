import * as React from 'react'
import { ExpectedPackageWorkStatus } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackageWorkStatuses'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { ExpectedPackageDB } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import Tooltip from 'rc-tooltip'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import ClassNames from 'classnames'
import { ExpectedPackage, ExpectedPackageStatusAPI } from '@sofie-automation/blueprints-integration'
import { useTranslation } from 'react-i18next'
import { DisplayFormattedTime } from '../../RundownList/DisplayFormattedTime.js'
import { PackageWorkStatus } from './PackageWorkStatus.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'

/** How long to wait before considering an unchanged package to not be "working" annymore */
const WORKING_TIMEOUT = 2000

export const PackageStatus: React.FC<{
	package: ExpectedPackageDB
	statuses: ExpectedPackageWorkStatus[]
	device: PeripheralDevice | undefined
}> = function PackageStatus(props) {
	const { t } = useTranslation()

	const getPackageName = useCallback((): string => {
		const p2 = props.package.package as ExpectedPackage.Any
		if (p2.type === ExpectedPackage.PackageType.MEDIA_FILE) {
			return p2.content.filePath || unprotectString(props.package._id)
		} else if (p2.type === ExpectedPackage.PackageType.QUANTEL_CLIP) {
			return p2.content.title || p2.content.guid || unprotectString(props.package._id)
		} else if (p2.type === ExpectedPackage.PackageType.JSON_DATA) {
			return p2.content.path || unprotectString(props.package._id)
		} else if (p2.type === ExpectedPackage.PackageType.HTML_TEMPLATE) {
			return p2.content.path || unprotectString(props.package._id)
		} else {
			assertNever(p2)

			const anyContent = (p2 as any).content
			return anyContent.path || anyContent.filePath || anyContent.title || unprotectString(props.package._id)
		}
	}, [props.package])

	const [isOpen, setIsOpen] = useState(false)
	// const [requiredWorking, setRequiredWorking] = useState(false)
	// const [allWorking, setAllWorking] = useState(false)

	const requiredProgress = useMemo(() => getProgress(props.statuses, true), [props.statuses])
	const allProgress = useMemo(() => getProgress(props.statuses, false), [props.statuses])

	const requiredModifiedHash = useMemo(() => getModifiedHash(props.statuses, true), [props.statuses])
	const allModifiedHash = useMemo(() => getModifiedHash(props.statuses, false), [props.statuses])

	const requiredProgressLastChanged = useMemo(() => Date.now(), [requiredProgress, requiredModifiedHash])
	const allProgressLastChanged = useMemo(() => Date.now(), [allProgress, allModifiedHash])

	const [updateTime, setUpdateTime] = useState(Date.now())

	const requiredWorking = useMemo(
		() => Date.now() - requiredProgressLastChanged < WORKING_TIMEOUT,
		[requiredProgressLastChanged, updateTime]
	)
	const allWorking = useMemo(
		() => Date.now() - allProgressLastChanged < WORKING_TIMEOUT,
		[allProgressLastChanged, updateTime]
	)

	const timeout = useRef<NodeJS.Timeout | null>(null)
	useEffect(() => {
		return () => {
			if (timeout.current) clearTimeout(timeout.current)
		}
	}, [])
	if (!timeout.current && (requiredWorking || allWorking)) {
		// If we're working, make a check again later to see if it has stopped:
		timeout.current = setTimeout(() => {
			timeout.current = null
			setUpdateTime(Date.now())
		}, WORKING_TIMEOUT)
	}

	const statuses = useMemo(() => {
		return props.statuses.sort((a, b) => {
			if ((a.displayRank ?? 999) > (b.displayRank ?? 999)) return 1
			if ((a.displayRank ?? 999) < (b.displayRank ?? 999)) return -1

			return 0
		})
	}, [props.statuses])

	let offlineReasonMessage: string | undefined = undefined
	let connected = true
	if (!props.device) {
		offlineReasonMessage = t('Device not found')
		connected = false
	} else if (!props.device.connected) {
		offlineReasonMessage = t('Package Manager is offline')
		connected = false
	}

	const getPackageStatus = useCallback(() => {
		const labelRequiredProgress = connected
			? requiredProgress < 1
				? `${Math.floor(requiredProgress * 100)}%`
				: t('Ready')
			: '?'
		const labelAllProgress = connected ? (allProgress < 1 ? `${Math.floor(allProgress * 100)}%` : t('Done')) : '?'
		const requiredProgress2 = connected ? requiredProgress : undefined
		const allProgress2 = connected ? allProgress : undefined
		return (
			<>
				<Tooltip overlay={offlineReasonMessage || t('The progress of steps required for playout')} placement="top">
					<span>
						<PackageStatusIcon progress={requiredProgress2} label={labelRequiredProgress} isWorking={requiredWorking} />
					</span>
				</Tooltip>
				<Tooltip overlay={offlineReasonMessage || t('The progress of all steps')} placement="top">
					<span>
						<PackageStatusIcon progress={allProgress2} label={labelAllProgress} isWorking={allWorking} />
					</span>
				</Tooltip>
			</>
		)
	}, [requiredProgress, allProgress, requiredWorking, allWorking, connected])

	return (
		<React.Fragment>
			<tr
				className={ClassNames('package', {
					offline: !!offlineReasonMessage,
				})}
				onClick={(e) => {
					e.preventDefault()
					setIsOpen((isOpen) => !isOpen)
				}}
			>
				<td className="indent"></td>
				<td className="status">{getPackageStatus()}</td>
				<td>
					<span className="package__chevron">
						{isOpen ? <FontAwesomeIcon icon={faChevronDown} /> : <FontAwesomeIcon icon={faChevronRight} />}
					</span>
					<span>
						{/* {statusMessage ? <b>{`${statusMessage}: `}</b> : ''} */}
						{getPackageName()}
					</span>
				</td>
				<td>
					<DisplayFormattedTime displayTimestamp={props.package.created} t={t} />
				</td>
				<td></td>
			</tr>
			{isOpen
				? statuses.map((status) => {
						return <PackageWorkStatus key={unprotectString(status._id)} status={status} connected={connected} />
					})
				: null}
		</React.Fragment>
	)
}

function PackageStatusIcon(
	props: Readonly<{ progress: number | undefined; label: string; isWorking: boolean }>
): JSX.Element {
	const svgCircleSector = (x: number, y: number, radius: number, v: number, color: string) => {
		if (v >= 1) {
			return <circle cx={x} cy={y} r={radius} fill={color}></circle>
		}
		if (v <= 0) return null

		const x0 = x + radius * Math.sin(v * Math.PI * 2)
		const y0 = y - radius * Math.cos(v * Math.PI * 2)

		const flags = v > 0.5 ? '1,1' : '0,1'
		return (
			<path
				d={`M${x},${y}
				L${x},${y - radius}
				A${radius},${radius} 0 ${flags} ${x0},${y0}
				z`}
				fill={color}
			></path>
		)
	}

	const svgCircleSegments = (
		cx: number,
		cy: number,
		radius0: number,
		radius1: number,
		segmentCount: number,
		color: string
	) => {
		const segmentAngle = 1 / segmentCount

		const segment = (key: string, v0: number, v1: number) => {
			const point0 = [cx + radius0 * Math.sin(v0 * Math.PI * 2), cy - radius0 * Math.cos(v0 * Math.PI * 2)]
			const point1 = [cx + radius0 * Math.sin(v1 * Math.PI * 2), cy - radius0 * Math.cos(v1 * Math.PI * 2)]
			const point2 = [cx + radius1 * Math.sin(v1 * Math.PI * 2), cy - radius1 * Math.cos(v1 * Math.PI * 2)]
			const point3 = [cx + radius1 * Math.sin(v0 * Math.PI * 2), cy - radius1 * Math.cos(v0 * Math.PI * 2)]

			return (
				<path
					key={key}
					d={`M${point0[0]},${point0[1]}
					A${radius0},${radius0} 0 0,1 ${point1[0]},${point1[1]}
					L${point2[0]},${point2[1]}
					A${radius1},${radius1} 0 0,1 ${point3[0]},${point3[1]}
					z`}
					fill={color}
				></path>
			)
		}
		const elements: JSX.Element[] = []

		for (let i = 0; i < segmentCount; i++) {
			elements.push(segment('k' + i, segmentAngle * i, segmentAngle * (i + 0.5)))
		}

		// return <div className="package-progress__segments">{elements}</div>
		return elements
	}
	return (
		<div className="package-progress">
			<svg width="100%" viewBox="-50 -50 100 100">
				{props.progress === undefined || props.progress < 1 ? (
					<>
						<circle cx="0" cy="0" r="45" fill="#CCC"></circle>
						{svgCircleSector(0, 0, 45, props.progress ?? 0, '#00BA1E')}
						<circle cx="0" cy="0" r="30" fill="#fff"></circle>
					</>
				) : (
					<>
						<circle cx="0" cy="0" r="50" fill="#ccc"></circle>
						<circle cx="0" cy="0" r="45" fill="#00BA1E"></circle>
					</>
				)}

				{props.isWorking ? (
					<g>
						{svgCircleSegments(0, 0, 50, 47, 10, '#00BA1E')}
						<animateTransform
							attributeName="transform"
							type="rotate"
							from="0 0 0"
							to="360 0 0"
							dur="6s"
							repeatCount="indefinite"
						/>
					</g>
				) : null}
			</svg>
			<div className={ClassNames('label', (props.progress ?? 0) >= 1 ? 'label-done' : null)}>{props.label}</div>
		</div>
	)
}
function getProgress(statuses: ExpectedPackageWorkStatus[], onlyRequired: boolean): number {
	let count = 0
	let progress = 0
	for (const status of statuses) {
		if (onlyRequired && !status.requiredForPlayout) {
			continue
		}
		count++
		if (status.status === ExpectedPackageStatusAPI.WorkStatusState.FULFILLED) {
			progress += 1
		} else if (status.status === ExpectedPackageStatusAPI.WorkStatusState.WORKING) {
			progress += status.progress || 0.1
		} else {
			progress += 0
		}
	}
	if (count) {
		return progress / count
	} else {
		return 1
	}
}
function getModifiedHash(statuses: ExpectedPackageWorkStatus[], onlyRequired: boolean): number {
	let modifiedHash = 0
	for (const status of statuses) {
		if (onlyRequired && !status.requiredForPlayout) {
			continue
		}
		modifiedHash += status.statusChanged // it's dirty, but it's quick and it works well enough
	}
	return modifiedHash
}
