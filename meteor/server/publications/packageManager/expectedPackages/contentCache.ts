import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { ExpectedPackageDB } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'

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

export type PieceInstanceCompact = Pick<
	PieceInstance,
	'_id' | 'rundownId' | 'partInstanceId' | 'neededExpectedPackageIds'
>

export const pieceInstanceFieldsSpecifier = literal<MongoFieldSpecifierOnesStrict<PieceInstanceCompact>>({
	_id: 1,
	rundownId: 1,
	partInstanceId: 1,
	neededExpectedPackageIds: 1,
})

export type ExpectedPackageDBCompact = Pick<ExpectedPackageDB, '_id' | 'rundownId' | 'package'>

export const expectedPackageDBFieldsSpecifier = literal<MongoFieldSpecifierOnesStrict<ExpectedPackageDB>>({
	_id: 1,
	rundownId: 1,
	package: 1,
})

export interface ExpectedPackagesContentCache {
	ExpectedPackages: InMemoryMongoCollection<ExpectedPackageDBCompact>
	RundownPlaylists: InMemoryMongoCollection<RundownPlaylistCompact>
	PieceInstances: InMemoryMongoCollection<PieceInstanceCompact>
}

export function createReactiveContentCache(): ExpectedPackagesContentCache {
	const cache: ExpectedPackagesContentCache = {
		ExpectedPackages: new InMemoryMongoCollection<ExpectedPackageDBCompact>('expectedPackages'),
		RundownPlaylists: new InMemoryMongoCollection<RundownPlaylistCompact>('rundownPlaylists'),
		PieceInstances: new InMemoryMongoCollection<PieceInstanceCompact>('pieceInstances'),
	}

	return cache
}
