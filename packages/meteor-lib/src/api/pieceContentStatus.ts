import { PackageInfo } from '@sofie-automation/blueprints-integration'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { ITranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'

export interface PieceContentStatusObj {
	status: PieceStatusCode
	messages: ITranslatableMessage[]

	freezes: Array<PackageInfo.Anomaly>
	blacks: Array<PackageInfo.Anomaly>
	scenes: Array<number>

	thumbnailUrl: string | undefined
	previewUrl: string | undefined

	packageName: string | null

	contentDuration: number | undefined

	progress: number | undefined
}
