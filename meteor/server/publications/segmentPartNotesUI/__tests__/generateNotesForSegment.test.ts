import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PartNote, SegmentNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { clone, getRandomId, literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { UISegmentPartNote } from '@sofie-automation/meteor-lib/dist/api/rundownNotifications'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { generateTranslation } from '@sofie-automation/corelib/dist/lib'
import { generateNotesForSegment } from '../generateNotesForSegment'
import { PartFields, PartInstanceFields, SegmentFields } from '../reactiveContentCache'

describe('generateNotesForSegment', () => {
	test('no notes', async () => {
		const playlistId = protectString<RundownPlaylistId>('playlist0')
		const nrcsName = 'some nrcs'
		const segment: Pick<DBSegment, SegmentFields> = {
			_id: protectString('segment0'),
			_rank: 1,
			rundownId: protectString('rundown0'),
			name: 'A segment',
			notes: [],
			orphaned: undefined,
		}

		const notes = generateNotesForSegment(playlistId, segment, nrcsName, [], [])
		expect(notes).toHaveLength(0)
	})

	test('orphaned: deleted segment', async () => {
		const playlistId = protectString<RundownPlaylistId>('playlist0')
		const nrcsName = 'some nrcs'
		const segment: Pick<DBSegment, SegmentFields> = {
			_id: protectString('segment0'),
			_rank: 1,
			rundownId: protectString('rundown0'),
			name: 'A segment',
			notes: [],
			orphaned: SegmentOrphanedReason.DELETED,
		}

		const notes = generateNotesForSegment(playlistId, segment, nrcsName, [], [])
		expect(notes).toEqual(
			literal<UISegmentPartNote[]>([
				{
					_id: protectString('segment0_segment_orphaned'),
					note: {
						message: generateTranslation('Segment no longer exists in {{nrcs}}', { nrcs: nrcsName }),
						origin: {
							name: segment.name,
							segmentId: segment._id,
							rundownId: segment.rundownId,
						},
						rank: segment._rank,
						type: NoteSeverity.WARNING,
					},
					playlistId: playlistId,
					rundownId: segment.rundownId,
					segmentId: segment._id,
				},
			])
		)
	})

	test('orphaned: hidden segment', async () => {
		const playlistId = protectString<RundownPlaylistId>('playlist0')
		const nrcsName = 'some nrcs'
		const segment: Pick<DBSegment, SegmentFields> = {
			_id: protectString('segment0'),
			_rank: 1,
			rundownId: protectString('rundown0'),
			name: 'A segment',
			notes: [],
			orphaned: SegmentOrphanedReason.HIDDEN,
		}

		const notes = generateNotesForSegment(playlistId, segment, nrcsName, [], [])
		expect(notes).toEqual(
			literal<UISegmentPartNote[]>([
				{
					_id: protectString('segment0_segment_orphaned'),
					note: {
						message: generateTranslation('Segment was hidden in {{nrcs}}', { nrcs: nrcsName }),
						origin: {
							name: segment.name,
							segmentId: segment._id,
							rundownId: segment.rundownId,
						},
						rank: segment._rank,
						type: NoteSeverity.WARNING,
					},
					playlistId: playlistId,
					rundownId: segment.rundownId,
					segmentId: segment._id,
				},
			])
		)
	})

	test('segment has notes', async () => {
		const playlistId = protectString<RundownPlaylistId>('playlist0')
		const nrcsName = 'some nrcs'

		const note1 = literal<SegmentNote>({
			type: NoteSeverity.INFO,
			message: generateTranslation('some message', { arg1: 'abc', arg2: 123 }),
			origin: {
				name: 'somewhere',
			},
		})
		const note2 = literal<SegmentNote>({
			type: NoteSeverity.ERROR,
			message: generateTranslation('a second', { arg1: 'abc', arg2: 123 }),
			origin: {
				name: 'elsewhere',
			},
		})

		const segment: Pick<DBSegment, SegmentFields> = {
			_id: protectString('segment0'),
			_rank: 1,
			rundownId: protectString('rundown0'),
			name: 'A segment',
			notes: [
				// Clone to avoid mutation issues
				clone(note1),
				clone(note2),
			],
			orphaned: undefined,
		}

		const notes = generateNotesForSegment(playlistId, segment, nrcsName, [], [])
		expect(notes).toEqual(
			literal<UISegmentPartNote[]>([
				{
					_id: protectString('segment0_segment_0'),
					note: {
						...note1,
						origin: {
							...note1.origin,
							segmentId: segment._id,
							rundownId: segment.rundownId,
						},
						rank: segment._rank,
					},
					playlistId: playlistId,
					rundownId: segment.rundownId,
					segmentId: segment._id,
				},
				{
					_id: protectString('segment0_segment_1'),
					note: {
						...note2,
						origin: {
							...note2.origin,
							segmentId: segment._id,
							rundownId: segment.rundownId,
						},
						rank: segment._rank,
					},
					playlistId: playlistId,
					rundownId: segment.rundownId,
					segmentId: segment._id,
				},
			])
		)
	})

	test('deleted partinstances', async () => {
		const playlistId = protectString<RundownPlaylistId>('playlist0')
		const nrcsName = 'some nrcs'

		const segment: Pick<DBSegment, SegmentFields> = {
			_id: protectString('segment0'),
			_rank: 1,
			rundownId: protectString('rundown0'),
			name: 'A segment',
			notes: [],
			orphaned: undefined,
		}

		const partInstances: Pick<DBPartInstance, PartInstanceFields>[] = [
			{
				_id: getRandomId(),
				segmentId: segment._id,
				rundownId: segment.rundownId,
				orphaned: 'deleted',
				reset: false,
				part: {
					title: 'one',
				} as any,
			},
			{
				_id: getRandomId(),
				segmentId: segment._id,
				rundownId: segment.rundownId,
				orphaned: 'deleted',
				reset: false,
				part: {
					title: 'two',
				} as any,
			},
			{
				_id: getRandomId(),
				segmentId: segment._id,
				rundownId: segment.rundownId,
				orphaned: undefined,
				reset: false,
				part: {
					title: 'not orphaned',
				} as any,
			},
			{
				_id: getRandomId(),
				segmentId: segment._id,
				rundownId: segment.rundownId,
				orphaned: 'adlib-part',
				reset: false,
				part: {
					title: 'wrong orphaned',
				} as any,
			},
			{
				_id: getRandomId(),
				segmentId: segment._id,
				rundownId: segment.rundownId,
				orphaned: 'deleted',
				reset: true,
				part: {
					title: 'reset',
				} as any,
			},
		]

		const notes = generateNotesForSegment(playlistId, segment, nrcsName, [], partInstances)
		expect(notes).toEqual(
			literal<UISegmentPartNote[]>([
				{
					_id: protectString('segment0_partinstances_deleted'),
					note: {
						type: NoteSeverity.WARNING,
						message: generateTranslation('The following parts no longer exist in {{nrcs}}: {{partNames}}', {
							nrcs: nrcsName,
							partNames: ['one', 'two'].join(', '),
						}),
						rank: segment._rank,
						origin: {
							segmentId: segment._id,
							rundownId: segment.rundownId,
							name: segment.name,
						},
					},
					playlistId: playlistId,
					rundownId: segment.rundownId,
					segmentId: segment._id,
				},
			])
		)
	})

	test('deleted partinstances with orphaned segment', async () => {
		const playlistId = protectString<RundownPlaylistId>('playlist0')
		const nrcsName = 'some nrcs'

		const segment: Pick<DBSegment, SegmentFields> = {
			_id: protectString('segment0'),
			_rank: 1,
			rundownId: protectString('rundown0'),
			name: 'A segment',
			notes: [],
			orphaned: SegmentOrphanedReason.DELETED,
		}

		const partInstances: Pick<DBPartInstance, PartInstanceFields>[] = [
			{
				_id: getRandomId(),
				segmentId: segment._id,
				rundownId: segment.rundownId,
				orphaned: 'deleted',
				reset: false,
				part: {
					title: 'one',
				} as any,
			},
		]

		const notes = generateNotesForSegment(playlistId, segment, nrcsName, [], partInstances)
		expect(notes).toHaveLength(1)
		expect(notes[0]._id).toBe('segment0_segment_orphaned')
	})

	test('good part has no notes', async () => {
		const playlistId = protectString<RundownPlaylistId>('playlist0')
		const nrcsName = 'some nrcs'

		const segment: Pick<DBSegment, SegmentFields> = {
			_id: protectString('segment0'),
			_rank: 1,
			rundownId: protectString('rundown0'),
			name: 'A segment',
			notes: [],
			orphaned: undefined,
		}

		const parts: Pick<DBPart, PartFields>[] = [
			{
				_id: getRandomId(),
				_rank: 6,
				segmentId: segment._id,
				rundownId: segment.rundownId,
				notes: [],
				title: 'one',
				invalid: false,
				invalidReason: undefined,
			},
		]

		const notes = generateNotesForSegment(playlistId, segment, nrcsName, parts, [])
		expect(notes).toHaveLength(0)
	})

	test('part is invalid, with no reason', async () => {
		const playlistId = protectString<RundownPlaylistId>('playlist0')
		const nrcsName = 'some nrcs'

		const segment: Pick<DBSegment, SegmentFields> = {
			_id: protectString('segment0'),
			_rank: 1,
			rundownId: protectString('rundown0'),
			name: 'A segment',
			notes: [],
			orphaned: undefined,
		}

		const parts: Pick<DBPart, PartFields>[] = [
			{
				_id: getRandomId(),
				_rank: 6,
				segmentId: segment._id,
				rundownId: segment.rundownId,
				notes: [],
				title: 'one',
				invalid: true,
				invalidReason: undefined,
			},
		]

		const notes = generateNotesForSegment(playlistId, segment, nrcsName, parts, [])
		expect(notes).toHaveLength(0)
	})

	test('part is invalid, with a reason', async () => {
		const playlistId = protectString<RundownPlaylistId>('playlist0')
		const nrcsName = 'some nrcs'

		const segment: Pick<DBSegment, SegmentFields> = {
			_id: protectString('segment0'),
			_rank: 1,
			rundownId: protectString('rundown0'),
			name: 'A segment',
			notes: [],
			orphaned: undefined,
		}

		const part0: Pick<DBPart, PartFields> = {
			_id: protectString('part0'),
			_rank: 6,
			segmentId: segment._id,
			rundownId: segment.rundownId,
			notes: [],
			title: 'one',
			invalid: true,
			invalidReason: {
				message: generateTranslation('some reason'),
				severity: NoteSeverity.INFO,
			},
		}

		const notes = generateNotesForSegment(playlistId, segment, nrcsName, [part0], [])
		expect(notes).toEqual(
			literal<UISegmentPartNote[]>([
				{
					_id: protectString('segment0_part_part0_invalid'),
					note: {
						type: NoteSeverity.INFO,
						message: generateTranslation('some reason'),
						rank: segment._rank,
						origin: {
							segmentId: segment._id,
							rundownId: segment.rundownId,
							name: part0.title,
							partId: part0._id,
							segmentName: segment.name,
						},
					},
					playlistId: playlistId,
					rundownId: segment.rundownId,
					segmentId: segment._id,
				},
			])
		)
	})

	test('part has notes', async () => {
		const playlistId = protectString<RundownPlaylistId>('playlist0')
		const nrcsName = 'some nrcs'

		const segment: Pick<DBSegment, SegmentFields> = {
			_id: protectString('segment0'),
			_rank: 1,
			rundownId: protectString('rundown0'),
			name: 'A segment',
			notes: [],
			orphaned: undefined,
		}

		const note1 = literal<PartNote>({
			type: NoteSeverity.INFO,
			message: generateTranslation('some message', { arg1: 'abc', arg2: 123 }),
			origin: {
				name: 'somewhere',
			},
		})
		const note2 = literal<PartNote>({
			type: NoteSeverity.ERROR,
			message: generateTranslation('a second', { arg1: 'abc', arg2: 123 }),
			origin: {
				name: 'elsewhere',
			},
		})

		const part0: Pick<DBPart, PartFields> = {
			_id: protectString('part0'),
			_rank: 6,
			segmentId: segment._id,
			rundownId: segment.rundownId,
			notes: [
				// Clone to avoid mutation issues
				clone(note1),
				clone(note2),
			],
			title: 'one',
			invalid: false,
			invalidReason: undefined,
		}

		const notes = generateNotesForSegment(playlistId, segment, nrcsName, [part0], [])
		expect(notes).toEqual(
			literal<UISegmentPartNote[]>([
				{
					_id: protectString('segment0_part_part0_0'),
					note: {
						...note1,
						rank: segment._rank,
						origin: {
							...note1.origin,
							segmentId: segment._id,
							rundownId: segment.rundownId,
							partId: part0._id,
							segmentName: segment.name,
						},
					},
					playlistId: playlistId,
					rundownId: segment.rundownId,
					segmentId: segment._id,
				},
				{
					_id: protectString('segment0_part_part0_1'),
					note: {
						...note2,
						rank: segment._rank,
						origin: {
							...note2.origin,
							segmentId: segment._id,
							rundownId: segment.rundownId,
							partId: part0._id,
							segmentName: segment.name,
						},
					},
					playlistId: playlistId,
					rundownId: segment.rundownId,
					segmentId: segment._id,
				},
			])
		)
	})
})
