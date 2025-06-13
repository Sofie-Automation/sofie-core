import { faStar, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React from 'react'
import ClassNames from 'classnames'
import _ from 'underscore'
import { RundownLayoutsAPI } from '../../../lib/rundownLayouts'
import {
	DashboardPanelBase,
	DashboardPanelUnit,
	PieceDisplayStyle,
	RundownLayout,
	RundownLayoutAdLibRegionRole,
	RundownLayoutBase,
	RundownLayoutElementBase,
	RundownLayoutElementType,
	RundownLayoutFilterBase,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { EditAttribute } from '../../../lib/EditAttribute'
import { Translated } from '../../../lib/ReactMeteorData/react-meteor-data'
import { IOutputLayer, ISourceLayer, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { withTranslation } from 'react-i18next'
import { defaultColorPickerPalette } from '../../../lib/colorPicker'
import { OutputLayers, SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { RundownLayouts } from '../../../collections'
import { LabelActual } from '../../../lib/Components/LabelAndOverrides'

interface IProps {
	item: RundownLayoutBase
	filter: RundownLayoutElementBase
	index: number
	sourceLayers: SourceLayers
	outputLayers: OutputLayers
	supportedFilters: RundownLayoutElementType[]
}

export default withTranslation()(
	class FilterEditor extends React.Component<Translated<IProps>> {
		onToggleDefault = (item: RundownLayout, index: number, value: boolean) => {
			const obj = _.object(item.filters.map((_item, i) => [`filters.${i}.default`, i === index ? value : false]))
			RundownLayouts.update(item._id, {
				$set: obj,
			})
		}

		onRemoveElement = (item: RundownLayoutBase, filter: RundownLayoutElementBase) => {
			RundownLayouts.update(item._id, {
				$pull: {
					filters: {
						_id: filter._id,
					},
				},
			})
		}

		renderRundownLayoutFilter(
			item: RundownLayoutBase,
			tab: RundownLayoutFilterBase,
			index: number,
			_isRundownLayout: boolean,
			isDashboardLayout: boolean
		) {
			const { t } = this.props
			const isList = tab.displayStyle === PieceDisplayStyle.LIST
			const rundownBaselineOptions = [
				{
					name: t('Yes'),
					value: true,
				},
				{
					name: t('No'),
					value: false,
				},
				{
					name: t('Only Match Global AdLibs'),
					value: 'only',
				},
			]

			return (
				<React.Fragment>
					<label className="field">
						<LabelActual label={t('Name')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.name`}
							obj={item}
							type="text"
							collection={RundownLayouts}
							className="input text-input input-l"
						/>
					</label>

					{isDashboardLayout && (
						<React.Fragment>
							<label className="field">
								<LabelActual label={t('Display Style')} />
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`filters.${index}.displayStyle`}
									obj={item}
									type="dropdown"
									collection={RundownLayouts}
									options={PieceDisplayStyle}
									className="input text-input input-l"
								/>
							</label>

							{isList && (
								<label className="field">
									<LabelActual label={t('Show thumbnails next to list items')} />
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`filters.${index}.showThumbnailsInList`}
										obj={item}
										type="checkbox"
										collection={RundownLayouts}
										className="mod mas"
									/>
								</label>
							)}
							{this.renderDashboardLayoutSettings(item, index, { scale: 0 })}
							{!isList && (
								<React.Fragment>
									<label className="field">
										<LabelActual label={t('Button width scale factor')} />
										<EditAttribute
											modifiedClassName="bghl"
											attribute={`filters.${index}.buttonWidthScale`}
											obj={item}
											type="float"
											collection={RundownLayouts}
											className="input text-input input-l"
										/>
									</label>

									<label className="field">
										<LabelActual label={t('Button height scale factor')} />
										<EditAttribute
											modifiedClassName="bghl"
											attribute={`filters.${index}.buttonHeightScale`}
											obj={item}
											type="float"
											collection={RundownLayouts}
											className="input text-input input-l"
										/>
									</label>
								</React.Fragment>
							)}
						</React.Fragment>
					)}

					<label className="field">
						<LabelActual label={t('Only Display AdLibs from Current Segment')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.currentSegment`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
						/>
					</label>

					<label className="field">
						<LabelActual label={t('Include Global AdLibs')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.rundownBaseline`}
							obj={item}
							options={rundownBaselineOptions}
							type="dropdown"
							label={t('Filter Disabled')}
							collection={RundownLayouts}
							className="input text-input input-l dropdown"
						/>
					</label>

					{isDashboardLayout && (
						<React.Fragment>
							<label className="field">
								<LabelActual label={t('Include Clear Source Layer in Ad-Libs')} />
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`filters.${index}.includeClearInRundownBaseline`}
									obj={item}
									type="checkbox"
									collection={RundownLayouts}
									className="mod mas"
								/>
							</label>
						</React.Fragment>
					)}

					<label className="field">
						<LabelActual label={t('Source Layers')} />
						<div>
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.sourceLayerIds`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mls mvxs"
								mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? false : true)}
								mutateUpdateValue={() => undefined}
							/>
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.sourceLayerIds`}
								obj={item}
								options={Object.values<ISourceLayer | undefined>(this.props.sourceLayers)
									.filter((s): s is ISourceLayer => !!s)
									.sort((a, b) => a._rank - b._rank)
									.map((l) => ({ name: l.name, value: l._id }))}
								type="multiselect"
								label={t('Filter Disabled')}
								collection={RundownLayouts}
								className="input text-input input-l dropdown"
								mutateUpdateValue={(v) => (v && v.length > 0 ? v : undefined)}
							/>
						</div>
					</label>

					<label className="field">
						<LabelActual label={t('Source Layer Types')} />
						<div>
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.sourceLayerTypes`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mls mvxs"
								mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? false : true)}
								mutateUpdateValue={() => undefined}
							/>
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.sourceLayerTypes`}
								obj={item}
								options={SourceLayerType}
								type="multiselect"
								optionsAreNumbers={true}
								label={t('Filter disabled')}
								collection={RundownLayouts}
								className="input text-input input-l dropdown"
								mutateUpdateValue={(v: string[] | undefined) =>
									v && v.length > 0 ? v.map((a) => parseInt(a, 10)) : undefined
								}
							/>
						</div>
					</label>

					<label className="field">
						<LabelActual label={t('Output Channels')} />
						<div>
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.outputLayerIds`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mls mvxs"
								mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? false : true)}
								mutateUpdateValue={() => undefined}
							/>
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.outputLayerIds`}
								obj={item}
								options={Object.values<IOutputLayer | undefined>(this.props.outputLayers)
									.filter((s): s is IOutputLayer => !!s)
									.sort((a, b) => a._rank - b._rank)
									.map((l) => ({ name: l.name, value: l._id }))}
								type="multiselect"
								label={t('Filter Disabled')}
								collection={RundownLayouts}
								className="input text-input input-l dropdown"
								mutateUpdateValue={(v) => (v && v.length > 0 ? v : undefined)}
							/>
						</div>
					</label>

					<label className="field">
						<LabelActual label={t('Label contains')} />
						<div>
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.label`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mls mvxs"
								mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? false : true)}
								mutateUpdateValue={() => undefined}
							/>
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.label`}
								obj={item}
								type="text"
								collection={RundownLayouts}
								className="input text-input input-l"
								label={t('Filter Disabled')}
								mutateDisplayValue={(v: string[] | undefined) =>
									v === undefined || v.length === 0 ? undefined : v.join(', ')
								}
								mutateUpdateValue={(v: string | undefined) =>
									v === undefined || v.length === 0 ? undefined : v.split(',').map((i) => i.trim())
								}
							/>
						</div>
					</label>

					<label className="field">
						<LabelActual label={t('Tags must contain')} />
						<div>
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.tags`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mls mvxs"
								mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? false : true)}
								mutateUpdateValue={() => undefined}
							/>
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.tags`}
								obj={item}
								type="text"
								collection={RundownLayouts}
								className="input text-input input-l"
								label={t('Filter Disabled')}
								mutateDisplayValue={(v: string[] | undefined) =>
									v === undefined || v.length === 0 ? undefined : v.join(', ')
								}
								mutateUpdateValue={(v: string | undefined) =>
									v === undefined || v.length === 0 ? undefined : v.split(',').map((i) => i.trim())
								}
							/>
						</div>
					</label>

					{isDashboardLayout && (
						<React.Fragment>
							<label className="field">
								<LabelActual label={t('Hide Panel from view')} />
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`filters.${index}.hide`}
									obj={item}
									type="checkbox"
									collection={RundownLayouts}
									className="mod mas"
								/>
							</label>
						</React.Fragment>
					)}
					{isDashboardLayout && (
						<React.Fragment>
							<label className="field">
								<LabelActual label={t('Show panel as a timeline')} />
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`filters.${index}.showAsTimeline`}
									obj={item}
									type="checkbox"
									collection={RundownLayouts}
									className="mod mas"
								/>
							</label>
						</React.Fragment>
					)}

					<label className="field">
						<LabelActual label={t('Enable search toolbar')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.enableSearch`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
						/>
					</label>

					{isDashboardLayout && (
						<React.Fragment>
							<label className="field">
								<LabelActual label={t('Include Clear Source Layer in Ad-Libs')} />
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`filters.${index}.includeClearInRundownBaseline`}
									obj={item}
									type="checkbox"
									collection={RundownLayouts}
									className="mod mas"
								/>
							</label>
						</React.Fragment>
					)}
					{isDashboardLayout && (
						<React.Fragment>
							<label className="field">
								<LabelActual label={t('Overflow horizontally')} />
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`filters.${index}.overflowHorizontally`}
									obj={item}
									type="checkbox"
									collection={RundownLayouts}
									className="mod mas"
								/>
							</label>

							<label className="field">
								<LabelActual label={t('Display Take buttons')} />
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`filters.${index}.displayTakeButtons`}
									obj={item}
									type="checkbox"
									collection={RundownLayouts}
									className="mod mas"
								/>
							</label>

							<label className="field">
								<LabelActual label={t('Queue all adlibs')} />
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`filters.${index}.queueAllAdlibs`}
									obj={item}
									type="checkbox"
									collection={RundownLayouts}
									className="mod mas"
								/>
							</label>

							<label className="field">
								<LabelActual label={t('Toggle AdLibs on single mouse click')} />
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`filters.${index}.toggleOnSingleClick`}
									obj={item}
									type="checkbox"
									collection={RundownLayouts}
									className="mod mas"
								/>
							</label>

							<label className="field">
								<LabelActual label={t('Disable the hover Inspector when hovering over the button')} />
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`filters.${index}.disableHoverInspector`}
									obj={item}
									type="checkbox"
									collection={RundownLayouts}
									className="mod mas"
								/>
							</label>

							<label className="field" title="eg. when pieces in current part serve as data stores for adlibing">
								{t('Current part can contain next pieces')}
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`filters.${index}.nextInCurrentPart`}
									obj={item}
									type="checkbox"
									collection={RundownLayouts}
									className="mod mas"
								/>
							</label>

							<label className="field">
								<LabelActual label={t('Indicate only one next piece per source layer')} />
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`filters.${index}.oneNextPerSourceLayer`}
									obj={item}
									type="checkbox"
									collection={RundownLayouts}
									className="mod mas"
								/>
							</label>

							<label className="field">
								<LabelActual label={t('Hide duplicated AdLibs')} />
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`filters.${index}.hideDuplicates`}
									obj={item}
									type="checkbox"
									collection={RundownLayouts}
									className="mod mas"
								/>
								<span className="text-s dimmed field-hint">
									{t('Picks the first instance of an adLib per rundown, identified by uniqueness Id')}
								</span>
							</label>
						</React.Fragment>
					)}
				</React.Fragment>
			)
		}

		renderFrame(item: RundownLayoutBase, index: number, isDashboardLayout: boolean) {
			const { t } = this.props
			return (
				<React.Fragment>
					<label className="field">
						<LabelActual label={t('Name')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.name`}
							obj={item}
							type="text"
							collection={RundownLayouts}
							className="input text-input input-l"
						/>
					</label>

					<label className="field">
						<LabelActual label={t('URL')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.url`}
							obj={item}
							type="text"
							collection={RundownLayouts}
							className="input text-input input-l"
						/>
					</label>

					<label className="field">
						<LabelActual label={t('Dropzone URL')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.dropzoneUrl`}
							obj={item}
							type="text"
							collection={RundownLayouts}
							className="input text-input input-l"
						/>
					</label>

					<label className="field">
						<LabelActual label={t('Display Rank')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.rank`}
							obj={item}
							type="float"
							collection={RundownLayouts}
							className="input text-input input-l"
						/>
					</label>

					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index)}
				</React.Fragment>
			)
		}

		renderAdLibRegion(item: RundownLayoutBase, index: number, isDashboardLayout: boolean) {
			const { t } = this.props
			return (
				<React.Fragment>
					<label className="field">
						<LabelActual label={t('Name')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.name`}
							obj={item}
							type="text"
							collection={RundownLayouts}
							className="input text-input input-l"
						/>
					</label>

					<label className="field">
						<LabelActual label={t('Role')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.role`}
							obj={item}
							type="dropdown"
							collection={RundownLayouts}
							options={RundownLayoutAdLibRegionRole}
							className="input text-input input-l"
						/>
					</label>

					<label className="field">
						<LabelActual label={t('Adlib Rank')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.adlibRank`}
							obj={item}
							type="int"
							collection={RundownLayouts}
							className="input text-input input-l"
						/>
					</label>

					<label className="field">
						<LabelActual label={t('Tags must contain')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.tags`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
							mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? false : true)}
							mutateUpdateValue={() => undefined}
						/>
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.tags`}
							obj={item}
							type="text"
							collection={RundownLayouts}
							className="input text-input input-l"
							label={t('Filter Disabled')}
							mutateDisplayValue={(v: string[] | undefined) =>
								v === undefined || v.length === 0 ? undefined : v.join(', ')
							}
							mutateUpdateValue={(v: string | undefined) =>
								v === undefined || v.length === 0 ? undefined : v.split(',').map((i) => i.trim())
							}
						/>
					</label>

					<label className="field">
						<LabelActual label={t('Place label below panel')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.labelBelowPanel`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
						/>
					</label>

					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index, { scale: 0 })}
				</React.Fragment>
			)
		}

		renderPieceCountdown(item: RundownLayoutBase, index: number, isDashboardLayout: boolean) {
			const { t } = this.props
			return (
				<React.Fragment>
					<label className="field">
						<LabelActual label={t('Source Layers')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.sourceLayerIds`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
							mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? false : true)}
							mutateUpdateValue={() => undefined}
						/>
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.sourceLayerIds`}
							obj={item}
							options={Object.values<ISourceLayer | undefined>(this.props.sourceLayers)
								.filter((s): s is ISourceLayer => !!s)
								.sort((a, b) => a._rank - b._rank)
								.map((l) => ({ name: l.name, value: l._id }))}
							type="multiselect"
							label={t('Disabled')}
							collection={RundownLayouts}
							className="input text-input input-l dropdown"
							mutateUpdateValue={(v) => (v && v.length > 0 ? v : undefined)}
						/>
					</label>

					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index)}
				</React.Fragment>
			)
		}

		renderNextInfo(item: RundownLayoutBase, index: number, isDashboardLayout: boolean) {
			const { t } = this.props
			return (
				<React.Fragment>
					<label className="field">
						<LabelActual label={t('Name')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.name`}
							obj={item}
							type="text"
							collection={RundownLayouts}
							className="input text-input input-l"
						/>
					</label>

					<label className="field">
						<LabelActual label={t('Show segment name')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.showSegmentName`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
						/>
					</label>

					<label className="field">
						<LabelActual label={t('Show part title')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.showPartTitle`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
						/>
					</label>

					<label className="field">
						<LabelActual label={t('Hide for dynamically inserted parts')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.hideForDynamicallyInsertedParts`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
						/>
					</label>

					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index, { height: 0 })}
				</React.Fragment>
			)
		}

		renderPlaylistStartTimer(item: RundownLayoutBase, index: number, isDashboardLayout: boolean) {
			const { t } = this.props
			return (
				<React.Fragment>
					<label className="field">
						<LabelActual label={t('Name')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.name`}
							obj={item}
							type="text"
							collection={RundownLayouts}
							className="input text-input input-l"
						/>
					</label>

					<label className="field">
						<LabelActual label={t('Planned Start Text')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.plannedStartText`}
							obj={this.props.item}
							type="text"
							collection={RundownLayouts}
							className="input text-input input-l"
						></EditAttribute>
						<span className="text-s dimmed field-hint">{t('Text to show above show start time')}</span>
					</label>

					<label className="field">
						<LabelActual label={t('Hide Diff')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.hideDiff`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
						/>
					</label>

					<label className="field">
						<LabelActual label={t('Hide Planned Start')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.hidePlannedStart`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
						/>
					</label>

					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index)}
				</React.Fragment>
			)
		}

		renderPlaylistEndTimer(item: RundownLayoutBase, index: number, isDashboardLayout: boolean) {
			const { t } = this.props
			return (
				<React.Fragment>
					<label className="field">
						<LabelActual label={t('Name')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.name`}
							obj={item}
							type="text"
							collection={RundownLayouts}
							className="input text-input input-l"
						/>
					</label>

					<label className="field">
						<LabelActual label={t('Planned End text')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.plannedEndText`}
							obj={this.props.item}
							type="text"
							collection={RundownLayouts}
							className="input text-input input-l"
						></EditAttribute>
						<span className="text-s dimmed field-hint">{t('Text to show above show end time')}</span>
					</label>

					<label className="field">
						<LabelActual label={t('Hide Planned End Label')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.hidePlannedEndLabel`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
						/>
					</label>

					<label className="field">
						<LabelActual label={t('Hide Diff Label')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.hideDiffLabel`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
						/>
					</label>

					<label className="field">
						<LabelActual label={t('Hide Diff')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.hideDiff`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
						/>
					</label>

					<label className="field">
						<LabelActual label={t('Hide Countdown')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.hideCountdown`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
						/>
					</label>

					<label className="field">
						<LabelActual label={t('Hide End Time')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.hidePlannedEnd`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
						/>
					</label>

					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index)}
				</React.Fragment>
			)
		}

		renderEndWords(item: RundownLayoutBase, index: number, isDashboardLayout: boolean) {
			const { t } = this.props
			return (
				<React.Fragment>
					<label className="field">
						<LabelActual label={t('Name')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.name`}
							obj={item}
							type="text"
							collection={RundownLayouts}
							className="input text-input input-l"
						/>
					</label>

					<label className="field">
						<LabelActual label={t('Hide Label')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.hideLabel`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
						/>
					</label>

					{this.renderRequiresActiveLayerSettings(
						item,
						index,
						t('Script Source Layers'),
						t('Source layers containing script')
					)}
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index)}
				</React.Fragment>
			)
		}

		renderSegmentTiming(item: RundownLayoutBase, index: number, isDashboardLayout: boolean) {
			const { t } = this.props

			return (
				<React.Fragment>
					<label className="field">
						<LabelActual label={t('Type')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${this.props.index}.timingType`}
							obj={this.props.item}
							options={['count_down', 'count_up']}
							type="dropdown"
							collection={RundownLayouts}
							className="input text-input input-l"
						></EditAttribute>
					</label>

					<label className="field">
						<LabelActual label={t('Hide Label')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.hideLabel`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
						/>
					</label>

					{this.renderRequiresActiveLayerSettings(item, index, t('Require Piece on Source Layer'), '')}
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index)}
				</React.Fragment>
			)
		}
		renderSegmentCountDown(item: RundownLayoutBase, index: number, isDashboardLayout: boolean) {
			const { t } = this.props

			return (
				<React.Fragment>
					<label className="field">
						<LabelActual label={t('Type')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${this.props.index}.timingType`}
							obj={this.props.item}
							options={['count_down', 'count_up']}
							type="dropdown"
							collection={RundownLayouts}
							className="input text-input input-l"
						></EditAttribute>
					</label>

					<label className="field">
						<LabelActual label={t('Hide Label')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.hideLabel`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
						/>
					</label>

					{this.renderRequiresActiveLayerSettings(item, index, t('Require Piece on Source Layer'), '')}
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index)}
				</React.Fragment>
			)
		}

		renderPartTiming(item: RundownLayoutBase, index: number, isDashboardLayout: boolean) {
			const { t } = this.props

			return (
				<React.Fragment>
					<label className="field">
						<LabelActual label={t('Type')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${this.props.index}.timingType`}
							obj={this.props.item}
							options={['count_down', 'count_up']}
							type="dropdown"
							collection={RundownLayouts}
							className="input text-input input-l"
						></EditAttribute>
					</label>

					<label className="field">
						<LabelActual label={t('Hide Label')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.hideLabel`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
						/>
					</label>

					{this.renderRequiresActiveLayerSettings(item, index, t('Require Piece on Source Layer'), '')}
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index)}
				</React.Fragment>
			)
		}

		renderTextLabel(item: RundownLayoutBase, index: number, isDashboardLayout: boolean) {
			const { t } = this.props
			return (
				<React.Fragment>
					<label className="field">
						<LabelActual label={t('Name')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.name`}
							obj={item}
							type="text"
							collection={RundownLayouts}
							className="input text-input input-l"
						/>
					</label>

					<label className="field">
						<LabelActual label={t('Text')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.text`}
							obj={item}
							type="text"
							collection={RundownLayouts}
							className="input text-input input-l"
						/>
					</label>

					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index)}
				</React.Fragment>
			)
		}

		renderPlaylistName(item: RundownLayoutBase, index: number, isDashboardLayout: boolean) {
			const { t } = this.props
			return (
				<React.Fragment>
					<label className="field">
						<LabelActual label={t('Name')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.name`}
							obj={item}
							type="text"
							collection={RundownLayouts}
							className="input text-input input-l"
						/>
					</label>

					<label className="field">
						<LabelActual label={t('Show Rundown Name')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.showCurrentRundownName`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
						/>
					</label>

					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index)}
				</React.Fragment>
			)
		}

		renderStudioName(item: RundownLayoutBase, index: number, isDashboardLayout: boolean) {
			const { t } = this.props
			return (
				<React.Fragment>
					<label className="field">
						<LabelActual label={t('Name')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.name`}
							obj={item}
							type="text"
							collection={RundownLayouts}
							className="input text-input input-l"
						/>
					</label>

					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index)}
				</React.Fragment>
			)
		}

		renderSegmentName(item: RundownLayoutBase, index: number, isDashboardLayout: boolean) {
			const { t } = this.props
			return (
				<React.Fragment>
					<label className="field">
						<LabelActual label={t('Name')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.name`}
							obj={item}
							type="text"
							collection={RundownLayouts}
							className="input text-input input-l"
						/>
					</label>

					<label className="field">
						<LabelActual label={t('Segment')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${this.props.index}.segment`}
							obj={this.props.item}
							options={['current', 'next']}
							type="dropdown"
							collection={RundownLayouts}
							className="input text-input input-l"
						></EditAttribute>
					</label>

					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index)}
				</React.Fragment>
			)
		}

		renderPartName(item: RundownLayoutBase, index: number, isDashboardLayout: boolean) {
			const { t } = this.props
			return (
				<React.Fragment>
					<label className="field">
						<LabelActual label={t('Name')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.name`}
							obj={item}
							type="text"
							collection={RundownLayouts}
							className="input text-input input-l"
						/>
					</label>

					<label className="field">
						<LabelActual label={t('Part')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${this.props.index}.part`}
							obj={this.props.item}
							options={['current', 'next']}
							type="dropdown"
							collection={RundownLayouts}
							className="input text-input input-l"
						></EditAttribute>
					</label>

					<label className="field">
						<LabelActual label={t('Show Piece Icon Color')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.showPieceIconColor`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
						/>
						<span className="text-s dimmed field-hint">{t('Use color of primary piece as background of panel')}</span>
					</label>

					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index)}
				</React.Fragment>
			)
		}

		renderColoredBox(item: RundownLayoutBase, index: number, isDashboardLayout: boolean) {
			const { t } = this.props
			return (
				<React.Fragment>
					<label className="field">
						<LabelActual label={t('Name')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.name`}
							obj={item}
							type="text"
							collection={RundownLayouts}
							className="input text-input input-l"
						/>
					</label>

					<label className="field">
						<LabelActual label={t('Box color')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.iconColor`}
							obj={item}
							options={defaultColorPickerPalette}
							type="colorpicker"
							collection={RundownLayouts}
							className="input text-input input-s"
						></EditAttribute>
					</label>

					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index)}
				</React.Fragment>
			)
		}

		renderShowStyleDisplay(item: RundownLayoutBase, index: number, isDashboardLayout: boolean) {
			const { t } = this.props
			return (
				<React.Fragment>
					<label className="field">
						<LabelActual label={t('Name')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.name`}
							obj={item}
							type="text"
							collection={RundownLayouts}
							className="input text-input input-l"
						/>
					</label>

					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index)}
				</React.Fragment>
			)
		}

		renderSystemStatus(item: RundownLayoutBase, index: number, isDashboardLayout: boolean) {
			const { t } = this.props
			return (
				<React.Fragment>
					<label className="field">
						<LabelActual label={t('Name')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.name`}
							obj={item}
							type="text"
							collection={RundownLayouts}
							className="input text-input input-l"
						/>
					</label>

					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index)}
				</React.Fragment>
			)
		}

		renderTimeOfDay(item: RundownLayoutBase, index: number, isDashboardLayout: boolean) {
			const { t } = this.props
			return (
				<React.Fragment>
					<label className="field">
						<LabelActual label={t('Name')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.name`}
							obj={item}
							type="text"
							collection={RundownLayouts}
							className="input text-input input-l"
						/>
					</label>

					<label className="field">
						<LabelActual label={t('Hide Label')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.hideLabel`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
						/>
					</label>

					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index)}
				</React.Fragment>
			)
		}

		renderRequiresActiveLayerSettings(
			item: RundownLayoutBase,
			index: number,
			activeLayerTitle: string,
			activeLayersLabel: string
		) {
			const { t } = this.props
			return (
				<React.Fragment>
					<label className="field">
						{activeLayerTitle}
						<div>
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.requiredLayerIds`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
								mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? false : true)}
								mutateUpdateValue={() => undefined}
							/>
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.requiredLayerIds`}
								obj={item}
								options={Object.values<ISourceLayer | undefined>(this.props.sourceLayers)
									.filter((s): s is ISourceLayer => !!s)
									.sort((a, b) => a._rank - b._rank)
									.map((l) => ({ name: l.name, value: l._id }))}
								type="multiselect"
								label={t('Disabled')}
								collection={RundownLayouts}
								className="input text-input input-l dropdown"
								mutateUpdateValue={(v) => (v && v.length > 0 ? v : undefined)}
							/>
						</div>
						<span className="text-s dimmed field-hint">{activeLayersLabel}</span>
					</label>

					<label className="field">
						<LabelActual label={t('Also Require Source Layers')} />
						<div>
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.additionalLayers`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
								mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? false : true)}
								mutateUpdateValue={() => undefined}
							/>
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.additionalLayers`}
								obj={item}
								options={Object.values<ISourceLayer | undefined>(this.props.sourceLayers)
									.filter((s): s is ISourceLayer => !!s)
									.sort((a, b) => a._rank - b._rank)
									.map((l) => ({ name: l.name, value: l._id }))}
								type="multiselect"
								label={t('Disabled')}
								collection={RundownLayouts}
								className="input text-input input-l dropdown"
								mutateUpdateValue={(v) => (v && v.length > 0 ? v : undefined)}
							/>
						</div>
						<span className="text-s dimmed field-hint">
							{t('Specify additional layers where at least one layer must have an active piece')}
						</span>
					</label>

					<label className="field">
						<LabelActual label={t('Require All Additional Source Layers')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.requireAllAdditionalSourcelayers`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
						/>
						<span className="text-s dimmed field-hint">
							{t('All additional source layers must have active pieces')}
						</span>
					</label>
				</React.Fragment>
			)
		}

		renderDashboardLayoutSettings(
			item: RundownLayoutBase,
			index: number,
			options?: {
				[P in keyof DashboardPanelBase]?: 0
			}
		) {
			const { t } = this.props

			return (
				<React.Fragment>
					{!options?.x && (
						<label className="field">
							<LabelActual label={t('X')} />
							<div>
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`filters.${index}.x`}
									obj={item}
									type="float"
									collection={RundownLayouts}
									className="input text-input input-l"
								/>
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`filters.${index}.xUnit`}
									obj={item}
									options={Object.values<DashboardPanelUnit>(DashboardPanelUnit as any)}
									type="dropdown"
									collection={RundownLayouts}
									className="input text-input"
									mutateDisplayValue={(v) => (v === undefined ? DashboardPanelUnit.EM : v)}
								/>
							</div>
						</label>
					)}
					{!options?.y && (
						<label className="field">
							<LabelActual label={t('Y')} />
							<div>
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`filters.${index}.y`}
									obj={item}
									type="float"
									collection={RundownLayouts}
									className="input text-input input-l"
								/>
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`filters.${index}.yUnit`}
									obj={item}
									options={Object.values<DashboardPanelUnit>(DashboardPanelUnit as any)}
									type="dropdown"
									collection={RundownLayouts}
									className="input text-input"
									mutateDisplayValue={(v) => (v === undefined ? DashboardPanelUnit.EM : v)}
								/>
							</div>
						</label>
					)}
					{!options?.width && (
						<label className="field">
							<LabelActual label={t('Width')} />
							<div>
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`filters.${index}.width`}
									obj={item}
									type="float"
									collection={RundownLayouts}
									className="input text-input input-l"
								/>
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`filters.${index}.widthUnit`}
									obj={item}
									options={Object.values<DashboardPanelUnit>(DashboardPanelUnit as any)}
									type="dropdown"
									collection={RundownLayouts}
									className="input text-input"
									mutateDisplayValue={(v) => (v === undefined ? DashboardPanelUnit.EM : v)}
								/>
							</div>
						</label>
					)}
					{!options?.height && (
						<label className="field">
							<LabelActual label={t('Height')} />
							<div>
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`filters.${index}.height`}
									obj={item}
									type="float"
									collection={RundownLayouts}
									className="input text-input input-l"
								/>
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`filters.${index}.heightUnit`}
									obj={item}
									options={Object.values<DashboardPanelUnit>(DashboardPanelUnit as any)}
									type="dropdown"
									collection={RundownLayouts}
									className="input text-input"
									mutateDisplayValue={(v) => (v === undefined ? DashboardPanelUnit.EM : v)}
								/>
							</div>
						</label>
					)}
					{!options?.scale && (
						<label className="field">
							<LabelActual label={t('Scale')} />
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.scale`}
								obj={item}
								type="float"
								collection={RundownLayouts}
								className="input text-input input-l"
							/>
						</label>
					)}

					<label className="field">
						<LabelActual label={t('Display Rank')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.rank`}
							obj={item}
							type="float"
							collection={RundownLayouts}
							className="input text-input input-l"
						/>
					</label>

					{!options?.customClasses && (
						<label className="field">
							<LabelActual label={t('Custom Classes')} />
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.customClasses`}
								obj={item}
								type="text"
								collection={RundownLayouts}
								className="input text-input input-l"
								mutateDisplayValue={(v: string[] | undefined) => v?.join(',')}
								mutateUpdateValue={(v: string | undefined) => v?.split(',')}
							/>
							<span className="text-s dimmed field-hint">
								Add custom css classes for customization. Separate classes with a &lsquo;,&rsquo;
							</span>
						</label>
					)}
				</React.Fragment>
			)
		}

		renderNextBreakTiming(item: RundownLayoutBase, index: number, isDashboardLayout: boolean) {
			const { t } = this.props
			return (
				<React.Fragment>
					<label className="field">
						<LabelActual label={t('Name')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.name`}
							obj={item}
							type="text"
							collection={RundownLayouts}
							className="input text-input input-l"
						/>
					</label>

					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index)}
				</React.Fragment>
			)
		}
		renderMiniRundown(item: RundownLayoutBase, index: number, isDashboardLayout: boolean) {
			const { t } = this.props
			return (
				<React.Fragment>
					<label className="field">
						<LabelActual label={t('Name')} />
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.name`}
							obj={item}
							type="text"
							collection={RundownLayouts}
							className="input text-input input-l"
						/>
					</label>

					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index)}
				</React.Fragment>
			)
		}

		renderFilter(
			item: RundownLayoutBase,
			filter: RundownLayoutElementBase,
			index: number,
			isRundownLayout: boolean,
			isDashboardLayout: boolean
		) {
			if (RundownLayoutsAPI.isFilter(filter)) {
				return this.renderRundownLayoutFilter(item, filter, index, isRundownLayout, isDashboardLayout)
			} else if (RundownLayoutsAPI.isExternalFrame(filter)) {
				return this.renderFrame(item, index, isDashboardLayout)
			} else if (RundownLayoutsAPI.isAdLibRegion(filter)) {
				return this.renderAdLibRegion(item, index, isDashboardLayout)
			} else if (RundownLayoutsAPI.isPieceCountdown(filter)) {
				return this.renderPieceCountdown(item, index, isDashboardLayout)
			} else if (RundownLayoutsAPI.isNextInfo(filter)) {
				return this.renderNextInfo(item, index, isDashboardLayout)
			} else if (RundownLayoutsAPI.isPlaylistStartTimer(filter)) {
				return this.renderPlaylistStartTimer(item, index, isDashboardLayout)
			} else if (RundownLayoutsAPI.isPlaylistEndTimer(filter)) {
				return this.renderPlaylistEndTimer(item, index, isDashboardLayout)
			} else if (RundownLayoutsAPI.isEndWords(filter)) {
				return this.renderEndWords(item, index, isDashboardLayout)
			} else if (RundownLayoutsAPI.isSegmentTiming(filter)) {
				return this.renderSegmentCountDown(item, index, isDashboardLayout)
			} else if (RundownLayoutsAPI.isPartTiming(filter)) {
				return this.renderPartTiming(item, index, isDashboardLayout)
			} else if (RundownLayoutsAPI.isTextLabel(filter)) {
				return this.renderTextLabel(item, index, isDashboardLayout)
			} else if (RundownLayoutsAPI.isPlaylistName(filter)) {
				return this.renderPlaylistName(item, index, isDashboardLayout)
			} else if (RundownLayoutsAPI.isStudioName(filter)) {
				return this.renderStudioName(item, index, isDashboardLayout)
			} else if (RundownLayoutsAPI.isSegmentName(filter)) {
				return this.renderSegmentName(item, index, isDashboardLayout)
			} else if (RundownLayoutsAPI.isPartName(filter)) {
				return this.renderPartName(item, index, isDashboardLayout)
			} else if (RundownLayoutsAPI.isColoredBox(filter)) {
				return this.renderColoredBox(item, index, isDashboardLayout)
			} else if (RundownLayoutsAPI.isTimeOfDay(filter)) {
				return this.renderTimeOfDay(item, index, isDashboardLayout)
			} else if (RundownLayoutsAPI.isShowStyleDisplay(filter)) {
				return this.renderShowStyleDisplay(item, index, isDashboardLayout)
			} else if (RundownLayoutsAPI.isSystemStatus(filter)) {
				return this.renderSystemStatus(item, index, isDashboardLayout)
			} else if (RundownLayoutsAPI.isMiniRundown(filter)) {
				return this.renderMiniRundown(item, index, isDashboardLayout)
			}
		}

		render(): JSX.Element {
			const { t } = this.props

			const isRundownLayout = RundownLayoutsAPI.isRundownLayout(this.props.item)
			const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.item)

			return (
				<div className="rundown-layout-editor-filter mod pan mas" key={this.props.filter._id}>
					<button
						className="action-btn right mod man pas"
						onClick={() => this.onRemoveElement(this.props.item, this.props.filter)}
					>
						<FontAwesomeIcon icon={faTrash} />
					</button>
					{isRundownLayout && (
						<button
							className={ClassNames('action-btn right mod man pas', {
								star: (this.props.filter as any).default,
							})}
							onClick={() =>
								this.onToggleDefault(
									this.props.item as RundownLayout,
									this.props.index,
									!(this.props.filter as any).default
								)
							}
						>
							<FontAwesomeIcon icon={faStar} />
						</button>
					)}
					<div className="properties-grid">
						<label className="field">
							<LabelActual label={t('Type')} />
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${this.props.index}.type`}
								obj={this.props.item}
								options={this.props.supportedFilters}
								type="dropdown"
								mutateDisplayValue={(v) => (v === undefined ? this.props.supportedFilters[0] : v)}
								collection={RundownLayouts}
								className="input text-input input-l"
							></EditAttribute>
						</label>
						{this.renderFilter(
							this.props.item,
							this.props.filter,
							this.props.index,
							isRundownLayout,
							isDashboardLayout
						)}
					</div>
				</div>
			)
		}
	}
)
