import { stringifyError } from '@sofie-automation/server-core-integration'
import { DevicesRegistry } from 'timeline-state-resolver'
import type * as Winston from 'winston'

export const TSRDeviceRegistry = new DevicesRegistry()

/**
 * Load TSR plugins from the paths specified in the TSR_PLUGIN_PATHS environment variable.
 */
export async function loadTSRPlugins(logger: Winston.Logger): Promise<void> {
	const paths = process.env.TSR_PLUGIN_PATHS
	if (!paths) {
		logger.debug('No TSR_PLUGIN_PATHS set, skipping loading of plugins')
		return
	}

	const pathsArray = paths.split(';').filter((p) => !!p)
	logger.info(`Loading TSR plugins from ${pathsArray.length} paths`)

	for (const pluginPath of pathsArray) {
		try {
			const deviceTypes = await TSRDeviceRegistry.loadDeviceIntegrationsFromPath(pluginPath)

			logger.info(`Loaded TSR plugins from path "${pluginPath}": ${deviceTypes.join(', ')}`)
		} catch (e) {
			logger.error(`Failed to load TSR plugins from "${pluginPath}": ${stringifyError(e)}`)
		}
	}
}
