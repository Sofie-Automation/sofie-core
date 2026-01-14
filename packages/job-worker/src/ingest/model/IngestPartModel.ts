import { ReadonlyDeep } from 'type-fest'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { ExpectedPlayoutItemRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { IngestExpectedPackage } from './IngestExpectedPackage.js'

export interface IngestPartModelReadonly {
	/**
	 * The Part properties
	 */
	readonly part: ReadonlyDeep<DBPart>

	/**
	 * The Pieces belonging to this Part
	 */
	readonly pieces: ReadonlyDeep<Piece>[]
	/**
	 * The AdLib Pieces belonging to this Part
	 */
	readonly adLibPieces: ReadonlyDeep<AdLibPiece>[]
	/**
	 * The AdLib Actions belonging to this Part
	 */
	readonly adLibActions: ReadonlyDeep<AdLibAction>[]

	/**
	 * The ExpectedPlayoutItems belonging to this Part
	 */
	readonly expectedPlayoutItems: ReadonlyDeep<ExpectedPlayoutItemRundown>[]
	/**
	 * The ExpectedPackages belonging to this Part
	 */
	readonly expectedPackages: ReadonlyDeep<IngestExpectedPackage>[]
}
/**
 * Wrap a Part and its contents in a view for Ingest operations
 */
export interface IngestPartModel extends IngestPartModelReadonly {
	/**
	 * Mark this Part as being invalid
	 * @param invalid New invalid state
	 */
	setInvalid(invalid: boolean): void

	/**
	 * Set the ExpectedPlayoutItems for the contents of this Part
	 * @param expectedPlayoutItems The new ExpectedPlayoutItems
	 */
	setExpectedPlayoutItems(expectedPlayoutItems: ExpectedPlayoutItemRundown[]): void
}
