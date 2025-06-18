import { IStudioContext, BlueprintMappings } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ProcessedStudioConfig } from '../config'
import { getStudioConfigRef } from '../configRefs'
import { CommonContext, ContextInfo } from './CommonContext'
import { JobStudio } from '../../jobs'

/** Studio */

export class StudioContext extends CommonContext implements IStudioContext {
	constructor(
		contextInfo: ContextInfo,
		public readonly studio: ReadonlyDeep<JobStudio>,
		public readonly studioBlueprintConfig: ProcessedStudioConfig
	) {
		super(contextInfo)
	}

	public get studioId(): string {
		return unprotectString(this.studio._id)
	}

	public get studioIdProtected(): StudioId {
		return this.studio._id
	}

	getStudioConfig(): unknown {
		return this.studioBlueprintConfig
	}
	getStudioConfigRef(configKey: string): string {
		return getStudioConfigRef(this.studio._id, configKey)
	}
	getStudioMappings(): Readonly<BlueprintMappings> {
		const mappings = this.studio.mappings
		// @ts-expect-error ProtectedString deviceId not compatible with string
		return mappings
	}
}
