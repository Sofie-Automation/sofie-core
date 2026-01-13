import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { RundownLayoutsAPI } from '../../../../lib/rundownLayouts.js'
import { RundownLayouts } from '../../../../collections/index.js'
import { RundownLayoutBase } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { EditAttribute } from '../../../../lib/EditAttribute.js'
import { LabelActual } from '../../../../lib/Components/LabelAndOverrides.js'

function filterLayouts(
	rundownLayouts: RundownLayoutBase[],
	testFunc: (l: RundownLayoutBase) => boolean
): Array<{ name: string; value: string }> {
	return rundownLayouts.filter(testFunc).map((l) => ({ name: l.name, value: unprotectString(l._id) }))
}

interface IProps {
	sourceLayers: SourceLayers
	item: RundownLayoutBase
	layouts: RundownLayoutBase[]
}

export default function RundownViewLayoutSettings({ sourceLayers, item, layouts }: Readonly<IProps>): JSX.Element {
	const { t } = useTranslation()

	const sourceLayerOptions = useMemo(
		() =>
			Object.values<ISourceLayer | undefined>(sourceLayers)
				.filter((s): s is ISourceLayer => !!s)
				.sort((a, b) => a._rank - b._rank)
				.map((sourceLayer) => ({ name: sourceLayer.name, value: sourceLayer._id })),
		[sourceLayers]
	)

	return (
		<>
			<label className="field">
				<LabelActual label={t('Expose as user selectable layout')} />
				<EditAttribute
					attribute={'exposeAsSelectableLayout'}
					obj={item}
					type="checkbox"
					collection={RundownLayouts}
				></EditAttribute>
			</label>

			<label className="field">
				<LabelActual label={t('Shelf Layout')} />
				<EditAttribute
					attribute={'shelfLayout'}
					obj={item}
					options={filterLayouts(layouts, RundownLayoutsAPI.isLayoutForShelf)}
					type="dropdown"
					collection={RundownLayouts}
				></EditAttribute>
			</label>

			<label className="field">
				<LabelActual label={t('Mini Shelf Layout')} />
				<EditAttribute
					attribute={'miniShelfLayout'}
					obj={item}
					options={filterLayouts(layouts, RundownLayoutsAPI.isLayoutForMiniShelf)}
					type="dropdown"
					collection={RundownLayouts}
				></EditAttribute>
			</label>

			<label className="field">
				<LabelActual label={t('Rundown Header Layout')} />
				<EditAttribute
					attribute={'rundownHeaderLayout'}
					obj={item}
					options={filterLayouts(layouts, RundownLayoutsAPI.isLayoutForRundownHeader)}
					type="dropdown"
					collection={RundownLayouts}
				></EditAttribute>
			</label>

			<label className="field">
				<LabelActual label={t('Live line countdown requires Source Layer')} />
				<div className="checkbox-enable-before">
					<EditAttribute
						attribute={`liveLineProps.requiredLayerIds`}
						obj={item}
						type="checkbox"
						collection={RundownLayouts}
						mutateDisplayValue={(v) => !(v === undefined || v.length === 0)}
						mutateUpdateValue={() => undefined}
					/>
					<EditAttribute
						attribute={`liveLineProps.requiredLayerIds`}
						obj={item}
						options={sourceLayerOptions}
						type="multiselect"
						label={t('Disabled')}
						collection={RundownLayouts}
						mutateUpdateValue={(v) => (v && v.length > 0 ? v : undefined)}
					/>
				</div>
				<span className="text-s dimmed field-hint">
					{t('One of these source layers must have an active piece for the live line countdown to be show')}
				</span>
			</label>

			<label className="field">
				<LabelActual label={t('Also Require Source Layers')} />
				<div className="checkbox-enable-before">
					<EditAttribute
						attribute={`liveLineProps.additionalLayers`}
						obj={item}
						type="checkbox"
						collection={RundownLayouts}
						mutateDisplayValue={(v) => !(v === undefined || v.length === 0)}
						mutateUpdateValue={() => undefined}
					/>
					<EditAttribute
						attribute={`liveLineProps.additionalLayers`}
						obj={item}
						options={sourceLayerOptions}
						type="multiselect"
						label={t('Disabled')}
						collection={RundownLayouts}
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
					attribute={`liveLineProps.requireAllAdditionalSourcelayers`}
					obj={item}
					type="checkbox"
					collection={RundownLayouts}
				/>
				<span className="text-s dimmed field-hint">{t('All additional source layers must have active pieces')}</span>
			</label>

			<label className="field">
				<LabelActual label={t('Hide Rundown Divider')} />
				<EditAttribute
					attribute={'hideRundownDivider'}
					obj={item}
					type="checkbox"
					collection={RundownLayouts}
				></EditAttribute>
				<span className="text-s dimmed field-hint">{t('Hide rundown divider between rundowns in a playlist')}</span>
			</label>

			<label className="field">
				<LabelActual label={t('Show Breaks as Segments')} />
				<EditAttribute
					attribute={'showBreaksAsSegments'}
					obj={item}
					type="checkbox"
					collection={RundownLayouts}
				></EditAttribute>
			</label>

			<label className="field">
				<LabelActual label={t('Segment countdown requires source layer')} />
				<div className="checkbox-enable-before">
					<EditAttribute
						attribute={`countdownToSegmentRequireLayers`}
						obj={item}
						type="checkbox"
						collection={RundownLayouts}
						mutateDisplayValue={(v) => !(v === undefined || v.length === 0)}
						mutateUpdateValue={() => undefined}
					/>
					<EditAttribute
						attribute={`countdownToSegmentRequireLayers`}
						obj={item}
						options={sourceLayerOptions}
						type="multiselect"
						label={t('Disabled')}
						collection={RundownLayouts}
						mutateUpdateValue={(v) => (v && v.length > 0 ? v : undefined)}
					/>
				</div>
				<span className="text-s dimmed field-hint">
					{t('One of these source layers must have a piece for the countdown to segment on-air to be show')}
				</span>
			</label>

			<label className="field">
				<LabelActual label={t('Fixed duration in Segment header')} />
				<EditAttribute
					attribute={'fixedSegmentDuration'}
					obj={item}
					type="checkbox"
					collection={RundownLayouts}
				></EditAttribute>
				<span className="text-s dimmed field-hint">
					{t(
						'The segment duration in the segment header always displays the planned duration instead of acting as a counter'
					)}
				</span>
			</label>

			<label className="field">
				<LabelActual label={t('Select visible Source Layers')} />
				<EditAttribute
					attribute={'visibleSourceLayers'}
					obj={item}
					options={sourceLayerOptions}
					type="multiselect"
					mutateUpdateValue={undefinedOnEmptyArray}
					collection={RundownLayouts}
				></EditAttribute>
			</label>

			<label className="field">
				<LabelActual label={t('Select visible Output Groups')} />
				<EditAttribute
					attribute={'visibleOutputLayers'}
					obj={item}
					options={sourceLayerOptions}
					type="multiselect"
					mutateUpdateValue={undefinedOnEmptyArray}
					collection={RundownLayouts}
				></EditAttribute>
			</label>

			<label className="field">
				<LabelActual label={t('Display piece duration for source layers')} />
				<div className="checkbox-enable-before">
					<EditAttribute
						attribute={`showDurationSourceLayers`}
						obj={item}
						type="checkbox"
						collection={RundownLayouts}
						mutateDisplayValue={(v) => !(v === undefined || v.length === 0)}
						mutateUpdateValue={() => undefined}
					/>
					<EditAttribute
						attribute={`showDurationSourceLayers`}
						obj={item}
						options={sourceLayerOptions}
						type="multiselect"
						label={t('Disabled')}
						collection={RundownLayouts}
						mutateUpdateValue={(v) => (v && v.length > 0 ? v : undefined)}
					/>
				</div>
				<span className="text-s dimmed field-hint">
					{t('Piece on selected source layers will have a duration label shown')}
				</span>
			</label>
		</>
	)
}

function undefinedOnEmptyArray(v: string[]): string[] | undefined {
	if (Array.isArray(v)) {
		if (v.length === 0) {
			return undefined
		} else {
			return v
		}
	}
	return undefined
}
