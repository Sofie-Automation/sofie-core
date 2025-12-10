import { useTranslation } from 'react-i18next'
import { Spinner } from '../../../lib/Spinner.js'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { useSubscription, useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData.js'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { UIBlueprintUpgradeStatuses } from '../../Collections.js'
import { UIBlueprintUpgradeStatus } from '@sofie-automation/meteor-lib/dist/api/upgradeStatus'
import { getUpgradeStatusMessage, SystemUpgradeStatusButtons, UpgradeStatusButtons } from './Components.js'

export function UpgradesView(): JSX.Element {
	const { t } = useTranslation()

	const isReady = useSubscription(MeteorPubSub.uiBlueprintUpgradeStatuses)

	const statuses = useTracker(() => UIBlueprintUpgradeStatuses.find().fetch(), [])

	return (
		<div>
			<h2 className="my-4">{t('Apply blueprint upgrades')}</h2>

			<div>
				{(!isReady || !statuses) && <Spinner />}

				<table className="table">
					<thead>
						<tr>
							<th>Name</th>
							<th>&nbsp;</th>
							<th>&nbsp;</th>
						</tr>
					</thead>
					<tbody>
						{isReady && statuses && statuses.length === 0 && (
							<tr>
								<td colSpan={3}>No Studios or ShowStyles were found</td>
							</tr>
						)}

						{statuses?.map(
							(document) =>
								document.documentType === 'coreSystem' && (
									<ShowUpgradesRow
										key={unprotectString(document.documentId)}
										resourceName={t('System')}
										upgradeResult={document}
									/>
								)
						)}

						{statuses?.map(
							(document) =>
								document.documentType === 'studio' && (
									<ShowUpgradesRow
										key={unprotectString(document.documentId)}
										resourceName={t('Studio')}
										upgradeResult={document}
									/>
								)
						)}

						{statuses?.map(
							(document) =>
								document.documentType === 'showStyle' && (
									<ShowUpgradesRow
										key={unprotectString(document.documentId)}
										resourceName={t('Show Style')}
										upgradeResult={document}
									/>
								)
						)}
					</tbody>
				</table>
			</div>
		</div>
	)
}

interface ShowUpgradesRowProps {
	resourceName: string
	upgradeResult: UIBlueprintUpgradeStatus
}
function ShowUpgradesRow({ resourceName, upgradeResult }: Readonly<ShowUpgradesRowProps>) {
	const { t } = useTranslation()

	return (
		<tr>
			<td>
				{resourceName}:{upgradeResult.name}
			</td>

			<td>{getUpgradeStatusMessage(t, upgradeResult)}</td>

			<td>
				{upgradeResult.documentType === 'coreSystem' ? (
					<SystemUpgradeStatusButtons upgradeResult={upgradeResult} />
				) : (
					<UpgradeStatusButtons upgradeResult={upgradeResult} />
				)}
			</td>
		</tr>
	)
}
