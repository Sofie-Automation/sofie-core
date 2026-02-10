import * as React from 'react'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data.js'
import { doModalDialog } from '../../lib/ModalDialog.js'
import ClassNames from 'classnames'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faClipboardCheck, faDatabase, faCoffee, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons'
import { logger } from '../../lib/logging.js'
import {
	GetMigrationStatusResult,
	RunMigrationResult,
	MigrationChunk,
} from '@sofie-automation/meteor-lib/dist/api/migration'
import _ from 'underscore'
import { MeteorCall } from '../../lib/meteorApi.js'
import { checkForOldDataAndCleanUp } from './SystemManagement.js'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { UpgradesView } from './Upgrades/View.js'
import Button from 'react-bootstrap/esm/Button'

interface IProps {}
interface IState {
	errorMessage?: string
	migrationNeeded: boolean
	showAllSteps: boolean

	migration?: {
		canDoAutomaticMigration: boolean
		hash: string
		chunks: Array<MigrationChunk>
		automaticStepCount: number
		ignoredStepCount: number
		manualStepCount: number
		partialMigration: boolean
	}
	warnings: Array<string>
	migrationCompleted: boolean
	partialMigration: boolean

	haveRunMigration: boolean
}
interface ITrackedProps {}
export const MigrationView = translateWithTracker<IProps, IState, ITrackedProps>((_props: IProps) => {
	return {}
})(
	class MigrationView extends React.Component<Translated<IProps & ITrackedProps>, IState> {
		private cancelRequests = false

		constructor(props: Translated<IProps & ITrackedProps>) {
			super(props)

			this.state = {
				showAllSteps: false,
				migrationNeeded: false,
				warnings: [],
				migrationCompleted: false,
				partialMigration: false,
				haveRunMigration: false,
			}
		}
		componentDidMount(): void {
			this.updateVersions()
		}
		componentWillUnmount(): void {
			this.cancelRequests = true
		}
		clickRefresh() {
			this.setState({
				warnings: [],
				migrationCompleted: false,
				haveRunMigration: false,
			})

			this.updateVersions()
		}
		setErrorMessage(err: any) {
			this.setState({
				errorMessage: stringifyError(err),
			})
		}
		updateVersions() {
			this.setState({
				errorMessage: '',
				migrationNeeded: false,
			})
			MeteorCall.migration
				.getMigrationStatus()
				.then((r: GetMigrationStatusResult) => {
					if (this.cancelRequests) return

					this.setState({
						migrationNeeded: r.migrationNeeded,
						migration: r.migration,
					})
				})
				.catch((err) => {
					logger.error(err)
					this.setErrorMessage(err)
				})
		}
		runMigration() {
			if (this.state.migration) {
				this.setErrorMessage('')
				MeteorCall.migration
					.runMigration(
						this.state.migration.chunks,
						this.state.migration.hash // hash
					)
					.then((r: RunMigrationResult) => {
						if (this.cancelRequests) return
						this.setState({
							warnings: r.warnings,
							migrationCompleted: r.migrationCompleted,
							haveRunMigration: true,
						})

						this.updateVersions()
						if (r.migrationCompleted) {
							this.checkForOldData()
						}
					})
					.catch((err) => {
						logger.error(err)
						this.setErrorMessage(err)
					})
			}
		}
		forceMigration() {
			this.setErrorMessage('')
			if (this.state.migration) {
				MeteorCall.migration
					.forceMigration(this.state.migration.chunks)
					.then(() => {
						if (this.cancelRequests) return
						this.setState({
							migrationCompleted: true,
							haveRunMigration: true,
						})

						this.updateVersions()
						this.checkForOldData()
					})
					.catch((err) => {
						logger.error(err)
						this.setErrorMessage(err)
					})
			}
		}
		resetDatabaseVersions() {
			const { t } = this.props
			this.setErrorMessage('')
			doModalDialog({
				title: t('Reset Database Version'),
				message: t(
					'Are you sure you want to reset the database version?\nOnly do this if you plan on running the migration right after.'
				),
				onAccept: () => {
					MeteorCall.migration
						.resetDatabaseVersions()
						.then(() => {
							this.updateVersions()
						})
						.catch((err) => {
							logger.error(err)
							this.setErrorMessage(err)
						})
				},
			})
		}
		checkForOldData() {
			checkForOldDataAndCleanUp(this.props.t, 3)
		}
		render(): JSX.Element {
			const { t } = this.props

			return (
				<div className="studio-edit mx-4">
					<div>
						<div>
							<div>
								{this.state.migration
									? _.map(this.state.migration.chunks, (chunk, i) => {
											const str = t('Version for {{name}}: From {{fromVersion}} to {{toVersion}}', {
												name: chunk.sourceName,
												fromVersion: chunk._dbVersion,
												toVersion: chunk._targetVersion,
											})
											return <div key={i}>{chunk._dbVersion === chunk._targetVersion ? <b>{str}</b> : str}</div>
										})
									: null}
							</div>
							<div>{this.state.errorMessage ? <p>{this.state.errorMessage}</p> : null}</div>
							<div className="my-4">
								<Button
									variant="outline-secondary"
									className="mx-1"
									onClick={() => {
										this.clickRefresh()
									}}
								>
									<FontAwesomeIcon icon={faClipboardCheck} className="me-2" />
									<span>{t('Re-check')}</span>
								</Button>

								<Button
									variant="outline-secondary"
									className="mx-1"
									onClick={() => {
										this.resetDatabaseVersions()
									}}
								>
									<FontAwesomeIcon icon={faDatabase} className="me-2" />
									<span>{t('Reset All Versions')}</span>
								</Button>
							</div>
						</div>
						{this.state.migrationNeeded && this.state.migration ? (
							<div>
								<h2 className="my-4">{t('Migrate database')}</h2>

								<p>
									{t(
										`This migration consists of ${this.state.migration.automaticStepCount} automatic steps and  ${this.state.migration.manualStepCount} manual steps (${this.state.migration.ignoredStepCount} steps are ignored).`
									)}
								</p>

								<table className="table expando migration-steps-table">
									<tbody>
										<tr
											className={ClassNames({
												hl: this.state.showAllSteps,
											})}
										>
											<th className="c3">{t('All steps')}</th>
											<td className="table-item-actions c3">
												<button
													className="action-btn"
													onClick={() => this.setState({ showAllSteps: !this.state.showAllSteps })}
												>
													<FontAwesomeIcon icon={this.state.showAllSteps ? faEyeSlash : faEye} />
												</button>
											</td>
										</tr>
										{this.state.showAllSteps && (
											<tr className="expando-details hl">
												<td colSpan={2}>
													{this.state.migration.chunks.map((c) => (
														<div key={c.sourceName}>
															<h3 className="mx-2">{c.sourceName}</h3>
															{_.map(c._steps, (s) => (
																<p key={s}>{s}</p>
															))}
														</div>
													))}
												</td>
											</tr>
										)}
									</tbody>
								</table>

								{this.state.migration.partialMigration ? (
									<p>
										{t(
											"The migration consists of several phases, you will get more options after you've this migration"
										)}
									</p>
								) : null}
								{this.state.migration.canDoAutomaticMigration ? (
									<div>
										<p>{t('The migration can be completed automatically.')}</p>
										<Button
											onClick={() => {
												this.runMigration()
											}}
										>
											<FontAwesomeIcon icon={faDatabase} className="me-2" />
											<span>{t('Run automatic migration procedure')}</span>
										</Button>
									</div>
								) : (
									<div>
										<p className="my-2">
											{t('The migration procedure needs some help from you in order to complete, see below:')}
										</p>
										<button
											className="btn btn-primary mt-4"
											onClick={() => {
												doModalDialog({
													title: t('Double-check Values'),
													message: t('Are you sure the values you have entered are correct?'),
													onAccept: () => {
														this.runMigration()
													},
												})
											}}
										>
											<FontAwesomeIcon icon={faClipboardCheck} className="me-2" />
											<span>{t('Run Migration Procedure')}</span>
										</button>
									</div>
								)}

								{this.state.warnings.length ? (
									<div>
										<h2 className="my-4">{t('Warnings During Migration')}</h2>
										<ul>
											{_.map(this.state.warnings, (warning, key) => {
												return <li key={key}>{warning}</li>
											})}
										</ul>
									</div>
								) : null}

								{this.state.haveRunMigration && !this.state.migrationCompleted ? (
									<div>
										<div>
											<div>{t('Please check the database related to the warnings above. If neccessary, you can')}</div>
											<Button
												variant="outline-secondary"
												className="my-4"
												onClick={() => {
													doModalDialog({
														title: t('Force Migration'),
														message: t(
															'Are you sure you want to force the migration? This will bypass the migration checks, so be sure to verify that the values in the settings are correct!'
														),
														onAccept: () => {
															this.forceMigration()
														},
													})
												}}
											>
												<FontAwesomeIcon icon={faDatabase} className="me-2" />
												<span>{t('Force Migration (unsafe)')}</span>
											</Button>
										</div>
									</div>
								) : null}
							</div>
						) : null}

						{this.state.migrationCompleted ? <div>{t('The migration was completed successfully!')}</div> : null}

						{!this.state.migrationNeeded ? (
							<div>
								{t('All is well, go get a')}&nbsp;
								<FontAwesomeIcon icon={faCoffee} />
							</div>
						) : null}
					</div>

					<UpgradesView />
				</div>
			)
		}
	}
)
