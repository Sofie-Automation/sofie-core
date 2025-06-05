import { IStudioUserContext, NoteSeverity } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { ProcessedStudioConfig } from '../config'
import { INoteBase } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { ContextInfo } from './CommonContext'
import { StudioContext } from './StudioContext'
import { JobStudio } from '../../jobs'

export class StudioUserContext extends StudioContext implements IStudioUserContext {
	public readonly notes: INoteBase[] = []

	constructor(
		contextInfo: ContextInfo,
		studio: ReadonlyDeep<JobStudio>,
		studioBlueprintConfig: ProcessedStudioConfig
	) {
		super(contextInfo, studio, studioBlueprintConfig)
	}

	notifyUserError(message: string, params?: { [key: string]: any }): void {
		this.addNote(NoteSeverity.ERROR, message, params)
	}
	notifyUserWarning(message: string, params?: { [key: string]: any }): void {
		this.addNote(NoteSeverity.WARNING, message, params)
	}

	notifyUserInfo(message: string, params?: { [key: string]: any }): void {
		this.addNote(NoteSeverity.INFO, message, params)
	}
	private addNote(type: NoteSeverity, message: string, params?: { [key: string]: any }) {
		this.notes.push({
			type: type,
			message: {
				key: message,
				args: params,
			},
		})
	}
}
