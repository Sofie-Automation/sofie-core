import { StatusCode } from '@sofie-automation/blueprints-integration'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { Component } from '@sofie-automation/meteor-lib/dist/api/systemStatus'
import { status2ExternalStatus } from './systemStatus'
import { getServerBlueprintUpgradeStatuses } from '../publications/blueprintUpgradeStatus/systemStatus'

export async function getUpgradeSystemStatusMessages(): Promise<Component[]> {
	const result: Component[] = []

	const upgradeStatus = await getServerBlueprintUpgradeStatuses()
	for (const statusDocument of upgradeStatus) {
		let status = StatusCode.GOOD
		const messages: string[] = []
		if (statusDocument.invalidReason) {
			status = StatusCode.WARNING_MAJOR
			messages.push('Invalid configuration')
		} else if (statusDocument.changes.length) {
			status = StatusCode.WARNING_MINOR
			messages.push('Configuration changed')
		}

		result.push(
			literal<Component>({
				name: `blueprints-upgrade-${statusDocument._id}`,
				status: status2ExternalStatus(status),
				updated: new Date().toISOString(),
				_status: status,
				_internal: {
					statusCodeString: StatusCode[status],
					messages: messages,
					versions: {},
				},
			})
		)
	}

	return result
}
