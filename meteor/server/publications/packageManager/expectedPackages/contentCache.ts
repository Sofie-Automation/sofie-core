import { ReactiveCacheCollection } from '../../lib/ReactiveCacheCollection'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { ExpectedPackageDB } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'

export type RundownPlaylistCompact = Pick<
	DBRundownPlaylist,
	'_id' | 'activationId' | 'currentPartInfo' | 'nextPartInfo'
>
export const rundownPlaylistFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<RundownPlaylistCompact>>({
	_id: 1,
	activationId: 1,
	currentPartInfo: 1, // So that it invalidates when the current changes
	nextPartInfo: 1, // So that it invalidates when the next changes
})

export type PieceInstanceCompact = Pick<PieceInstance, '_id' | 'rundownId'> & {
	piece: Pick<PieceInstancePiece, 'expectedPackages'>
}

export const pieceInstanceFieldsSpecifier = literal<MongoFieldSpecifierOnesStrict<PieceInstanceCompact>>({
	_id: 1,
	rundownId: 1,
	piece: {
		expectedPackages: 1,
	},
})

export type ExpectedPackageDBCompact = Pick<ExpectedPackageDB, '_id' | 'package'>

export const expectedPackageDBFieldsSpecifier = literal<MongoFieldSpecifierOnesStrict<ExpectedPackageDB>>({
	_id: 1,
	package: 1,
})

export interface ExpectedPackagesContentCache {
	ExpectedPackages: ReactiveCacheCollection<ExpectedPackageDBCompact>
	RundownPlaylists: ReactiveCacheCollection<RundownPlaylistCompact>
	PieceInstances: ReactiveCacheCollection<PieceInstanceCompact>
}

export function createReactiveContentCache(): ExpectedPackagesContentCache {
	const cache: ExpectedPackagesContentCache = {
		ExpectedPackages: new ReactiveCacheCollection<ExpectedPackageDBCompact>('expectedPackages'),
		RundownPlaylists: new ReactiveCacheCollection<RundownPlaylistCompact>('rundownPlaylists'),
		PieceInstances: new ReactiveCacheCollection<PieceInstanceCompact>('pieceInstances'),
	}

	return cache
}
