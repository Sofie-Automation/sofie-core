import { literal, getRandomId } from '../lib/tempLib'
import { getCurrentTime } from '../lib/lib'
import { MethodContextAPI, MethodContext } from './methodContext'
import { NewOrganizationAPI, OrganizationAPIMethods } from '@sofie-automation/meteor-lib/dist/api/organization'
import { registerClassToMeteorMethods } from '../methods'
import { DBOrganization, DBOrganizationBase } from '@sofie-automation/meteor-lib/dist/collections/Organization'
import { insertStudioInner } from './studio/api'
import { insertShowStyleBaseInner } from './showStyles'
import { BlueprintId, OrganizationId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Blueprints, CoreSystem, Organizations, ShowStyleBases, Studios } from '../collections'
import { getCoreSystemAsync } from '../coreSystem/collection'
import { UserPermissions } from '@sofie-automation/meteor-lib/dist/userPermissions'
import { assertConnectionHasOneOfPermissions } from '../security/auth'
import { BlueprintManifestType } from '@sofie-automation/blueprints-integration'

const PERMISSIONS_FOR_MANAGE_ORGANIZATIONS: Array<keyof UserPermissions> = ['configure']

async function createDefaultEnvironmentForOrg(orgId: OrganizationId) {
	let systemBlueprintId: BlueprintId | undefined
	let studioBlueprintId: BlueprintId | undefined
	let showStyleBlueprintId: BlueprintId | undefined

	const studioId = await insertStudioInner(orgId)
	const showStyleId = await insertShowStyleBaseInner(orgId)

	const core = await getCoreSystemAsync()
	const blueprints = await Blueprints.findFetchAsync({})
	for (const blueprint of blueprints) {
		if (blueprint.blueprintType === BlueprintManifestType.SYSTEM) systemBlueprintId = blueprint._id
		if (blueprint.blueprintType === BlueprintManifestType.STUDIO) studioBlueprintId = blueprint._id
		if (blueprint.blueprintType === BlueprintManifestType.SHOWSTYLE) showStyleBlueprintId = blueprint._id
	}

	if (systemBlueprintId && core) await CoreSystem.updateAsync(core._id, { $set: { blueprintId: systemBlueprintId } })
	if (studioBlueprintId)
		await Studios.updateAsync(studioId, {
			$set: {
				blueprintId: studioBlueprintId,
			},
			$push: {
				supportedShowStyleBase: showStyleId,
			},
		})
	if (showStyleId && showStyleBlueprintId)
		await ShowStyleBases.updateAsync(showStyleId, { $set: { blueprintId: showStyleBlueprintId } })
}

export async function createOrganization(
	context: MethodContext,
	organization: DBOrganizationBase
): Promise<OrganizationId> {
	assertConnectionHasOneOfPermissions(context.connection, ...PERMISSIONS_FOR_MANAGE_ORGANIZATIONS)

	const orgId = await Organizations.insertAsync(
		literal<DBOrganization>({
			...organization,
			_id: getRandomId(),
			userRoles: {},
			created: getCurrentTime(),
			modified: getCurrentTime(),
		})
	)
	// Setup default environment for the organization:
	await createDefaultEnvironmentForOrg(orgId)
	return orgId
}

async function removeOrganization(context: MethodContext, organizationId: OrganizationId) {
	assertConnectionHasOneOfPermissions(context.connection, ...PERMISSIONS_FOR_MANAGE_ORGANIZATIONS)

	await Organizations.removeAsync(organizationId)
}

class ServerOrganizationAPI extends MethodContextAPI implements NewOrganizationAPI {
	async removeOrganization(organizationId: OrganizationId) {
		return removeOrganization(this, organizationId)
	}
}

registerClassToMeteorMethods(OrganizationAPIMethods, ServerOrganizationAPI, false)
