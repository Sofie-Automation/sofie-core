import {
	IBlueprintDefaultCoreSystemTriggers,
	ICommonContext,
	NoteSeverity,
} from '@sofie-automation/blueprints-integration'
import { assertNever, clone, getHash } from '@sofie-automation/corelib/dist/lib'
import { logger } from '../../logging'
import { ICoreSystemApplyConfigContext } from '@sofie-automation/blueprints-integration/dist/context/systemApplyConfigContext'
import { DEFAULT_CORE_TRIGGERS } from './defaultSystemActionTriggers'

/**
 * This is almost identical to the one in the job-worker, but it is hard to share the implementation due to differing loggers
 */
export class CommonContext implements ICommonContext {
	private readonly _contextIdentifier: string
	private readonly _contextName: string

	private hashI = 0
	private hashed: { [hash: string]: string } = {}

	constructor(name: string, identifier: string) {
		this._contextIdentifier = identifier
		this._contextName = name
	}
	getHashId(str: string, isNotUnique?: boolean): string {
		if (!str) str = 'hash' + this.hashI++

		if (isNotUnique) {
			str = str + '_' + this.hashI++
		}

		const id = getHash(this._contextIdentifier + '_' + str.toString())
		this.hashed[id] = str
		return id
	}
	unhashId(hash: string): string {
		return this.hashed[hash] || hash
	}

	logDebug(message: string): void {
		logger.debug(`"${this._contextName}": "${message}"\n(${this._contextIdentifier})`)
	}
	logInfo(message: string): void {
		logger.info(`"${this._contextName}": "${message}"\n(${this._contextIdentifier})`)
	}
	logWarning(message: string): void {
		logger.warn(`"${this._contextName}": "${message}"\n(${this._contextIdentifier})`)
	}
	logError(message: string): void {
		logger.error(`"${this._contextName}": "${message}"\n(${this._contextIdentifier})`)
	}
	protected logNote(message: string, type: NoteSeverity): void {
		if (type === NoteSeverity.ERROR) {
			this.logError(message)
		} else if (type === NoteSeverity.WARNING) {
			this.logWarning(message)
		} else if (type === NoteSeverity.INFO) {
			this.logInfo(message)
		} else {
			assertNever(type)
			this.logDebug(message)
		}
	}
}

export class CoreSystemApplyConfigContext extends CommonContext implements ICoreSystemApplyConfigContext {
	getDefaultSystemActionTriggers(): IBlueprintDefaultCoreSystemTriggers {
		return clone(DEFAULT_CORE_TRIGGERS)
	}
}
