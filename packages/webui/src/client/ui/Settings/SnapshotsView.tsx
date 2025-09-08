import * as React from 'react'
import { Translated, useSubscription, useTracker } from '../../lib/ReactMeteorData/react-meteor-data.js'
import { doModalDialog } from '../../lib/ModalDialog.js'
import { SnapshotItem } from '@sofie-automation/meteor-lib/dist/collections/Snapshots'
import { unprotectString } from '../../lib/tempLib.js'
import _ from 'underscore'
import { logger } from '../../lib/logging.js'
import { EditAttribute } from '../../lib/EditAttribute.js'
import { faWindowClose, faUpload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
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
import { useTranslation, withTranslation } from 'react-i18next'
import Button from 'react-bootstrap/esm/Button'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { createPrivateApiPath } from '../../url.js'
import { UserError } from '@sofie-automation/corelib/dist/error'

interface IProps {
	match: {
		params: {
			showStyleId: string
		}
	}
}
interface IState {
	uploadFileKey: string // Used to force clear the input after use
	uploadFileKey2: string // Used to force clear the input after use
	editSnapshotId: SnapshotId | null
	removeSnapshots: boolean
}
interface ITrackedProps {
	snapshots: Array<SnapshotItem>
	studios: Array<DBStudio>
}

export default function SnapshotsView(props: Readonly<IProps>): JSX.Element {
	// // Subscribe to data:
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

	return <SnapshotsViewContent {...props} snapshots={snapshots} studios={studios} />
}

const SnapshotsViewContent = withTranslation()(
	class SnapshotsViewContent extends React.Component<Translated<IProps & ITrackedProps>, IState> {
		constructor(props: Translated<IProps & ITrackedProps>) {
			super(props)
			this.state = {
				uploadFileKey: `${Date.now()}_1`,
				uploadFileKey2: `${Date.now()}_2`,
				editSnapshotId: null,
				removeSnapshots: false,
			}
		}

		restoreStoredSnapshot = (snapshotId: SnapshotId) => {
			const snapshot = Snapshots.findOne(snapshotId)
			if (snapshot) {
				doModalDialog({
					title: 'Restore Snapshot',
					message: `Do you really want to restore the snapshot ${snapshot.name}?`,
					onAccept: () => {
						MeteorCall.snapshot
							.restoreSnapshot(snapshotId, false)
							.then(() => {
								// todo: replace this with something else
								doModalDialog({
									title: 'Restore Snapshot',
									message: `Snapshot restored!`,
									acceptOnly: true,
									onAccept: () => {
										// nothing
									},
								})
							})
							.catch((err) => {
								logger.error(err)
								doModalDialog({
									title: 'Restore Snapshot',
									message: `Error: ${err.toString()}`,
									acceptOnly: true,
									onAccept: () => {
										// nothing
									},
								})
							})
					},
				})
			}
		}
		takeSystemSnapshot = (studioId: StudioId | null) => {
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
						title: 'Restore Snapshot',
						message: `Error: ${err.toString()}`,
						acceptOnly: true,
						onAccept: () => {
							// nothing
						},
					})
				})
		}
		takeDebugSnapshot = (studioId: StudioId) => {
			MeteorCall.system
				.generateSingleUseToken()
				.then((tokenResponse) => {
					if (ClientAPI.isClientResponseError(tokenResponse)) throw UserError.fromSerialized(tokenResponse.error)
					if (!tokenResponse.result) throw new Error('Failed to generate token')
					return MeteorCall.snapshot.storeDebugSnapshot(
						hashSingleUseToken(tokenResponse.result),
						studioId,
						`Requested by user`
					)
				})
				.catch((err) => {
					logger.error(err)
					doModalDialog({
						title: 'Restore Snapshot',
						message: `Error: ${err.toString()}`,
						acceptOnly: true,
						onAccept: () => {
							// nothing
						},
					})
				})
		}
		editSnapshot = (snapshotId: SnapshotId) => {
			if (this.state.editSnapshotId === snapshotId) {
				this.setState({
					editSnapshotId: null,
				})
			} else {
				this.setState({
					editSnapshotId: snapshotId,
				})
			}
		}
		toggleRemoveView = () => {
			this.setState({
				removeSnapshots: !this.state.removeSnapshots,
			})
		}
		removeStoredSnapshot = (snapshotId: SnapshotId) => {
			const snapshot = Snapshots.findOne(snapshotId)
			if (snapshot) {
				doModalDialog({
					title: 'Remove Snapshot',
					message: `Are you sure, do you really want to REMOVE the Snapshot ${snapshot.name}?\r\nThis cannot be undone!!`,
					onAccept: () => {
						MeteorCall.snapshot.removeSnapshot(snapshotId).catch((err) => {
							logger.error(err)
							doModalDialog({
								title: 'Remove Snapshot',
								message: `Error: ${err.toString()}`,
								acceptOnly: true,
								onAccept: () => {
									// nothing
								},
							})
						})
					},
				})
			}
		}
		render(): JSX.Element {
			const { t } = this.props

			return (
				<div className="studio-edit mx-4">
					<h2 className="my-2">{t('Take a Snapshot')}</h2>
					<div>
						<h3 className="my-2">{t('Full System Snapshot')}</h3>
						<p className="my-2">
							<span className="text-s vsubtle">
								{t(
									'A Full System Snapshot contains all system settings (studios, showstyles, blueprints, devices, etc.)'
								)}
							</span>
						</p>

						<div>
							<button
								className="btn btn-primary"
								onClick={() => {
									this.takeSystemSnapshot(null)
								}}
							>
								{t('Take a Full System Snapshot')}
							</button>
						</div>

						{this.props.studios.length > 1 ? (
							<div>
								<h3 className="my-2">{t('Studio Snapshot')}</h3>
								<p className="my-2 text-s dimmed field-hint">
									{t('A Studio Snapshot contains all system settings related to that studio')}
								</p>
								{_.map(this.props.studios, (studio) => {
									return (
										<div key={unprotectString(studio._id)}>
											<button
												className="btn btn-primary"
												onClick={() => {
													this.takeSystemSnapshot(studio._id)
												}}
											>
												{t('Take a Snapshot for studio "{{studioName}}" only', { studioName: studio.name })}
											</button>
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
							{t('Reads the ingest (NRCS) data, and pipes it throught the blueprints')}
						</span>
					</p>

					<h2 className="mb-4">{t('Restore from Stored Snapshots')}</h2>
					<div>
						<table className="table">
							<tbody>
								<tr>
									<th></th>
									<th>Type</th>
									<th>Name</th>
									<th>Comment</th>
									{this.state.removeSnapshots ? <th></th> : null}
								</tr>
								{_.map(this.props.snapshots, (snapshot) => {
									return (
										<tr key={unprotectString(snapshot._id)}>
											<td>
												<Button
													variant="outline-secondary"
													onClick={() => {
														this.restoreStoredSnapshot(snapshot._id)
													}}
												>
													{t('Restore')}
												</Button>
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
												{this.state.editSnapshotId === snapshot._id ? (
													<div className="secondary-control-after">
														<EditAttribute collection={Snapshots} obj={snapshot} attribute="comment" type="multiline" />

														<button className="action-btn" onClick={() => this.editSnapshot(snapshot._id)}>
															<FontAwesomeIcon icon={faWindowClose} />
														</button>
													</div>
												) : (
													<a
														href="#"
														onClick={(e) => {
															e.preventDefault()
															this.editSnapshot(snapshot._id)
														}}
													>
														<span className="text-s vsubtle">{multilineText(snapshot.comment)}</span>
													</a>
												)}
											</td>
											{this.state.removeSnapshots ? (
												<td>
													<Button
														variant="outline-secondary"
														onClick={() => {
															this.removeStoredSnapshot(snapshot._id)
														}}
													>
														{t('Remove')}
													</Button>
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
									this.toggleRemoveView()
								}}
							>
								{t('Show "Remove snapshots"-buttons')}
							</a>
						</div>
					</div>
				</div>
			)
		}
	}
)

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
