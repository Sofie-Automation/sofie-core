
import * as React from 'react'
import * as _ from 'underscore'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { callMethod } from '../lib/clientAPI'
import { ManualPlayoutAPI } from '../../lib/api/manualPlayout'

import {
	Timeline as TimelineTypes,
	TimelineObjAtemME,
	TimelineContentTypeAtem,
	AtemTransitionStyle,
	DeviceType as PlayoutDeviceType,
	MappingAtem,
	MappingAtemType,
	MappingCasparCG,
	TimelineObjCCGMedia,
	TimelineContentTypeCasparCg,
	DeviceType
} from 'timeline-state-resolver-types'
import { Studios, Studio } from '../../lib/collections/Studios'
import {
	PeripheralDevices,
} from '../../lib/collections/PeripheralDevices'
import {
	PlayoutDeviceSettings,
	PlayoutDeviceSettingsDeviceAtem
} from '../../lib/collections/PeripheralDeviceSettings/playoutDevice'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { EditAttribute } from '../lib/EditAttribute'
interface IManualPlayoutProps {
}
interface IManualPlayoutState {
	inputValues: {[id: string]: string}
}
export class ManualPlayout extends MeteorReactComponent<IManualPlayoutProps, IManualPlayoutState> {

	constructor (props: IManualPlayoutProps) {
		super(props)
		this.state = {
			inputValues: {}
		}
	}
	componentWillMount () {
		this.subscribe('studios', {})
		this.subscribe('peripheralDevices', {})
	}
	getStudios () {
		return Studios.find().fetch()
	}
	getAtems (studio: Studio) {

		let atems: {[id: string]: PlayoutDeviceSettingsDeviceAtem} = {}

		let parentDevices = PeripheralDevices.find({
			studioId: studio._id,
			type: PeripheralDeviceAPI.DeviceType.PLAYOUT
		}).fetch()

		_.each(parentDevices, (parentDevice) => {
			if (parentDevice.settings) {
				let settings = parentDevice.settings as PlayoutDeviceSettings
				_.each(
					settings.devices, (device, deviceId) => {
						if (device.type === PlayoutDeviceType.ATEM) {
							atems[deviceId] = device as PlayoutDeviceSettingsDeviceAtem
						}
					}
				)
			}
		})
		return atems
	}
	getAtemMEs (studio: Studio) {
		let mappings: {[layer: string]: MappingAtem} = {}
		_.each(studio.mappings, (mapping, layerId) => {
			if (mapping.device === PlayoutDeviceType.ATEM) {
				// @ts-ignore
				let mappingAtem = mapping as MappingAtem
				if (mappingAtem.mappingType === MappingAtemType.MixEffect) {
					mappings[layerId] = mappingAtem
				}

			}
		})
		return mappings
	}
	atemCamera (e: React.MouseEvent<HTMLElement>, studio: Studio, mappingLayerId: string, cam: number) {

		let o: TimelineObjAtemME = {
			id: 'camera_' + mappingLayerId,
			enable: {
				start: 'now'
			},
			layer: mappingLayerId,
			content: {
				deviceType: DeviceType.ATEM,
				type: TimelineContentTypeAtem.ME,

				me: {
					input: cam,
					transition: AtemTransitionStyle.CUT
				}
			}
		}
		callMethod(e, ManualPlayoutAPI.methods.insertTimelineObject, studio._id, o)
	}
	getCasparLayers (studio: Studio) {
		let mappings: {[layer: string]: MappingCasparCG} = {}
		_.each(studio.mappings, (mapping, layerId) => {
			if (mapping.device === PlayoutDeviceType.CASPARCG) {
				mappings[layerId] = mapping as MappingCasparCG

			}
		})
		return mappings
	}
	casparcgPlay (e: React.MouseEvent<HTMLElement>, studio: Studio, mappingLayerId: string) {

		let input = this.state.inputValues[mappingLayerId]

		let o: TimelineObjCCGMedia = {
			id: 'caspar_' + mappingLayerId,
			enable: {
				start: 'now'
			},
			layer: mappingLayerId,
			content: {
				deviceType: DeviceType.CASPARCG,
				type: TimelineContentTypeCasparCg.MEDIA,

				file: input + '',

			}
		}
		callMethod(e, ManualPlayoutAPI.methods.insertTimelineObject, studio._id, o)
	}
	casparcgClear (e: React.MouseEvent<HTMLElement>, studio: Studio, mappingLayerId: string) {
		callMethod(e, ManualPlayoutAPI.methods.removeTimelineObject, studio._id, 'caspar_' + mappingLayerId)
	}
	onInputChange (id: string, value: any) {

		let iv = this.state.inputValues
		iv[id] = value
		this.setState({
			inputValues: iv
		})
	}
	render () {
		return (
			<div>
				<h1>Manual control</h1>
				{
					_.map(this.getStudios(), (studio) => {
						return <div key={studio._id}>
							<h2>{studio.name}</h2>
							<h3 className='mhs'>ATEM Control</h3>
							<table>
								<tbody>
								{
									_.map(this.getAtemMEs(studio), (mapping, mappingLayerId) => {
										return <tr key={mappingLayerId}>
											<th>{mappingLayerId}</th>
											{
												_.map([1,2,3,4,5,6,7,8], (cam) => {
													return (
														<td key={cam}>
															<button className='btn btn-primary' onClick={(e) => this.atemCamera(e, studio, mappingLayerId, cam)}>
																Camera {cam}
															</button>
														</td>
													)
												})
											}
										</tr>
									})
								}
								</tbody>
							</table>
							<h3 className='mhs'>CasparCG Control</h3>
							<table>
								<tbody>
								{
									_.map(this.getCasparLayers(studio), (mapping, mappingLayerId) => {
										return <tr key={mappingLayerId}>
											<th>{mappingLayerId}</th>
											<td>
												<button className='btn btn-primary' onClick={(e) => this.casparcgPlay(e, studio, mappingLayerId)}>
													Play
												</button>
												<button className='btn btn-primary' onClick={(e) => this.casparcgClear(e, studio, mappingLayerId)}>
													Clear
												</button>
											</td>
											<td>
												<EditAttribute
													updateFunction={(_edit, value) => this.onInputChange(mappingLayerId, value)}
													type='text'
													overrideDisplayValue={this.state.inputValues[mappingLayerId]}
												/>
											</td>
										</tr>
									})
								}
								</tbody>
							</table>
						</div>
					})
				}
			</div>

		)
	}
}
