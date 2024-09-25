import { IngestRundown } from '@sofie-automation/blueprints-integration'

export type HttpIngestRundown = IngestRundown & {
	resyncUrl: string
}
