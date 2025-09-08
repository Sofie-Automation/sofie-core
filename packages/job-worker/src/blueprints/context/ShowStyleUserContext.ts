import { PackageInfo, IShowStyleUserContext, NoteSeverity } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { WatchedPackagesHelper } from './watchedPackages.js'
import { INoteBase } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs/index.js'
import { ContextInfo } from './CommonContext.js'
import { ShowStyleContext } from './ShowStyleContext.js'
import { getMediaObjectDuration } from './lib.js'

export class ShowStyleUserContext extends ShowStyleContext implements IShowStyleUserContext {
	public readonly notes: INoteBase[] = []

	protected readonly jobContext: JobContext

	constructor(
		contextInfo: ContextInfo,
		context: JobContext,
		showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>,
		private readonly watchedPackages: WatchedPackagesHelper
	) {
		super(
			contextInfo,
			context.studio,
			context.getStudioBlueprintConfig(),
			showStyleCompound,
			context.getShowStyleBlueprintConfig(showStyleCompound)
		)
		this.jobContext = context
	}

	notifyUserError(message: string, params?: { [key: string]: any }): void {
		this.notes.push({
			type: NoteSeverity.ERROR,
			message: {
				key: message,
				args: params,
			},
		})
	}
	notifyUserWarning(message: string, params?: { [key: string]: any }): void {
		this.notes.push({
			type: NoteSeverity.WARNING,
			message: {
				key: message,
				args: params,
			},
		})
	}

	notifyUserInfo(message: string, params?: { [key: string]: any }): void {
		this.notes.push({
			type: NoteSeverity.INFO,
			message: {
				key: message,
				args: params,
			},
		})
	}

	getPackageInfo(packageId: string): Readonly<Array<PackageInfo.Any>> {
		return this.watchedPackages.getPackageInfo(packageId)
	}

	async hackGetMediaObjectDuration(mediaId: string): Promise<number | undefined> {
		return getMediaObjectDuration(this.jobContext, mediaId)
	}
}
