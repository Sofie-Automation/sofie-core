import * as React from 'react'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/react-meteor-data.js'
import { doModalDialog } from '../../lib/ModalDialog.js'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { logger } from '../../lib/logging.js'
import { EditAttribute } from '../../lib/EditAttribute.js'
import { faWindowClose, faUpload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { multilineText, fetchFrom } from '../../lib/lib.js'
import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications.js'
import { UploadButton } from '../../lib/uploadButton.js'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { MeteorCall } from '../../lib/meteorApi.js'
import { SnapshotId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Snapshots, Studios } from '../../collections/index.js'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { hashSingleUseToken } from '../../lib/lib.js'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { useTranslation } from 'react-i18next'
import Button from 'react-bootstrap/esm/Button'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { createPrivateApiPath } from '../../url.js'
import { UserError } from '@sofie-automation/corelib/dist/error'

export default function SnapshotsView(): JSX.Element {
	const { t } = useTranslation()

	const [removeSnapshots, setRemoveSnapshots] = React.useState(false)
	const toggleRemoveView = React.useCallback(() => setRemoveSnapshots((old) => !old), [])

	const [editSnapshotId, setEditSnapshotId] = React.useState<SnapshotId | null>(null)

	// Subscribe to data:
	useSubscription(MeteorPubSub.snapshots)
	useSubscription(CorelibPubSub.studios, null)

	const snapshots = useTracker(
		() =>
			Snapshots.find(
				{},
				{
					sort: {
						created: -1,
					},
				}
			).fetch(),
		[],
		[]
	)
	const studios = useTracker(() => Studios.find({}, {}).fetch(), [], [])

	return (
		<div className="studio-edit mx-4">
			<h2 className="my-2">{t('Take a Snapshot')}</h2>
			<div>
				<h3 className="my-2">{t('Full System Snapshot')}</h3>
				<p className="my-2">
					<span className="text-s vsubtle">
						{t('A Full System Snapshot contains all system settings (studios, showstyles, blueprints, devices, etc.)')}
					</span>
				</p>

				<div>
					<TakeSystemSnapshotButton studioId={null} />
				</div>

				{studios.length > 1 ? (
					<div>
						<h3 className="my-2">{t('Studio Snapshot')}</h3>
						<p className="my-2 text-s dimmed field-hint">
							{t('A Studio Snapshot contains all system settings related to that studio')}
						</p>
						{studios.map((studio) => {
							return (
								<div key={unprotectString(studio._id)}>
									<TakeSystemSnapshotButton studioId={studio._id} />
								</div>
							)
						})}
					</div>
				) : null}
			</div>

			<h2 className="mb-4">{t('Restore from Snapshot File')}</h2>

			<p className="my-2">
				<SnapshotImportButton>
					<span>{t('Upload Snapshot')}</span>
				</SnapshotImportButton>
				<span className="text-s vsubtle ms-2">{t('Upload a snapshot file')}</span>
			</p>
			<p className="my-2">
				<SnapshotImportButton restoreVariant="debug">
					<span>{t('Upload Snapshot (for debugging)')}</span>
				</SnapshotImportButton>
				<span className="text-s vsubtle ms-2">
					{t(
						'Upload a snapshot file (restores additional info not directly related to a Playlist / Rundown, such as Packages, PackageWorkStatuses etc'
					)}
				</span>
			</p>
			<p className="my-2">
				<SnapshotImportButton restoreVariant="ingest">
					<span>{t('Ingest from Snapshot')}</span>
				</SnapshotImportButton>
				<span className="text-s vsubtle ms-2">
					{t('Reads the ingest (NRCS) data, and pipes it through the blueprints')}
				</span>
			</p>

			<h2 className="mb-4">{t('Restore from Stored Snapshots')}</h2>
			<div>
				<table className="table">
					<tbody>
						<tr>
							<th></th>
							<th>{t('Type')}</th>
							<th>{t('Name')}</th>
							<th>{t('Comment')}</th>
							{removeSnapshots ? <th></th> : null}
						</tr>
						{snapshots.map((snapshot) => {
							return (
								<tr key={unprotectString(snapshot._id)}>
									<td>
										<RestoreStoredSnapshotButton snapshotId={snapshot._id} />
									</td>
									<td>{snapshot.type}</td>
									<td>
										<a
											href={createPrivateApiPath(`snapshot/retrieve/${snapshot._id}`)}
											target="_blank"
											rel="noreferrer"
										>
											{snapshot.name}
										</a>
									</td>
									<td>
										{editSnapshotId === snapshot._id ? (
											<div className="secondary-control-after">
												<EditAttribute collection={Snapshots} obj={snapshot} attribute="comment" type="multiline" />

												<button className="action-btn" onClick={() => setEditSnapshotId(null)}>
													<FontAwesomeIcon icon={faWindowClose} />
												</button>
											</div>
										) : (
											<a
												href="#"
												onClick={(e) => {
													e.preventDefault()
													setEditSnapshotId(snapshot._id)
												}}
											>
												<span className="text-s vsubtle">{multilineText(snapshot.comment)}</span>
											</a>
										)}
									</td>
									{removeSnapshots ? (
										<td>
											<RemoveSnapshotButton snapshotId={snapshot._id} />
										</td>
									) : null}
								</tr>
							)
						})}
					</tbody>
				</table>
				<div>
					<a
						href="#"
						onClick={(e) => {
							e.preventDefault()
							toggleRemoveView()
						}}
					>
						{t('Show "Remove snapshots"-buttons')}
					</a>
				</div>
			</div>
		</div>
	)
}

function SnapshotImportButton({
	restoreVariant,
	children,
}: React.PropsWithChildren<{ restoreVariant?: 'debug' | 'ingest' }>) {
	const { t } = useTranslation()

	const onUploadFile = React.useCallback(
		(uploadFileContents: string, file: File) => {
			doModalDialog({
				title: t('Restore from this Snapshot file?'),
				message: t('Are you sure you want to restore the system from the snapshot file "{{fileName}}"?', {
					fileName: file.name,
				}),
				onAccept: () => {
					fetchFrom(createPrivateApiPath('snapshot/restore'), {
						method: 'POST',
						body: uploadFileContents,
						headers: {
							'content-type': 'application/json',
							'restore-debug-data': restoreVariant === 'debug' ? '1' : '0',
							'ingest-snapshot-data': restoreVariant === 'ingest' ? '1' : '0',
						},
					})
						.then(() => {
							NotificationCenter.push(
								new Notification(
									undefined,
									NoticeLevel.NOTIFICATION,
									t('Successfully restored snapshot'),
									'RestoreSnapshot'
								)
							)
						})
						.catch((err) => {
							NotificationCenter.push(
								new Notification(
									undefined,
									NoticeLevel.WARNING,
									t('Snapshot restore failed: {{errorMessage}}', { errorMessage: err + '' }),
									'RestoreSnapshot'
								)
							)
						})
				},
			})
		},
		[t, restoreVariant]
	)
	const onUploadError = React.useCallback(
		(err: Error) => {
			NotificationCenter.push(
				new Notification(
					undefined,
					NoticeLevel.WARNING,
					t('Snapshot restore failed: {{errorMessage}}', { errorMessage: stringifyError(err) }),
					'RestoreSnapshot'
				)
			)
		},
		[t]
	)

	return (
		<UploadButton
			accept="application/json,.json"
			className="btn btn-outline-secondary me-2"
			onUploadContents={onUploadFile}
			onUploadError={onUploadError}
		>
			<FontAwesomeIcon icon={faUpload} />
			{children}
		</UploadButton>
	)
}

function RestoreStoredSnapshotButton({ snapshotId }: { snapshotId: SnapshotId }) {
	const { t } = useTranslation()

	const restoreStoredSnapshot = React.useCallback(() => {
		const snapshot = Snapshots.findOne(snapshotId)
		if (snapshot) {
			doModalDialog({
				title: t('Restore Snapshot'),
				message: t('Do you really want to restore the snapshot "{{snapshotName}}"?', { snapshotName: snapshot.name }),
				onAccept: () => {
					MeteorCall.snapshot
						.restoreSnapshot(snapshotId, false)
						.then(() => {
							// todo: replace this with something else
							doModalDialog({
								title: t('Restore Snapshot'),
								message: t('Snapshot restored!'),
								acceptOnly: true,
								onAccept: () => {
									// nothing
								},
							})
						})
						.catch((err) => {
							logger.error(err)
							doModalDialog({
								title: t('Restore Snapshot'),
								message: t('Snapshot restore failed: {{errorMessage}}', { errorMessage: stringifyError(err) }),
								acceptOnly: true,
								onAccept: () => {
									// nothing
								},
							})
						})
				},
			})
		}
	}, [t, snapshotId])

	return (
		<Button variant="outline-secondary" onClick={restoreStoredSnapshot}>
			{t('Restore')}
		</Button>
	)
}

function TakeSystemSnapshotButton({ studioId }: { studioId: StudioId | null }) {
	const { t } = useTranslation()

	const takeSystemSnapshot = React.useCallback(() => {
		MeteorCall.system
			.generateSingleUseToken()
			.then((tokenResponse) => {
				if (ClientAPI.isClientResponseError(tokenResponse)) throw UserError.fromSerialized(tokenResponse.error)
				if (!tokenResponse.result) throw new Error('Failed to generate token')
				return MeteorCall.snapshot.storeSystemSnapshot(
					hashSingleUseToken(tokenResponse.result),
					studioId,
					`Requested by user`
				)
			})
			.catch((err) => {
				logger.error(err)
				doModalDialog({
					title: t('Take System Snapshot'),
					message: t('Take System Snapshot failed: {{errorMessage}}', { errorMessage: stringifyError(err) }),
					acceptOnly: true,
					onAccept: () => {
						// nothing
					},
				})
			})
	}, [t, studioId])

	const studioName = useTracker(() => (studioId ? Studios.findOne(studioId)?.name : null), [studioId])

	return (
		<Button variant="primary" onClick={takeSystemSnapshot}>
			{studioId
				? t('Take a Snapshot for studio "{{studioName}}" only', { studioName: studioName ?? studioId })
				: t('Take a Full System Snapshot')}
		</Button>
	)
}

function RemoveSnapshotButton({ snapshotId }: { snapshotId: SnapshotId }) {
	const { t } = useTranslation()

	const removeStoredSnapshot = React.useCallback(() => {
		const snapshot = Snapshots.findOne(snapshotId)
		if (snapshot) {
			doModalDialog({
				title: t('Remove Snapshot'),
				message: t(
					'Are you sure, do you really want to REMOVE the Snapshot "{{snapshotName}}"?\r\nThis cannot be undone!!',
					{ snapshotName: snapshot.name }
				),
				onAccept: () => {
					MeteorCall.snapshot.removeSnapshot(snapshotId).catch((err) => {
						logger.error(err)
						doModalDialog({
							title: t('Remove Snapshot'),
							message: t('Snapshot remove failed: {{errorMessage}}', { errorMessage: stringifyError(err) }),
							acceptOnly: true,
							onAccept: () => {
								// nothing
							},
						})
					})
				},
			})
		}
	}, [t, snapshotId])

	return (
		<Button variant="outline-secondary" onClick={removeStoredSnapshot}>
			{t('Remove')}
		</Button>
	)
}
