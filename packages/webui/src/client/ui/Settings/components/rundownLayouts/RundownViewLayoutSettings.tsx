import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { RundownLayoutsAPI } from '../../../../lib/rundownLayouts'
import { RundownLayouts } from '../../../../collections'
import { RundownLayoutBase } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { unprotectString } from '../../../../lib/tempLib'
import { EditAttribute } from '../../../../lib/EditAttribute'
import { LabelActual } from '../../../../lib/Components/LabelAndOverrides'

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
					modifiedClassName="bghl"
					attribute={'exposeAsSelectableLayout'}
					obj={item}
					type="checkbox"
					collection={RundownLayouts}
					className="mod mas"
				></EditAttribute>
			</label>

			<label className="field">
				<LabelActual label={t('Shelf Layout')} />
				<EditAttribute
					modifiedClassName="bghl"
					attribute={'shelfLayout'}
					obj={item}
					options={filterLayouts(layouts, RundownLayoutsAPI.isLayoutForShelf)}
					type="dropdown"
					collection={RundownLayouts}
					className="input text-input input-l dropdown"
				></EditAttribute>
			</label>

			<label className="field">
				<LabelActual label={t('Mini Shelf Layout')} />
				<EditAttribute
					modifiedClassName="bghl"
					attribute={'miniShelfLayout'}
					obj={item}
					options={filterLayouts(layouts, RundownLayoutsAPI.isLayoutForMiniShelf)}
					type="dropdown"
					collection={RundownLayouts}
					className="input text-input input-l dropdown"
				></EditAttribute>
			</label>

			<label className="field">
				<LabelActual label={t('Rundown Header Layout')} />
				<EditAttribute
					modifiedClassName="bghl"
					attribute={'rundownHeaderLayout'}
					obj={item}
					options={filterLayouts(layouts, RundownLayoutsAPI.isLayoutForRundownHeader)}
					type="dropdown"
					collection={RundownLayouts}
					className="input text-input input-l dropdown"
				></EditAttribute>
			</label>

			<label className="field">
				<LabelActual label={t('Live line countdown requires Source Layer')} />
				<div>
					<EditAttribute
						modifiedClassName="bghl"
						attribute={`liveLineProps.requiredLayerIds`}
						obj={item}
						type="checkbox"
						collection={RundownLayouts}
						className="mhs mvxs"
						mutateDisplayValue={(v) => !(v === undefined || v.length === 0)}
						mutateUpdateValue={() => undefined}
					/>
					<EditAttribute
						modifiedClassName="bghl"
						attribute={`liveLineProps.requiredLayerIds`}
						obj={item}
						options={sourceLayerOptions}
						type="multiselect"
						label={t('Disabled')}
						collection={RundownLayouts}
						className="input text-input input-l dropdown"
						mutateUpdateValue={(v) => (v && v.length > 0 ? v : undefined)}
					/>
				</div>
				<span className="text-s dimmed field-hint">
					{t('One of these source layers must have an active piece for the live line countdown to be show')}
				</span>
			</label>

			<label className="field">
				<LabelActual label={t('Also Require Source Layers')} />
				<div>
					<EditAttribute
						modifiedClassName="bghl"
						attribute={`liveLineProps.additionalLayers`}
						obj={item}
						type="checkbox"
						collection={RundownLayouts}
						className="mhs mvxs"
						mutateDisplayValue={(v) => !(v === undefined || v.length === 0)}
						mutateUpdateValue={() => undefined}
					/>
					<EditAttribute
						modifiedClassName="bghl"
						attribute={`liveLineProps.additionalLayers`}
						obj={item}
						options={sourceLayerOptions}
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
					attribute={`liveLineProps.requireAllAdditionalSourcelayers`}
					obj={item}
					type="checkbox"
					collection={RundownLayouts}
					className="mod mas"
				/>
				<span className="text-s dimmed field-hint">{t('All additional source layers must have active pieces')}</span>
			</label>

			<label className="field">
				<LabelActual label={t('Hide Rundown Divider')} />
				<EditAttribute
					modifiedClassName="bghl"
					attribute={'hideRundownDivider'}
					obj={item}
					type="checkbox"
					collection={RundownLayouts}
					className="mod mas"
				></EditAttribute>
				<span className="text-s dimmed field-hint">{t('Hide rundown divider between rundowns in a playlist')}</span>
			</label>

			<label className="field">
				<LabelActual label={t('Show Breaks as Segments')} />
				<EditAttribute
					modifiedClassName="bghl"
					attribute={'showBreaksAsSegments'}
					obj={item}
					type="checkbox"
					collection={RundownLayouts}
					className="mod mas"
				></EditAttribute>
			</label>

			<label className="field">
				<LabelActual label={t('Segment countdown requires source layer')} />
				<div>
					<EditAttribute
						modifiedClassName="bghl"
						attribute={`countdownToSegmentRequireLayers`}
						obj={item}
						type="checkbox"
						collection={RundownLayouts}
						className="mhs mvxs"
						mutateDisplayValue={(v) => !(v === undefined || v.length === 0)}
						mutateUpdateValue={() => undefined}
					/>
					<EditAttribute
						modifiedClassName="bghl"
						attribute={`countdownToSegmentRequireLayers`}
						obj={item}
						options={sourceLayerOptions}
						type="multiselect"
						label={t('Disabled')}
						collection={RundownLayouts}
						className="input text-input input-l dropdown"
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
					modifiedClassName="bghl"
					attribute={'fixedSegmentDuration'}
					obj={item}
					type="checkbox"
					collection={RundownLayouts}
					className="mod mas"
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
					modifiedClassName="bghl"
					attribute={'visibleSourceLayers'}
					obj={item}
					options={sourceLayerOptions}
					type="multiselect"
					mutateUpdateValue={undefinedOnEmptyArray}
					collection={RundownLayouts}
					className="input text-input input-l dropdown"
				></EditAttribute>
			</label>

			<label className="field">
				<LabelActual label={t('Select visible Output Groups')} />
				<EditAttribute
					modifiedClassName="bghl"
					attribute={'visibleOutputLayers'}
					obj={item}
					options={sourceLayerOptions}
					type="multiselect"
					mutateUpdateValue={undefinedOnEmptyArray}
					collection={RundownLayouts}
					className="input text-input input-l dropdown"
				></EditAttribute>
			</label>

			<label className="field">
				<LabelActual label={t('Display piece duration for source layers')} />
				<div>
					<EditAttribute
						modifiedClassName="bghl"
						attribute={`showDurationSourceLayers`}
						obj={item}
						type="checkbox"
						collection={RundownLayouts}
						className="mhs mvxs"
						mutateDisplayValue={(v) => !(v === undefined || v.length === 0)}
						mutateUpdateValue={() => undefined}
					/>
					<EditAttribute
						modifiedClassName="bghl"
						attribute={`showDurationSourceLayers`}
						obj={item}
						options={sourceLayerOptions}
						type="multiselect"
						label={t('Disabled')}
						collection={RundownLayouts}
						className="input text-input input-l dropdown"
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
