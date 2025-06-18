import * as React from 'react'
import { Translated, useSubscription, useTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { doModalDialog } from '../../lib/ModalDialog'
import { SnapshotItem } from '@sofie-automation/meteor-lib/dist/collections/Snapshots'
import { unprotectString } from '../../lib/tempLib'
import * as _ from 'underscore'
import { logger } from '../../lib/logging'
import { EditAttribute } from '../../lib/EditAttribute'
import { faWindowClose, faUpload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { multilineText, fetchFrom } from '../../lib/lib'
import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications'
import { UploadButton } from '../../lib/uploadButton'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { MeteorCall } from '../../lib/meteorApi'
import { SnapshotId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Snapshots, Studios } from '../../collections'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { hashSingleUseToken } from '../../lib/lib'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { withTranslation } from 'react-i18next'

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

		onUploadFile(e: React.ChangeEvent<HTMLInputElement>, restoreVariant?: 'debug' | 'ingest') {
			const { t } = this.props

			const file = e.target.files?.[0]
			if (!file) {
				return
			}

			const reader = new FileReader()
			reader.onload = (e2) => {
				this.setState({
					uploadFileKey: `${Date.now()}_1`,
					uploadFileKey2: `${Date.now()}_2`,
				})
				const uploadFileContents = ((e2.target as any) || {}).result

				doModalDialog({
					title: t('Restore from this Snapshot file?'),
					message: t('Are you sure you want to restore the system from the snapshot file "{{fileName}}"?', {
						fileName: file.name,
					}),
					onAccept: () => {
						fetchFrom('/api/private/snapshot/restore', {
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
					onDiscard: () => {
						this.setState({
							// to clear input field:
							uploadFileKey: `${Date.now()}_1`,
							uploadFileKey2: `${Date.now()}_2`,
						})
					},
				})
			}

			reader.readAsText(file)
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
					if (ClientAPI.isClientResponseError(tokenResponse) || !tokenResponse.result) {
						throw tokenResponse
					}
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
					if (ClientAPI.isClientResponseError(tokenResponse) || !tokenResponse.result) {
						throw tokenResponse
					}
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
				<div className="studio-edit mod mhl mvn">
					<div>
						<div>
							<h2 className="mhn mtn">{t('Take a Snapshot')}</h2>
							<div>
								<h3 className="mhn">{t('Full System Snapshot')}</h3>
								<p className="mhn">
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
										<h3 className="mhn">{t('Studio Snapshot')}</h3>
										<p className="mhn text-s dimmed field-hint">
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
						</div>
						<h2 className="mhn">{t('Restore from Snapshot File')}</h2>
						<div className="mdi">
							<p className="mhn">
								<UploadButton
									accept="application/json,.json"
									className="btn btn-secondary"
									onChange={(e) => this.onUploadFile(e)}
									key={this.state.uploadFileKey}
								>
									<FontAwesomeIcon icon={faUpload} />
									<span>{t('Upload Snapshot')}</span>
								</UploadButton>
								<span className="text-s vsubtle mls">{t('Upload a snapshot file')}</span>
							</p>
							<p className="mhn">
								<UploadButton
									accept="application/json,.json"
									className="btn btn-secondary"
									onChange={(e) => this.onUploadFile(e, 'debug')}
									key={this.state.uploadFileKey2}
								>
									<FontAwesomeIcon icon={faUpload} />
									<span>{t('Upload Snapshot (for debugging)')}</span>
								</UploadButton>
								<span className="text-s vsubtle mls">
									{t(
										'Upload a snapshot file (restores additional info not directly related to a Playlist / Rundown, such as Packages, PackageWorkStatuses etc'
									)}
								</span>
							</p>
							<p className="mhn">
								<UploadButton
									accept="application/json,.json"
									className="btn btn-secondary"
									onChange={(e) => this.onUploadFile(e, 'ingest')}
									key={this.state.uploadFileKey2}
								>
									<FontAwesomeIcon icon={faUpload} />
									<span>{t('Ingest from Snapshot')}</span>
								</UploadButton>
								<span className="text-s vsubtle mls">
									{t('Reads the ingest (NRCS) data, and pipes it throught the blueprints')}
								</span>
							</p>
						</div>
						<h2 className="mhn">{t('Restore from Stored Snapshots')}</h2>
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
													<button
														className="btn mod mhm"
														onClick={() => {
															this.restoreStoredSnapshot(snapshot._id)
														}}
													>
														{t('Restore')}
													</button>
												</td>
												<td>{snapshot.type}</td>
												<td>
													<a href={`/api/private/snapshot/retrieve/${snapshot._id}`} target="_blank" rel="noreferrer">
														{snapshot.name}
													</a>
												</td>
												<td>
													{this.state.editSnapshotId === snapshot._id ? (
														[
															<EditAttribute
																key={0}
																collection={Snapshots}
																obj={snapshot}
																attribute="comment"
																type="multiline"
															/>,
															<button key={1} className="action-btn" onClick={() => this.editSnapshot(snapshot._id)}>
																<FontAwesomeIcon icon={faWindowClose} />
															</button>,
														]
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
														<button
															className="btn mod mhm btn-secondary"
															onClick={() => {
																this.removeStoredSnapshot(snapshot._id)
															}}
														>
															{t('Remove')}
														</button>
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
				</div>
			)
		}
	}
)
