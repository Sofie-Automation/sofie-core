import { RelevantSystemVersions } from '../coreSystem'

describe('coreSystem', () => {
	test('RelevantSystemVersions', async () => {
		const versions = await RelevantSystemVersions

		expect(versions).toEqual({
			core: expect.stringMatching(/^(\d+)\.(\d+)\.(\d+)/),
			'@mos-connection/helper': expect.stringMatching(/^(\d+)\.(\d+)\.(\d+)/),
			'superfly-timeline': expect.stringMatching(/^(\d+)\.(\d+)\.(\d+)/),
			'timeline-state-resolver-types': expect.stringMatching(/^(\d+)\.(\d+)\.(\d+)/),
		})
	})
})
