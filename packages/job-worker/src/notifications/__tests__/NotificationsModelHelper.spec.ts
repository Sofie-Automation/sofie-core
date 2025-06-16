import {
	DBNotificationObj,
	DBNotificationTarget,
	DBNotificationTargetType,
} from '@sofie-automation/corelib/dist/dataModel/Notifications'
import { setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import { NotificationsModelHelper } from '../NotificationsModelHelper.js'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import { INotificationWithTarget } from '../NotificationsModel.js'
import { generateTranslation } from '@sofie-automation/corelib/dist/lib'

describe('NotificationsModelHelper', () => {
	it('no changes has no mongo write', async () => {
		const context = setupDefaultJobEnvironment()
		const notificationsCollection = context.mockCollections.Notifications

		const helper = new NotificationsModelHelper(context, 'test', null)
		expect(notificationsCollection.operations).toHaveLength(0)

		await helper.saveAllToDatabase()
		expect(notificationsCollection.operations).toHaveLength(0)
	})

	describe('from empty', () => {
		it('do nothing', async () => {
			const context = setupDefaultJobEnvironment()
			const notificationsCollection = context.mockCollections.Notifications

			const helper = new NotificationsModelHelper(context, 'test', null)

			expect(notificationsCollection.operations).toHaveLength(0)

			await helper.saveAllToDatabase()
			expect(notificationsCollection.operations).toHaveLength(0)
		})

		it('clearNotification', async () => {
			const context = setupDefaultJobEnvironment()
			const notificationsCollection = context.mockCollections.Notifications

			const helper = new NotificationsModelHelper(context, 'test', null)

			helper.clearNotification('my-category', 'id0')

			expect(notificationsCollection.operations).toHaveLength(0)

			await helper.saveAllToDatabase()
			expect(notificationsCollection.operations).toEqual([
				{
					type: 'findFetch',
					args: [
						{
							category: 'test:my-category',
							'relatedTo.studioId': context.studioId,
						},
					],
				},
			])
		})

		it('set then clear Notification', async () => {
			const context = setupDefaultJobEnvironment()
			const notificationsCollection = context.mockCollections.Notifications

			const helper = new NotificationsModelHelper(context, 'test', protectString('playlist0'))

			helper.setNotification('my-category', {
				id: 'id0',
				message: generateTranslation('test'),
				severity: NoteSeverity.INFO,
				relatedTo: { type: 'playlist' },
			})

			helper.clearNotification('my-category', 'id0')

			expect(notificationsCollection.operations).toHaveLength(0)

			await helper.saveAllToDatabase()
			expect(notificationsCollection.operations).toEqual([
				{
					type: 'findFetch',
					args: [
						{
							category: 'test:my-category',
							'relatedTo.studioId': context.studioId,
						},
					],
				},
			])
		})

		it('getAllNotifications - empty db', async () => {
			const context = setupDefaultJobEnvironment()
			const notificationsCollection = context.mockCollections.Notifications

			const helper = new NotificationsModelHelper(context, 'test', null)

			const notifications = await helper.getAllNotifications('my-category')
			expect(notifications).toHaveLength(0)

			expect(notificationsCollection.operations).toEqual([
				{
					type: 'findFetch',
					args: [
						{
							category: 'test:my-category',
							'relatedTo.studioId': context.studioId,
						},
					],
				},
			])

			// Save performs some cleanup
			notificationsCollection.clearOpLog()
			await helper.saveAllToDatabase()
			expect(notificationsCollection.operations).toHaveLength(0)
		})

		it('getAllNotifications - with documents', async () => {
			const context = setupDefaultJobEnvironment()
			const notificationsCollection = context.mockCollections.Notifications

			await notificationsCollection.insertOne({
				_id: protectString('id0'),
				category: 'test:my-category',
				relatedTo: {
					type: DBNotificationTargetType.PLAYLIST,
					studioId: context.studioId,
					playlistId: protectString('test'),
				},
				created: 1,
				modified: 2,
				message: generateTranslation('test'),
				severity: NoteSeverity.INFO,
				localId: 'abc',
			})
			notificationsCollection.clearOpLog()

			const helper = new NotificationsModelHelper(context, 'test', null)

			const notifications = await helper.getAllNotifications('my-category')
			expect(notifications).toEqual([
				{
					id: 'abc',
					message: generateTranslation('test'),
					severity: NoteSeverity.INFO,
					relatedTo: { type: 'playlist' },
				} satisfies INotificationWithTarget,
			])

			expect(notificationsCollection.operations).toEqual([
				{
					type: 'findFetch',
					args: [
						{
							category: 'test:my-category',
							'relatedTo.studioId': context.studioId,
						},
					],
				},
			])

			// Save performs some cleanup
			notificationsCollection.clearOpLog()
			await helper.saveAllToDatabase()
			expect(notificationsCollection.operations).toHaveLength(0)
		})

		it('setNotification', async () => {
			const context = setupDefaultJobEnvironment()
			const notificationsCollection = context.mockCollections.Notifications

			const helper = new NotificationsModelHelper(context, 'test', protectString('playlist0'))

			helper.setNotification('my-category', {
				id: 'abc',
				message: generateTranslation('test'),
				severity: NoteSeverity.INFO,
				relatedTo: { type: 'playlist' },
			})

			expect(notificationsCollection.operations).toHaveLength(0)

			await helper.saveAllToDatabase()
			expect(notificationsCollection.operations).toEqual([
				{
					type: 'findFetch',
					args: [
						{
							category: 'test:my-category',
							'relatedTo.studioId': context.studioId,
						},
					],
				},
				{
					type: 'bulkWrite',
					args: [1],
				},
				{
					type: 'replace',
					args: ['b8ynzcdIk5RXEAkIHXShWJ26FTQ_'],
				},
			])
		})

		it('clearAllNotifications', async () => {
			const context = setupDefaultJobEnvironment()
			const notificationsCollection = context.mockCollections.Notifications

			const helper = new NotificationsModelHelper(context, 'test', null)

			helper.clearAllNotifications('my-category')

			expect(notificationsCollection.operations).toHaveLength(0)

			await helper.saveAllToDatabase()
			expect(notificationsCollection.operations).toEqual([
				{
					type: 'findFetch',
					args: [
						{
							category: 'test:my-category',
							'relatedTo.studioId': context.studioId,
						},
					],
				},
				{
					type: 'bulkWrite',
					args: [1],
				},
				{
					type: 'remove',
					args: [
						{
							category: 'test:my-category',
							localId: { $nin: [] },
							'relatedTo.studioId': 'mockStudio0',
						},
					],
				},
			])
		})
	})

	describe('created timestamp persisted', () => {
		function runTest(runGetAllNotifications: boolean) {
			it(`loading existing: ${runGetAllNotifications}`, async () => {
				const context = setupDefaultJobEnvironment()
				const notificationsCollection = context.mockCollections.Notifications
				const playlistId = protectString('playlist0')

				const expectedNotificationId = protectString('b8ynzcdIk5RXEAkIHXShWJ26FTQ_') // Taken from a previous run

				await notificationsCollection.insertOne({
					_id: expectedNotificationId,
					category: 'test:my-category',
					created: 12345,
					localId: 'abc',
					message: {
						key: 'test2',
					},
					modified: 6789,
					relatedTo: {
						playlistId: playlistId,
						studioId: context.studioId,
						type: DBNotificationTargetType.PLAYLIST,
					},
					severity: NoteSeverity.WARNING,
				})
				notificationsCollection.clearOpLog()

				{
					const updateHelper = new NotificationsModelHelper(context, 'test', playlistId)

					if (runGetAllNotifications) {
						// eslint-disable-next-line jest/no-conditional-expect
						expect(await updateHelper.getAllNotifications('my-category')).toHaveLength(1)
					}

					updateHelper.setNotification('my-category', {
						id: 'abc',
						message: generateTranslation('test2'),
						severity: NoteSeverity.WARNING,
						relatedTo: { type: 'playlist' },
					})
					await updateHelper.saveAllToDatabase()
					expect(notificationsCollection.operations).toHaveLength(3)
					notificationsCollection.clearOpLog()
				}

				// Check what was in the db
				expect(await notificationsCollection.findFetch()).toEqual([
					{
						_id: expectedNotificationId,
						category: 'test:my-category',
						created: 12345,
						localId: 'abc',
						message: {
							key: 'test2',
						},
						modified: expect.any(Number),
						relatedTo: {
							playlistId: playlistId,
							studioId: context.studioId,
							type: DBNotificationTargetType.PLAYLIST,
						},
						severity: NoteSeverity.WARNING,
					},
				] satisfies DBNotificationObj[])
			})
		}

		runTest(true)
		runTest(false)
	})

	describe('notifications with different relatedTo', () => {
		it(`type: playlist`, async () => {
			const context = setupDefaultJobEnvironment()
			const notificationsCollection = context.mockCollections.Notifications

			const playlistId = protectString('playlist0')

			const helper = new NotificationsModelHelper(context, 'test', playlistId)

			helper.setNotification('my-category', {
				id: 'abc',
				message: generateTranslation('test'),
				severity: NoteSeverity.INFO,
				relatedTo: { type: 'playlist' },
			})

			await helper.saveAllToDatabase()

			const doc = await notificationsCollection.findOne(protectString('b8ynzcdIk5RXEAkIHXShWJ26FTQ_'))
			expect(doc).toBeTruthy()
			expect(doc?.relatedTo).toEqual({
				type: DBNotificationTargetType.PLAYLIST,
				studioId: context.studioId,
				playlistId,
			} satisfies DBNotificationTarget)
		})

		it(`type: playlist without it`, async () => {
			const context = setupDefaultJobEnvironment()

			const helper = new NotificationsModelHelper(context, 'test', null)

			expect(() =>
				helper.setNotification('my-category', {
					id: 'abc',
					message: generateTranslation('test'),
					severity: NoteSeverity.INFO,
					relatedTo: { type: 'playlist' },
				})
			).toThrow(/without a playlist/)
		})

		it(`type: rundown`, async () => {
			const context = setupDefaultJobEnvironment()
			const notificationsCollection = context.mockCollections.Notifications

			const rundownId = protectString('rundown0')

			const helper = new NotificationsModelHelper(context, 'test', null)

			helper.setNotification('my-category', {
				id: 'abc',
				message: generateTranslation('test'),
				severity: NoteSeverity.INFO,
				relatedTo: { type: 'rundown', rundownId },
			})

			await helper.saveAllToDatabase()

			const doc = await notificationsCollection.findOne(protectString('b8ynzcdIk5RXEAkIHXShWJ26FTQ_'))
			expect(doc).toBeTruthy()
			expect(doc?.relatedTo).toEqual({
				type: DBNotificationTargetType.RUNDOWN,
				studioId: context.studioId,
				rundownId,
			} satisfies DBNotificationTarget)
		})

		it(`type: partInstance`, async () => {
			const context = setupDefaultJobEnvironment()
			const notificationsCollection = context.mockCollections.Notifications

			const rundownId = protectString('rundown0')
			const partInstanceId = protectString('partInstance0')

			const helper = new NotificationsModelHelper(context, 'test', null)

			helper.setNotification('my-category', {
				id: 'abc',
				message: generateTranslation('test'),
				severity: NoteSeverity.INFO,
				relatedTo: {
					type: 'partInstance',
					rundownId,
					partInstanceId,
				},
			})

			await helper.saveAllToDatabase()

			const doc = await notificationsCollection.findOne(protectString('b8ynzcdIk5RXEAkIHXShWJ26FTQ_'))
			expect(doc).toBeTruthy()
			expect(doc?.relatedTo).toEqual({
				type: DBNotificationTargetType.PARTINSTANCE,
				studioId: context.studioId,
				rundownId,
				partInstanceId,
			} satisfies DBNotificationTarget)
		})

		it(`type: pieceInstance`, async () => {
			const context = setupDefaultJobEnvironment()
			const notificationsCollection = context.mockCollections.Notifications

			const rundownId = protectString('rundown0')
			const partInstanceId = protectString('partInstance0')
			const pieceInstanceId = protectString('pieceInstance0')

			const helper = new NotificationsModelHelper(context, 'test', null)

			helper.setNotification('my-category', {
				id: 'abc',
				message: generateTranslation('test'),
				severity: NoteSeverity.INFO,
				relatedTo: {
					type: 'pieceInstance',
					rundownId,
					partInstanceId,
					pieceInstanceId,
				},
			})

			await helper.saveAllToDatabase()

			const doc = await notificationsCollection.findOne(protectString('b8ynzcdIk5RXEAkIHXShWJ26FTQ_'))
			expect(doc).toBeTruthy()
			expect(doc?.relatedTo).toEqual({
				type: DBNotificationTargetType.PIECEINSTANCE,
				studioId: context.studioId,
				rundownId,
				partInstanceId,
				pieceInstanceId,
			} satisfies DBNotificationTarget)
		})

		it('retrieve docs', async () => {
			const context = setupDefaultJobEnvironment()
			const notificationsCollection = context.mockCollections.Notifications

			await notificationsCollection.insertOne({
				_id: protectString('id1'),
				category: 'test:my-category',
				relatedTo: {
					type: DBNotificationTargetType.PLAYLIST,
					studioId: context.studioId,
					playlistId: protectString('playlist0'),
				},
				created: 1,
				modified: 2,
				message: generateTranslation('test playlist'),
				severity: NoteSeverity.INFO,
				localId: 'test-playlist',
			})
			await notificationsCollection.insertOne({
				_id: protectString('id2'),
				category: 'test:my-category',
				relatedTo: {
					type: DBNotificationTargetType.RUNDOWN,
					studioId: context.studioId,
					rundownId: protectString('rundown0'),
				},
				created: 1,
				modified: 2,
				message: generateTranslation('test rundown'),
				severity: NoteSeverity.WARNING,
				localId: 'test-rundown',
			})
			await notificationsCollection.insertOne({
				_id: protectString('id3'),
				category: 'test:my-category',
				relatedTo: {
					type: DBNotificationTargetType.PARTINSTANCE,
					studioId: context.studioId,
					rundownId: protectString('rundown0'),
					partInstanceId: protectString('partInstance0'),
				},
				created: 1,
				modified: 2,
				message: generateTranslation('test partInstance'),
				severity: NoteSeverity.ERROR,
				localId: 'test-partInstance',
			})
			await notificationsCollection.insertOne({
				_id: protectString('id4'),
				category: 'test:my-category',
				relatedTo: {
					type: DBNotificationTargetType.PIECEINSTANCE,
					studioId: context.studioId,
					rundownId: protectString('rundown0'),
					partInstanceId: protectString('partInstance0'),
					pieceInstanceId: protectString('pieceInstance0'),
				},
				created: 1,
				modified: 2,
				message: generateTranslation('test pieceInstance'),
				severity: NoteSeverity.INFO,
				localId: 'test-pieceInstance',
			})
			notificationsCollection.clearOpLog()

			const helper = new NotificationsModelHelper(context, 'test', null)

			const notifications = await helper.getAllNotifications('my-category')
			expect(notifications).toHaveLength(4)

			expect(notifications).toMatchObject([
				{
					id: 'test-playlist',
					relatedTo: { type: 'playlist' },
				},
				{
					id: 'test-rundown',
					relatedTo: {
						type: 'rundown',
						rundownId: protectString('rundown0'),
					},
				},
				{
					id: 'test-partInstance',
					relatedTo: {
						type: 'partInstance',
						rundownId: protectString('rundown0'),
						partInstanceId: protectString('partInstance0'),
					},
				},
				{
					id: 'test-pieceInstance',
					relatedTo: {
						type: 'pieceInstance',
						rundownId: protectString('rundown0'),
						partInstanceId: protectString('partInstance0'),
						pieceInstanceId: protectString('pieceInstance0'),
					},
				},
			] satisfies Partial<INotificationWithTarget>[])
		})
	})

	it('setNotification and clearAllNotifications', async () => {
		const context = setupDefaultJobEnvironment()
		const notificationsCollection = context.mockCollections.Notifications

		const helper = new NotificationsModelHelper(context, 'test', protectString('playlist0'))

		helper.setNotification('my-category', {
			id: 'abc',
			message: generateTranslation('test'),
			severity: NoteSeverity.INFO,
			relatedTo: { type: 'playlist' },
		})

		expect(notificationsCollection.operations).toHaveLength(0)

		await helper.saveAllToDatabase()
		expect(notificationsCollection.operations).toEqual([
			{
				type: 'findFetch',
				args: [
					{
						category: 'test:my-category',
						'relatedTo.studioId': context.studioId,
					},
				],
			},
			{
				type: 'bulkWrite',
				args: [1],
			},
			{
				type: 'replace',
				args: ['b8ynzcdIk5RXEAkIHXShWJ26FTQ_'],
			},
		])
		notificationsCollection.clearOpLog()

		helper.clearAllNotifications('my-category')

		expect(notificationsCollection.operations).toHaveLength(0)

		await helper.saveAllToDatabase()
		expect(notificationsCollection.operations).toEqual([
			{
				type: 'findFetch',
				args: [
					{
						category: 'test:my-category',
						'relatedTo.studioId': context.studioId,
					},
				],
			},
			{
				type: 'bulkWrite',
				args: [1],
			},
			{
				type: 'remove',
				args: [
					{
						category: 'test:my-category',
						localId: { $nin: [] },
						'relatedTo.studioId': 'mockStudio0',
					},
				],
			},
		])
	})

	it('clearAllNotifications then setNotification', async () => {
		const context = setupDefaultJobEnvironment()
		const notificationsCollection = context.mockCollections.Notifications

		const helper = new NotificationsModelHelper(context, 'test', protectString('playlist0'))

		helper.clearAllNotifications('my-category')
		helper.setNotification('my-category', {
			id: 'abc',
			message: generateTranslation('test'),
			severity: NoteSeverity.INFO,
			relatedTo: { type: 'playlist' },
		})

		expect(notificationsCollection.operations).toHaveLength(0)

		await helper.saveAllToDatabase()
		expect(notificationsCollection.operations).toEqual([
			{
				type: 'findFetch',
				args: [
					{
						category: 'test:my-category',
						'relatedTo.studioId': context.studioId,
					},
				],
			},
			{
				type: 'bulkWrite',
				args: [2],
			},
			{
				type: 'replace',
				args: ['b8ynzcdIk5RXEAkIHXShWJ26FTQ_'],
			},
			{
				type: 'remove',
				args: [
					{
						category: 'test:my-category',
						localId: { $nin: ['abc'] },
						'relatedTo.studioId': 'mockStudio0',
					},
				],
			},
		])
	})
})
