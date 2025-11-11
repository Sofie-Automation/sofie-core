import type { ABPlayerDefinition } from '@sofie-automation/blueprints-integration'
import type { StudioRouteSet } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { logger } from '../../logging.js'
import { ReadonlyDeep } from 'type-fest'

/**
 * Map<poolName, Map<playerId, disablePlayer>>
 * Note: this explicitly uses a string for the playerId, to avoid issues with types for values from the ui
 */
type MembersOfRouteSets = Map<string, Map<string, boolean>>

export function findPlayersInRouteSets(routeSets: ReadonlyDeep<Record<string, StudioRouteSet>>): MembersOfRouteSets {
	const routeSetEnabledPlayers: MembersOfRouteSets = new Map()
	for (const [_key, routeSet] of Object.entries<ReadonlyDeep<StudioRouteSet>>(routeSets)) {
		for (const abPlayer of routeSet.abPlayers) {
			let poolEntry = routeSetEnabledPlayers.get(abPlayer.poolName)
			if (!poolEntry) {
				poolEntry = new Map()
				routeSetEnabledPlayers.set(abPlayer.poolName, poolEntry)
			}

			// Make sure player is marked as enabled
			const currentState = poolEntry.get(String(abPlayer.playerId))
			poolEntry.set(String(abPlayer.playerId), currentState || routeSet.active)
		}
	}
	return routeSetEnabledPlayers
}

export function abPoolFilterDisabled(
	poolName: string,
	players: ABPlayerDefinition[],
	membersOfRouteSets: MembersOfRouteSets
): ABPlayerDefinition[] {
	const poolRouteSetEnabledPlayers = membersOfRouteSets.get(poolName)
	if (!poolRouteSetEnabledPlayers || poolRouteSetEnabledPlayers.size == 0) return players

	// Filter out any disabled players:
	return players.filter((player) => {
		const playerState = poolRouteSetEnabledPlayers.get(String(player.playerId))
		if (playerState === false) {
			logger.silly(`AB Pool ${poolName} playerId : ${player.playerId} are disabled`)
			return false
		}

		return true
	})
}
