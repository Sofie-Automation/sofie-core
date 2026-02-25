import * as React from 'react'
import { EditAttribute } from '../../lib/EditAttribute.js'
import { useTracker } from '../../lib/ReactMeteorData/react-meteor-data.js'
import { Spinner } from '../../lib/Spinner.js'
import { doModalDialog } from '../../lib/ModalDialog.js'
import Moment from 'react-moment'
import { Link } from 'react-router-dom'
import { BlueprintManifestType } from '@sofie-automation/blueprints-integration'
import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications.js'
import { catchError, fetchFrom } from '../../lib/lib.js'
import { UploadButton } from '../../lib/uploadButton.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUpload, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { MeteorCall } from '../../lib/meteorApi.js'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Blueprints, CoreSystem, ShowStyleBases, Studios } from '../../collections/index.js'
import { LabelActual } from '../../lib/Components/LabelAndOverrides.js'
import Button from 'react-bootstrap/esm/Button'
import { useTranslation } from 'react-i18next'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { createPrivateApiPath } from '../../url.js'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase.js'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio.js'
import { assertNever } from '@sofie-automation/corelib/dist/lib'

interface IProps {
	blueprintId: BlueprintId
}

export default function BlueprintSettings({ blueprintId }: IProps): JSX.Element {
	const { t } = useTranslation()

	const blueprint = useTracker(() => Blueprints.findOne(blueprintId), [blueprintId])

	if (!blueprint) {
		return <Spinner />
	}

	return (
		<div className="studio-edit mx-4">
			<div className="properties-grid">
				<label className="field">
					<LabelActual label={t('Blueprint ID')} />
					<div className="field-content">
						<i>{unprotectString(blueprint._id)}</i>
					</div>
				</label>

				<label className="field">
					<LabelActual label={t('Blueprint Name')} />

					<div className="field-content">
						<EditAttribute attribute="name" obj={blueprint} type="text" collection={Blueprints} />
					</div>
					<div></div>
					<div>
						{!blueprint.name ? (
							<div className="error-notice inline">
								{t('No name set')} <FontAwesomeIcon icon={faExclamationTriangle} />
							</div>
						) : null}
					</div>
				</label>

				<label className="field">
					<LabelActual label={t('Blueprint Type')} />
					<div className="field-content">
						<i>{(blueprint.blueprintType || '').toUpperCase()}</i>
					</div>
					<div></div>
					<div>
						{!blueprint.blueprintType ? (
							<div className="error-notice inline">
								{t('Upload a new blueprint')} <FontAwesomeIcon icon={faExclamationTriangle} />
							</div>
						) : null}
					</div>
				</label>

				<AssignBlueprintButton blueprintId={blueprint._id} blueprintType={blueprint.blueprintType} />

				<label className="field">
					<LabelActual label={t('Last modified')} />
					<div className="field-content">
						<Moment format="YYYY/MM/DD HH:mm:ss">{blueprint.modified}</Moment>
					</div>
				</label>

				{blueprint.blueprintId ? (
					<label className="field">
						<LabelActual label={t('Blueprint ID')} />
						<div className="field-content">
							<i>{blueprint.blueprintId}</i>
						</div>
					</label>
				) : null}

				{blueprint.blueprintVersion ? (
					<label className="field">
						<LabelActual label={t('Blueprint Version')} />
						<div className="field-content">
							<i>{blueprint.blueprintVersion}</i>
						</div>
					</label>
				) : null}

				<label className="field">
					<LabelActual label={t('Disable version check')} />
					<div className="field-content">
						<EditAttribute
							attribute="disableVersionChecks"
							obj={blueprint}
							type="checkbox"
							collection={Blueprints}
							className="input"
						/>
					</div>
				</label>

				<div className="field">
					<LabelActual label="" />
					<div className="field-content">
						<ImportConfigButton blueprintId={blueprint._id} />
					</div>
				</div>
			</div>
		</div>
	)
}

function AssignBlueprintButton({
	blueprintId,
	blueprintType,
}: {
	blueprintId: BlueprintId
	blueprintType: BlueprintManifestType | undefined
}): JSX.Element | null {
	switch (blueprintType) {
		case BlueprintManifestType.SHOWSTYLE:
			return <AssignShowStyleBlueprint blueprintId={blueprintId} />
		case BlueprintManifestType.STUDIO:
			return <AssignStudioBlueprint blueprintId={blueprintId} />
		case BlueprintManifestType.SYSTEM:
			return <AssignSystemBlueprint blueprintId={blueprintId} />
		case undefined:
			return null
		default:
			assertNever(blueprintType)
			return null
	}
}

function AssignShowStyleBlueprint({ blueprintId }: { blueprintId: BlueprintId }): JSX.Element {
	const { t } = useTranslation()

	const assignedShowStyles = useTracker(
		() =>
			ShowStyleBases.find(
				{ blueprintId: blueprintId },
				{
					projection: {
						_id: 1,
						name: 1,
					},
				}
			).fetch() as Pick<DBShowStyleBase, '_id' | 'name'>[],
		[blueprintId],
		[]
	)

	return (
		<div className="field">
			<LabelActual label={t('Assigned Show Styles')} />
			<div className="field-content">
				{assignedShowStyles.length > 0
					? assignedShowStyles.map((showStyleBase) => (
							<span key={unprotectString(showStyleBase._id)} className="pill">
								<Link className="pill-link" to={`/settings/showStyleBase/${showStyleBase._id}`}>
									{showStyleBase.name}
								</Link>
							</span>
						))
					: t('This Blueprint is not being used by any Show Style')}
			</div>
		</div>
	)
}

function AssignStudioBlueprint({ blueprintId }: { blueprintId: BlueprintId }): JSX.Element {
	const { t } = useTranslation()

	const assignedStudios = useTracker(
		() =>
			Studios.find(
				{ blueprintId: blueprintId },
				{
					projection: {
						_id: 1,
						name: 1,
					},
				}
			).fetch() as Pick<DBStudio, '_id' | 'name'>[],
		[blueprintId],
		[]
	)

	return (
		<div className="field">
			<LabelActual label={t('Assigned Studios')} />
			<div className="field-content">
				{assignedStudios.length > 0
					? assignedStudios.map((i) => (
							<span key={unprotectString(i._id)} className="pill">
								<Link className="pill-link" to={`/settings/studio/${i._id}`}>
									{i.name}
								</Link>
							</span>
						))
					: t('This Blueprint is not compatible with any Studio')}
			</div>
		</div>
	)
}
function AssignSystemBlueprint({ blueprintId }: { blueprintId: BlueprintId }): JSX.Element {
	const { t } = useTranslation()

	const isAssignedToSystem = useTracker(
		() =>
			!!CoreSystem.findOne(
				{ blueprintId },
				{
					projection: { _id: 1 },
				}
			),
		[blueprintId]
	)

	const assignSystemBlueprint = () => {
		MeteorCall.blueprint
			.assignSystemBlueprint(isAssignedToSystem ? undefined : blueprintId)
			.catch(catchError('blueprint.assignSystemBlueprint'))
	}

	return (
		<div className="field">
			<LabelActual label="" />
			<div className="field-content">
				<Button variant="primary" onClick={assignSystemBlueprint}>
					{isAssignedToSystem ? t('Unassign') : t('Assign')}
				</Button>
			</div>
		</div>
	)
}

function ImportConfigButton({ blueprintId }: { blueprintId: BlueprintId }) {
	const { t } = useTranslation()

	const onUploadFile = React.useCallback(
		(uploadFileContents: string, file: File) => {
			// First attempt
			doModalDialog({
				title: t('Update Blueprints?'),
				yes: t('Update'),
				no: t('Cancel'),
				message: (
					<React.Fragment>
						<p>
							{t('Are you sure you want to update the blueprints from the file "{{fileName}}"?', {
								fileName: file.name,
							})}
						</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</React.Fragment>
				),
				onAccept: () => {
					fetchFrom(createPrivateApiPath(`blueprints/restore/${blueprintId}`), {
						method: 'POST',
						body: uploadFileContents,
						headers: {
							'content-type': 'text/javascript',
							// authorization: 'id ' + this.props.userId,
						},
					})
						.then(() => {
							NotificationCenter.push(
								new Notification(
									undefined,
									NoticeLevel.NOTIFICATION,
									t('Blueprints updated successfully.'),
									'BlueprintSettings'
								)
							)
						})
						.catch((err) => {
							if (err && err.toString().endsWith('[422]')) {
								// Needs a force flag

								// Try again as a replace
								doModalDialog({
									title: t('Replace Blueprints?'),
									yes: t('Replace'),
									no: t('Cancel'),
									warning: true,
									message: (
										<React.Fragment>
											<p>
												{t('Are you sure you want to replace the blueprints with the file "{{fileName}}"?', {
													fileName: file.name,
												})}
											</p>
											<p>{t('Please note: This action is irreversible!')}</p>
										</React.Fragment>
									),
									onAccept: () => {
										fetchFrom(createPrivateApiPath(`blueprints/restore/${blueprintId}?force=1`), {
											method: 'POST',
											body: uploadFileContents,
											headers: {
												'content-type': 'text/javascript',
												// authorization: 'id ' + this.props.userId,
											},
										})
											.then(() => {
												NotificationCenter.push(
													new Notification(
														undefined,
														NoticeLevel.NOTIFICATION,
														t('Blueprints updated successfully.'),
														'BlueprintSettings'
													)
												)
											})
											.catch((err: string) => {
												NotificationCenter.push(
													new Notification(
														undefined,
														NoticeLevel.WARNING,
														t('Failed to update blueprints: {{errorMessage}}', { errorMessage: err + '' }),
														'BlueprintSettings'
													)
												)
											})
									},
								})
							} else {
								NotificationCenter.push(
									new Notification(
										undefined,
										NoticeLevel.WARNING,
										t('Failed to update blueprints: {{errorMessage}}', { errorMessage: err + '' }),
										'BlueprintSettings'
									)
								)
							}
						})
				},
			})
		},
		[t, blueprintId]
	)

	const onUploadError = React.useCallback(
		(err: Error) => {
			NotificationCenter.push(
				new Notification(
					undefined,
					NoticeLevel.WARNING,
					t('Failed to update blueprints: {{errorMessage}}', { errorMessage: stringifyError(err) }),
					'BlueprintSettings'
				)
			)
		},
		[t]
	)

	return (
		<UploadButton
			className="btn btn-primary"
			accept="text/javascript,.js"
			onUploadContents={onUploadFile}
			onUploadError={onUploadError}
		>
			<FontAwesomeIcon icon={faUpload} />
			<span>{t('Upload Blueprints')}</span>
		</UploadButton>
	)
}
