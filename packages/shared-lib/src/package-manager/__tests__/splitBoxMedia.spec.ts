import { SourceLayerType } from '../../core/model/ShowStyle.js'
import { ExpectedPackage } from '../package.js'
import {
	buildPublishedBoxPreviews,
	findExpectedPackageForMediaId,
	getMediaIdFromSplitBox,
	normalizeSplitBoxMediaId,
} from '../splitBoxMedia.js'

describe('splitBoxMedia', () => {
	test('normalizeSplitBoxMediaId', () => {
		expect(normalizeSplitBoxMediaId('clips/head3_Snow.mp4')).toEqual('CLIPS/HEAD3_SNOW.MP4')
	})

	test('getMediaIdFromSplitBox', () => {
		expect(
			getMediaIdFromSplitBox({
				type: SourceLayerType.VT,
				fileName: 'clips/foo.mp4',
			})
		).toEqual('CLIPS/FOO.MP4')
		expect(
			getMediaIdFromSplitBox({
				type: SourceLayerType.CAMERA,
				fileName: 'ignored',
			})
		).toBeUndefined()
	})

	test('findExpectedPackageForMediaId case insensitive', () => {
		const pkg: ExpectedPackage.ExpectedPackageMediaFile = {
			_id: 'p1',
			type: ExpectedPackage.PackageType.MEDIA_FILE,
			layers: [],
			content: { filePath: 'CLIPS/FOO.MP4' },
			version: {},
			contentVersionHash: 'hash_p1',
			sources: [],
			sideEffect: {},
		}
		expect(findExpectedPackageForMediaId([pkg], 'clips/foo.mp4')).toBe(pkg)
	})

	test('buildPublishedBoxPreviews index aligned', () => {
		const previews = buildPublishedBoxPreviews(
			[
				{ type: SourceLayerType.CAMERA },
				{ type: SourceLayerType.VT, fileName: 'a.mp4' },
				{ type: SourceLayerType.VT, fileName: 'b.mp4' },
			],
			new Map([
				['A.MP4', { thumbnailUrl: '/thumb-a' }],
				['B.MP4', { thumbnailUrl: '/thumb-b' }],
			])
		)
		expect(previews).toHaveLength(3)
		expect(previews[0]).toEqual({})
		expect(previews[1]).toEqual({ thumbnailUrl: '/thumb-a' })
		expect(previews[2]).toEqual({ thumbnailUrl: '/thumb-b' })
	})
})
