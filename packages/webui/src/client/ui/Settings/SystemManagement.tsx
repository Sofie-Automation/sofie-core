import React, { useCallback, useMemo } from 'react'
import { useTracker, useSubscription } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import { ICoreSystem, SofieLogo } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { EditAttribute } from '../../lib/EditAttribute.js'
import { doModalDialog } from '../../lib/ModalDialog.js'
import { MeteorCall } from '../../lib/meteorApi.js'
import { languageAnd } from '../../lib/language.js'
import { TriggeredActionsEditor } from './components/triggeredActions/TriggeredActionsEditor.js'
import { TFunction, useTranslation } from 'react-i18next'
import { Meteor } from 'meteor/meteor'
import { LogLevel } from '@sofie-automation/meteor-lib/dist/lib'
import { CoreSystem } from '../../collections/index.js'
import { CollectionCleanupResult } from '@sofie-automation/meteor-lib/dist/api/system'
import {
	LabelActual,
	LabelAndOverrides,
	LabelAndOverridesForCheckbox,
	LabelAndOverridesForMultiLineText,
} from '../../lib/Components/LabelAndOverrides.js'
import { catchError } from '../../lib/lib.js'
import { SystemManagementBlueprint } from './SystemManagement/Blueprint.js'
import { SomeObjectOverrideOp } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { useOverrideOpHelperForSimpleObject } from './util/OverrideOpHelper.js'
import { CheckboxControl } from '../../lib/Components/Checkbox.js'
import {
	CombinedMultiLineTextInputControl,
	MultiLineTextInputControl,
} from '../../lib/Components/MultiLineTextInput.js'
import { TextInputControl } from '../../lib/Components/TextInput.js'
import Button from 'react-bootstrap/esm/Button'
import { createPrivateApiPath } from '../../url.js'

interface WithCoreSystemProps {
	coreSystem: ICoreSystem
}

export default function SystemManagement(): JSX.Element | null {
	useSubscription(MeteorPubSub.coreSystem)

	const coreSystem = useTracker(() => CoreSystem.findOne(), [])
	const emptyObject = useMemo(() => ({}), [])

	if (!coreSystem) return null
	return (
		<div className="studio-edit mx-4 mb-4">
			<SystemManagementGeneral coreSystem={coreSystem} />

			<SystemManagementBlueprint coreSystem={coreSystem} />

			<SystemManagementNotificationMessage coreSystem={coreSystem} />

			<SystemManagementSupportPanel coreSystem={coreSystem} />

			<SystemManagementEvaluationsMessage coreSystem={coreSystem} />

			<TriggeredActionsEditor showStyleBaseId={null} sourceLayers={emptyObject} outputLayers={emptyObject} />

			<SystemManagementMonitoring coreSystem={coreSystem} />

			<SystemManagementCronJobs coreSystem={coreSystem} />

			<SystemManagementCleanup />
			<SystemManagementHeapSnapshot />
		</div>
	)
}

function SystemManagementGeneral({ coreSystem }: Readonly<WithCoreSystemProps>) {
	const { t } = useTranslation()

	return (
		<>
			<h2 className="my-4">{t('General')}</h2>
			<div className="properties-grid">
				<label className="field">
					<LabelActual label={t('Installation name')} />
					<EditAttribute attribute="name" obj={coreSystem} type="text" collection={CoreSystem} />
					<span className="text-s dimmed field-hint">
						{t('This name will be shown in the title bar of the window')}
					</span>
				</label>
				<label className="field">
					<LabelActual label={t('Logo')} />
					<EditAttribute
						attribute="logo"
						obj={coreSystem}
						type="dropdown"
						options={{ ...SofieLogo }}
						collection={CoreSystem}
					/>
					<span className="text-s dimmed field-hint">
						{t('Sofie logo to be displayed in the header. Requires a page refresh.')}
					</span>
				</label>
				<label className="field">
					<LabelActual label={t('Logging level')} />
					<EditAttribute
						attribute="logLevel"
						obj={coreSystem}
						type="dropdown"
						options={{ ...LogLevel, 'Use fallback': undefined }}
						collection={CoreSystem}
					/>
					<span className="text-s dimmed field-hint">
						{t('This affects how much is logged to the console on the server')}
					</span>
				</label>
			</div>
		</>
	)
}

function SystemManagementNotificationMessage({ coreSystem }: Readonly<WithCoreSystemProps>) {
	const { t } = useTranslation()

	return (
		<>
			<h2 className="my-4">{t('System-wide Notification Message')}</h2>
			<div className="properties-grid">
				<label className="field">
					<LabelActual label={t('Message')} />
					<EditAttribute attribute="systemInfo.message" obj={coreSystem} type="text" collection={CoreSystem} />
				</label>
				<label className="field">
					<LabelActual label={t('Enabled')} />
					<EditAttribute
						attribute="systemInfo.enabled"
						obj={coreSystem}
						type="checkbox"
						collection={CoreSystem}
					></EditAttribute>
				</label>
			</div>
		</>
	)
}

function SystemManagementSupportPanel({ coreSystem }: Readonly<WithCoreSystemProps>) {
	const { t } = useTranslation()

	const { wrappedItem, overrideHelper } = useCoreSystemSettingsWithOverrides(coreSystem)

	return (
		<>
			<h2 className="my-4">{t('Support Panel')}</h2>
			<div className="properties-grid">
				<LabelAndOverrides
					label={t('Edit Support Panel')}
					item={wrappedItem}
					// @ts-expect-error deep property
					itemKey={'support.message'}
					overrideHelper={overrideHelper}
					hint={t('HTML that will be shown in the Support Panel')}
				>
					{(value, handleUpdate) => <CombinedMultiLineTextInputControl value={value} handleUpdate={handleUpdate} />}
				</LabelAndOverrides>
			</div>
		</>
	)
}

function SystemManagementEvaluationsMessage({ coreSystem }: Readonly<WithCoreSystemProps>) {
	const { t } = useTranslation()

	const { wrappedItem, overrideHelper } = useCoreSystemSettingsWithOverrides(coreSystem)

	return (
		<>
			<h2 className="my-4">{t('Evaluations')}</h2>
			<div className="properties-grid">
				<LabelAndOverridesForCheckbox
					label={t('Enabled')}
					item={wrappedItem}
					// @ts-expect-error deep property
					itemKey={'evaluationsMessage.enabled'}
					overrideHelper={overrideHelper}
				>
					{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
				</LabelAndOverridesForCheckbox>

				<LabelAndOverrides
					label={t('Heading')}
					item={wrappedItem}
					// @ts-expect-error deep property
					itemKey={'evaluationsMessage.heading'}
					overrideHelper={overrideHelper}
				>
					{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
				</LabelAndOverrides>

				<LabelAndOverrides
					label={t('Message')}
					item={wrappedItem}
					// @ts-expect-error deep property
					itemKey={'evaluationsMessage.message'}
					overrideHelper={overrideHelper}
					hint={t('Message shown to users in the Evaluations form')}
				>
					{(value, handleUpdate) => <CombinedMultiLineTextInputControl value={value} handleUpdate={handleUpdate} />}
				</LabelAndOverrides>
			</div>
		</>
	)
}

function SystemManagementMonitoring({ coreSystem }: Readonly<WithCoreSystemProps>) {
	const { t } = useTranslation()

	return (
		<>
			<h2 className="my-4">{t('Application Performance Monitoring')}</h2>
			<div className="properties-grid">
				<label className="field">
					<LabelActual label={t('APM Enabled')} />
					<EditAttribute
						attribute="apm.enabled"
						obj={coreSystem}
						type="checkbox"
						collection={CoreSystem}
					></EditAttribute>
				</label>
				<label className="field">
					<LabelActual label={t('APM Transaction Sample Rate')} />
					<EditAttribute attribute="apm.transactionSampleRate" obj={coreSystem} type="float" collection={CoreSystem} />
					<span className="text-s dimmed field-hint">
						{t(
							'How many of the transactions to monitor. Set to -1 to log nothing (max performance), 0.5 to log 50% of the transactions, 1 to log all transactions'
						)}
					</span>
					<span className="text-s dimmed field-hint">
						{t('Note: Core needs to be restarted to apply these settings')}
					</span>
				</label>

				<label className="field">
					<LabelActual label={t('Monitor blocked thread')} />
					<EditAttribute
						attribute="enableMonitorBlockedThread"
						obj={coreSystem}
						type="checkbox"
						collection={CoreSystem}
					/>
					<span className="text-s dimmed field-hint">
						{t(
							'Enables internal monitoring of blocked main thread. Logs when there is an issue, but (unverified) might cause issues in itself.'
						)}
					</span>
				</label>
			</div>

			<div>{t('Note: Core needs to be restarted to apply these settings')}</div>
		</>
	)
}

function SystemManagementCronJobs({ coreSystem }: Readonly<WithCoreSystemProps>) {
	const { t } = useTranslation()

	const { wrappedItem, overrideHelper } = useCoreSystemSettingsWithOverrides(coreSystem)

	return (
		<>
			<h2 className="my-4">{t('Cron jobs')}</h2>
			<div className="properties-grid">
				<LabelAndOverridesForCheckbox
					label={t('Enable CasparCG restart job')}
					item={wrappedItem}
					// @ts-expect-error deep property
					itemKey={'cron.casparCGRestart.enabled'}
					overrideHelper={overrideHelper}
				>
					{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
				</LabelAndOverridesForCheckbox>

				<LabelAndOverridesForCheckbox
					label={t('Enable automatic storage of Rundown Playlist snapshots periodically')}
					item={wrappedItem}
					// @ts-expect-error deep property
					itemKey={'cron.storeRundownSnapshots.enabled'}
					overrideHelper={overrideHelper}
				>
					{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
				</LabelAndOverridesForCheckbox>

				<LabelAndOverridesForMultiLineText
					label={t('Rundown Playlist names to store')}
					item={wrappedItem}
					// @ts-expect-error deep property
					itemKey={'cron.storeRundownSnapshots.rundownNames'}
					overrideHelper={overrideHelper}
					hint={t('(Comma separated list. Empty - will store snapshots of all Rundown Playlists)')}
				>
					{(value, handleUpdate) => <MultiLineTextInputControl value={value} handleUpdate={handleUpdate} />}
				</LabelAndOverridesForMultiLineText>
			</div>
		</>
	)
}

function SystemManagementCleanup() {
	const { t } = useTranslation()

	const localCheckForOldDataAndCleanUp = useCallback(() => {
		checkForOldDataAndCleanUp(t)
	}, [t])

	const cleanUpOldDatabaseIndexes = useCallback(() => {
		MeteorCall.system
			.cleanupIndexes(false)
			.then((indexesToRemove) => {
				doModalDialog({
					title: t('Remove indexes'),
					message: t('This will remove {{indexCount}} old indexes, do you want to continue?', {
						indexCount: indexesToRemove.length,
					}),
					yes: t('Yes'),
					no: t('No'),
					onAccept: () => {
						MeteorCall.system
							.cleanupIndexes(true)
							.then((indexesRemoved) => {
								doModalDialog({
									title: t('Remove indexes'),
									message: t('{{indexCount}} indexes was removed.', {
										indexCount: indexesRemoved.length,
									}),
									acceptOnly: true,
									onAccept: () => {
										// nothing
									},
								})
							})
							.catch(catchError('system.cleanupIndexes'))
					},
				})
			})
			.catch(catchError('system.cleanupIndexes'))
	}, [t])

	return (
		<>
			<h2 className="my-4">{t('Cleanup')}</h2>
			<div>
				<Button onClick={cleanUpOldDatabaseIndexes} variant="secondary" className="me-1 btn-outline-secondary">
					{t('Cleanup old database indexes')}
				</Button>

				<Button onClick={localCheckForOldDataAndCleanUp} variant="secondary" className="me-1 btn-outline-secondary">
					{t('Cleanup old data')}
				</Button>
			</div>
		</>
	)
}

export function checkForOldDataAndCleanUp(t: TFunction, retriesLeft = 0): void {
	MeteorCall.system
		.cleanupOldData(false)
		.then((results) => {
			if (typeof results === 'string') {
				if (retriesLeft <= 0) {
					doModalDialog({
						title: t('Error when checking for cleaning up'),
						message: results,
						acceptOnly: true,
						onAccept: () => {
							// nothing
						},
					})
				} else {
					// Try again:
					Meteor.setTimeout(() => {
						checkForOldDataAndCleanUp(t, retriesLeft - 1)
					}, 300)
				}
			} else {
				const collections = Object.values<CollectionCleanupResult[0]>(results).filter((o) => o.docsToRemove > 0)
				collections.sort((a, b) => {
					return a.docsToRemove - b.docsToRemove
				})

				let totalCount = 0
				const affectedCollections: string[] = []
				for (const result of Object.values<CollectionCleanupResult['0']>(results)) {
					totalCount += result.docsToRemove
					if (result.docsToRemove > 0) {
						affectedCollections.push(result.collectionName)
					}
				}
				if (totalCount) {
					doModalDialog({
						title: t('Remove old data from database'),
						message: (
							<React.Fragment>
								<p>
									{t('There are {{count}} documents that can be removed, do you want to continue?', {
										count: totalCount,
										collections: languageAnd(t, affectedCollections),
									})}
								</p>
								<p>
									{t('Documents to be removed:')}
									<ul>
										{collections.map((o, index) => {
											return (
												<li key={index}>
													{o.collectionName}: {o.docsToRemove}
												</li>
											)
										})}
									</ul>
								</p>
							</React.Fragment>
						),

						yes: t('Yes'),
						no: t('No'),
						onAccept: () => {
							MeteorCall.system
								.cleanupOldData(true)
								.then((results) => {
									if (typeof results === 'string') {
										doModalDialog({
											title: t('Error'),
											message: results,
											acceptOnly: true,
											onAccept: () => {
												checkForOldDataAndCleanUp(t, retriesLeft)
											},
											yes: t('Retry'),
											no: t('Cancel'),
										})
									} else {
										doModalDialog({
											title: t('Remove old data'),
											message: t('The old data was removed.'),
											acceptOnly: true,
											onAccept: () => {
												// nothing
											},
										})
									}
								})
								.catch(catchError('system.cleanupOldData'))
						},
					})
				} else {
					doModalDialog({
						title: t('Remove old data from database'),
						message: t('Nothing to cleanup!'),
						acceptOnly: true,
						onAccept: () => {
							// nothing
						},
					})
				}
			}
		})
		.catch(catchError('system.cleanupOldData'))
}
function SystemManagementHeapSnapshot() {
	const { t } = useTranslation()

	const [displayWarning, setDisplayWarning] = React.useState(false)
	const [active, setActive] = React.useState(false)

	const onAreYouSure = useCallback(() => {
		setDisplayWarning(true)
	}, [])
	const onReset = useCallback(() => {
		setDisplayWarning(false)
		setActive(false)
	}, [])
	const onConfirm = useCallback(() => {
		setActive(true)
		setTimeout(() => setActive(false), 20000)
	}, [])
	return (
		<>
			<h2 className="my-4">{t('Memory troubleshooting')}</h2>
			<div>
				{active ? (
					<span>{t('Preparing, please wait...')}</span>
				) : displayWarning ? (
					<>
						<div>{t(`Are you sure? This will cause the whole Sofie system to be unresponsive several seconds!`)}</div>

						<a
							className="btn btn-primary"
							href={createPrivateApiPath('heapSnapshot/retrieve?areYouSure=yes')}
							onClick={onConfirm}
						>
							{t(`Yes, Take and Download Memory Heap Snapshot`)}
						</a>
						<Button onClick={onReset}>{t(`No`)}</Button>
					</>
				) : (
					<Button onClick={onAreYouSure} variant="secondary" className="btn-outline-secondary">
						{t(`Take and Download Memory Heap Snapshot`)}
					</Button>
				)}
			</div>
			<div>
				<span className="text-s dimmed field-hint">
					{t('To inspect the memory heap snapshot, use Chrome DevTools')}
				</span>
			</div>
		</>
	)
}

function useCoreSystemSettingsWithOverrides(coreSystem: ICoreSystem) {
	const saveOverrides = useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			CoreSystem.update(coreSystem._id, {
				$set: {
					'settingsWithOverrides.overrides': newOps.map((op) => ({
						...op,
						path: op.path.startsWith('0.') ? op.path.slice(2) : op.path,
					})),
				},
			})
		},
		[coreSystem._id]
	)

	return useOverrideOpHelperForSimpleObject(saveOverrides, coreSystem.settingsWithOverrides)
}
