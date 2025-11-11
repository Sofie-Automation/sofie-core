import { NoteSeverity, IRundownUserContext } from '@sofie-automation/blueprints-integration'
import { INoteBase } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { RundownContext } from './RundownContext.js'

export class RundownUserContext extends RundownContext implements IRundownUserContext {
	public readonly notes: INoteBase[] = []

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
