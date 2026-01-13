import {
	DeviceConfigManifest,
	JSONBlob,
	JSONBlobStringify,
	JSONSchema,
	SubdeviceManifest,
} from '@sofie-automation/server-core-integration'
import type { TSRDevicesManifestEntry } from 'timeline-state-resolver'
import { TSRDeviceRegistry } from './tsrDeviceRegistry.js'

import ConfigSchema = require('./$schemas/options.json')

export function compilePlayoutGatewayConfigManifest(): DeviceConfigManifest {
	const tsrManifest = TSRDeviceRegistry.manifest

	const subdeviceManifest: SubdeviceManifest = Object.fromEntries(
		Object.entries<TSRDevicesManifestEntry>(tsrManifest.subdevices).map(([id, dev]) => {
			return [
				id,
				{
					displayName: dev.displayName,
					configSchema: stringToJsonBlob(dev.configSchema),
					playoutMappings: Object.fromEntries<JSONBlob<JSONSchema>>(
						Object.entries<string>(dev.mappingsSchemas).map(([id, str]) => [id, stringToJsonBlob(str)])
					),
					actions: dev.actions?.map((action) => ({
						...action,
						payload: action.payload ? stringToJsonBlob(action.payload) : undefined,
					})),
				},
			]
		})
	)

	return {
		deviceConfigSchema: JSONBlobStringify<JSONSchema>(ConfigSchema as any),

		subdeviceConfigSchema: stringToJsonBlob(tsrManifest.commonOptions),
		subdeviceManifest,

		translations: TSRDeviceRegistry.translations,
	}
}

function stringToJsonBlob(str: string): JSONBlob<JSONSchema> {
	return str as unknown as JSONBlob<JSONSchema>
}
