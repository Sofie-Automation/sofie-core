import * as React from 'react'
import { DBStudio, IStudioSettings } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { EditAttribute } from '../../../lib/EditAttribute.js'
import { StudioBaselineStatus } from './Baseline.js'
import { ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ShowStyleBases, Studios } from '../../../collections/index.js'
import { useHistory } from 'react-router-dom'
import { MeteorCall } from '../../../lib/meteorApi.js'
import {
	LabelActual,
	LabelAndOverrides,
	LabelAndOverridesForCheckbox,
	LabelAndOverridesForDropdown,
	LabelAndOverridesForInt,
} from '../../../lib/Components/LabelAndOverrides.js'
import { catchError } from '../../../lib/lib.js'
import { ForceQuickLoopAutoNext } from '@sofie-automation/shared-lib/dist/core/model/StudioSettings'
import {
	applyAndValidateOverrides,
	ObjectWithOverrides,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { useOverrideOpHelper, WrappedOverridableItemNormal } from '../util/OverrideOpHelper.js'
import { IntInputControl } from '../../../lib/Components/IntInput.js'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { useMemo } from 'react'
import { CheckboxControl } from '../../../lib/Components/Checkbox.js'
import { TextInputControl } from '../../../lib/Components/TextInput.js'
import { DropdownInputControl, DropdownInputOption } from '../../../lib/Components/DropdownInput.js'
import { useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData.js'
import Button from 'react-bootstrap/Button'

interface IStudioGenericPropertiesProps {
	studio: DBStudio
}

export function StudioGenericProperties({ studio }: IStudioGenericPropertiesProps): JSX.Element {
	const { t } = useTranslation()

	const availableShowStyleBases = useTracker(
		() =>
			ShowStyleBases.find()
				.fetch()
				.map((showStyle) => {
					return {
						name: `${showStyle.name}`,
						value: showStyle._id,
						showStyleBase: showStyle,
					}
				}),
		[],
		[]
	)

	const showStyleEditButtons: JSX.Element[] = []
	for (const showStyleBaseId of studio.supportedShowStyleBase) {
		const showStyleBase = availableShowStyleBases.find((base) => base.showStyleBase._id === showStyleBaseId)
		if (showStyleBase) {
			showStyleEditButtons.push(
				<RedirectToShowStyleButton
					key={'settings-nevigation-' + showStyleBase.showStyleBase._id}
					name={showStyleBase.showStyleBase.name}
					id={showStyleBase.showStyleBase._id}
				/>
			)
		}
	}

	return (
		<div className="properties-grid">
			<h2 className="mb-4">{t('Generic Properties')}</h2>

			<label className="field">
				<LabelActual label={t('Studio Name')} />
				{!studio.name ? (
					<div className="error-notice">
						{t('No name set')} <FontAwesomeIcon icon={faExclamationTriangle} />
					</div>
				) : null}
				<EditAttribute attribute="name" obj={studio} type="text" collection={Studios} />
			</label>
			<div className="field">
				{t('Select Compatible Show Styles')}
				<div>
					<EditAttribute
						attribute="supportedShowStyleBase"
						obj={studio}
						options={availableShowStyleBases}
						label={t('Click to show available Show Styles')}
						type="multiselect"
						collection={Studios}
					/>
					{showStyleEditButtons}
					<NewShowStyleButton />
				</div>
				{!studio.supportedShowStyleBase.length ? (
					<div className="error-notice">
						{t('Show style not set')} <FontAwesomeIcon icon={faExclamationTriangle} />
					</div>
				) : null}
			</div>

			<StudioSettings studio={studio} />

			<StudioBaselineStatus studioId={studio._id} />
		</div>
	)
}

const NewShowStyleButton = React.memo(function NewShowStyleButton() {
	const history = useHistory()

	const onShowStyleAdd = () => {
		MeteorCall.showstyles
			.insertShowStyleBase()
			.then((showStyleBaseId) => {
				history.push('/settings/showStyleBase/' + showStyleBaseId)
			})
			.catch(catchError('showstyles.insertShowStyleBase'))
	}

	return (
		<Button variant="primary mt-2 me-2" onClick={onShowStyleAdd}>
			New Show Style
		</Button>
	)
})

const RedirectToShowStyleButton = React.memo(function RedirectToShowStyleButton(props: {
	id: ShowStyleBaseId
	name: string
}) {
	const history = useHistory()

	const doRedirect = () => history.push('/settings/showStyleBase/' + props.id)

	return (
		<Button variant="light" className="mt-2 me-2" onClick={doRedirect}>
			Edit {props.name}
		</Button>
	)
})

function StudioSettings({ studio }: { studio: DBStudio }): JSX.Element {
	const { t } = useTranslation()

	const saveOverrides = React.useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			Studios.update(studio._id, {
				$set: {
					'settingsWithOverrides.overrides': newOps.map((op) => ({
						...op,
						path: op.path.startsWith('0.') ? op.path.slice(2) : op.path,
					})),
				},
			})
		},
		[studio._id]
	)

	const [wrappedItem, wrappedConfigObject] = useMemo(() => {
		const prefixedOps = studio.settingsWithOverrides.overrides.map((op) => ({
			...op,
			// TODO: can we avoid doing this hack?
			path: `0.${op.path}`,
		}))

		const computedValue = applyAndValidateOverrides(studio.settingsWithOverrides).obj

		const wrappedItem = literal<WrappedOverridableItemNormal<IStudioSettings>>({
			type: 'normal',
			id: '0',
			computed: computedValue,
			defaults: studio.settingsWithOverrides.defaults,
			overrideOps: prefixedOps,
		})

		const wrappedConfigObject: ObjectWithOverrides<IStudioSettings> = {
			defaults: studio.settingsWithOverrides.defaults,
			overrides: prefixedOps,
		}

		return [wrappedItem, wrappedConfigObject]
	}, [studio.settingsWithOverrides])

	const overrideHelper = useOverrideOpHelper(saveOverrides, wrappedConfigObject)

	const autoNextOptions: DropdownInputOption<ForceQuickLoopAutoNext>[] = useMemo(
		() => [
			{
				name: t('Disabled'),
				value: ForceQuickLoopAutoNext.DISABLED,
				i: 0,
			},
			{
				name: t('Enabled, but skipping parts with undefined or 0 duration'),
				value: ForceQuickLoopAutoNext.ENABLED_WHEN_VALID_DURATION,
				i: 1,
			},
			{
				name: t('Enabled on all Parts, applying QuickLoop Fallback Part Duration if needed'),
				value: ForceQuickLoopAutoNext.ENABLED_FORCING_MIN_DURATION,
				i: 2,
			},
		],
		[t]
	)

	return (
		<>
			<LabelAndOverridesForInt
				label={t('Frame Rate')}
				item={wrappedItem}
				itemKey={'frameRate'}
				overrideHelper={overrideHelper}
			>
				{(value, handleUpdate) => <IntInputControl value={value} handleUpdate={handleUpdate} />}
			</LabelAndOverridesForInt>

			<LabelAndOverridesForInt
				label={t('Minimum Take Span')}
				item={wrappedItem}
				itemKey={'minimumTakeSpan'}
				overrideHelper={overrideHelper}
			>
				{(value, handleUpdate) => <IntInputControl value={value} handleUpdate={handleUpdate} />}
			</LabelAndOverridesForInt>

			<LabelAndOverridesForCheckbox
				label={t('Enable "Play from Anywhere"')}
				item={wrappedItem}
				itemKey={'enablePlayFromAnywhere'}
				overrideHelper={overrideHelper}
			>
				{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
			</LabelAndOverridesForCheckbox>

			<LabelAndOverrides
				label={t('Media Preview URL')}
				item={wrappedItem}
				itemKey={'mediaPreviewsUrl'}
				overrideHelper={overrideHelper}
			>
				{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
			</LabelAndOverrides>

			<LabelAndOverrides
				label={t('Slack Webhook URLs')}
				item={wrappedItem}
				itemKey={'slackEvaluationUrls'}
				overrideHelper={overrideHelper}
			>
				{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
			</LabelAndOverrides>

			<LabelAndOverrides
				label={t('Supported Media Formats')}
				item={wrappedItem}
				itemKey={'supportedMediaFormats'}
				overrideHelper={overrideHelper}
			>
				{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
			</LabelAndOverrides>

			<LabelAndOverrides
				label={t('Supported Audio Formats')}
				item={wrappedItem}
				itemKey={'supportedAudioStreams'}
				overrideHelper={overrideHelper}
			>
				{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
			</LabelAndOverrides>

			<LabelAndOverridesForCheckbox
				label={t('Force the Multi-gateway-mode')}
				item={wrappedItem}
				itemKey={'forceMultiGatewayMode'}
				overrideHelper={overrideHelper}
			>
				{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
			</LabelAndOverridesForCheckbox>

			<LabelAndOverridesForInt
				label={t('Multi-gateway-mode delay time')}
				item={wrappedItem}
				itemKey={'multiGatewayNowSafeLatency'}
				overrideHelper={overrideHelper}
			>
				{(value, handleUpdate) => <IntInputControl value={value} handleUpdate={handleUpdate} />}
			</LabelAndOverridesForInt>

			<LabelAndOverridesForCheckbox
				label={t('Allow Rundowns to be reset while on-air')}
				item={wrappedItem}
				itemKey={'allowRundownResetOnAir'}
				overrideHelper={overrideHelper}
			>
				{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
			</LabelAndOverridesForCheckbox>

			<LabelAndOverridesForCheckbox
				label={t('Preserve position of segments when unsynced relative to other segments')}
				item={wrappedItem}
				itemKey={'preserveOrphanedSegmentPositionInRundown'}
				overrideHelper={overrideHelper}
				hint={t('This has only been tested for the iNews gateway')}
			>
				{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
			</LabelAndOverridesForCheckbox>

			<LabelAndOverridesForCheckbox
				label={t('Enable AdLib Testing, for testing AdLibs before taking the first Part')}
				item={wrappedItem}
				itemKey={'allowAdlibTestingSegment'}
				overrideHelper={overrideHelper}
			>
				{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
			</LabelAndOverridesForCheckbox>

			<LabelAndOverridesForCheckbox
				label={t('Allow infinites from AdLib testing to persist')}
				item={wrappedItem}
				itemKey={'allowTestingAdlibsToPersist'}
				overrideHelper={overrideHelper}
			>
				{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
			</LabelAndOverridesForCheckbox>

			<LabelAndOverridesForCheckbox
				label={t('Enable Buckets')}
				item={wrappedItem}
				itemKey={'enableBuckets'}
				overrideHelper={overrideHelper}
				hint={t('This enables or disables buckets in the UI - enabled is the default behavior')}
			>
				{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
			</LabelAndOverridesForCheckbox>

			<LabelAndOverridesForCheckbox
				label={t('Enable User Editing')}
				item={wrappedItem}
				itemKey={'enableUserEdits'}
				overrideHelper={overrideHelper}
				hint={t('This feature enables the use of the Properties Panel and the Edit Mode')}
			>
				{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
			</LabelAndOverridesForCheckbox>

			<LabelAndOverridesForCheckbox
				label={t('Enable Evaluation Form')}
				item={wrappedItem}
				itemKey={'enableEvaluationForm'}
				overrideHelper={overrideHelper}
				hint={t('This enables or disables the evaluationform in the UI - enabled is the default behavior')}
			>
				{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
			</LabelAndOverridesForCheckbox>

			<LabelAndOverridesForCheckbox
				label={t('Enable QuickLoop')}
				item={wrappedItem}
				itemKey={'enableQuickLoop'}
				overrideHelper={overrideHelper}
			>
				{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
			</LabelAndOverridesForCheckbox>

			<LabelAndOverridesForDropdown
				label={t('AutoNext in QuickLoop behavior')}
				item={wrappedItem}
				itemKey={'forceQuickLoopAutoNext'}
				overrideHelper={overrideHelper}
				options={autoNextOptions}
			>
				{(value, handleUpdate, options) => (
					<DropdownInputControl options={options} value={value} handleUpdate={handleUpdate} />
				)}
			</LabelAndOverridesForDropdown>

			<LabelAndOverridesForInt
				label={t('QuickLoop Fallback Part Duration')}
				item={wrappedItem}
				itemKey={'fallbackPartDuration'}
				overrideHelper={overrideHelper}
			>
				{(value, handleUpdate) => <IntInputControl value={value} handleUpdate={handleUpdate} />}
			</LabelAndOverridesForInt>

			<LabelAndOverridesForCheckbox
				label={t('Allow HOLD mode')}
				item={wrappedItem}
				itemKey={'allowHold'}
				overrideHelper={overrideHelper}
				hint={t('When disabled, any HOLD operations will be silently ignored')}
			>
				{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
			</LabelAndOverridesForCheckbox>

			<LabelAndOverridesForCheckbox
				label={t('Allow direct playing pieces')}
				item={wrappedItem}
				itemKey={'allowPieceDirectPlay'}
				overrideHelper={overrideHelper}
				hint={t('When enabled, double clicking on certain pieces in the GUI will play them as adlibs')}
			>
				{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
			</LabelAndOverridesForCheckbox>

			<LabelAndOverridesForCheckbox
				label={t('Mock Piece Content Status')}
				item={wrappedItem}
				itemKey={'mockPieceContentStatus'}
				overrideHelper={overrideHelper}
				hint={t(
					'When enabled, this will override the piece content statuses to have no errors or warnings and display a mock preview. This should only be used for development!'
				)}
			>
				{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
			</LabelAndOverridesForCheckbox>

			<LabelAndOverridesForInt
				label={t('Rundown Global Piece Prepare Time')}
				item={wrappedItem}
				itemKey={'rundownGlobalPiecesPrepareTime'}
				overrideHelper={overrideHelper}
				hint={t('How much preparation time to add to global pieces on the timeline before they are played')}
			>
				{(value, handleUpdate) => (
					<IntInputControl
						modifiedClassName="bghl"
						classNames="input text-input input-l"
						value={value}
						handleUpdate={handleUpdate}
					/>
				)}
			</LabelAndOverridesForInt>
		</>
	)
}
