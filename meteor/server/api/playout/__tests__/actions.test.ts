import { Meteor } from 'meteor/meteor'
import '../../../../__mocks__/_extendJest'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { mockupCollection } from '../../../../__mocks__/helpers/lib'
import { setupDefaultStudioEnvironment, DefaultEnvironment, setupDefaultRundown, setupMockPeripheralDevice, setupDefaultRundownPlaylist } from '../../../../__mocks__/helpers/database'
import { Rundowns, Rundown } from '../../../../lib/collections/Rundowns'
import '../api'
import { Timeline as OrgTimeline } from '../../../../lib/collections/Timeline'
import { activateRundownPlaylist, prepareStudioForBroadcast } from '../actions'
import { PeripheralDeviceAPI } from '../../../../lib/api/peripheralDevice'
import { PeripheralDeviceCommands } from '../../../../lib/collections/PeripheralDeviceCommands'
import { PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import * as _ from 'underscore'
import { RundownPlaylist, RundownPlaylists, RundownPlaylistId } from '../../../../lib/collections/RundownPlaylists'
import { protectString } from '../../../../lib/lib'

// const Timeline = mockupCollection(OrgTimeline)

describe('Playout Actions', () => {
	let env: DefaultEnvironment
	let playoutDevice: PeripheralDevice

	function getPeripheralDeviceCommands (playoutDevice: PeripheralDevice) {
		return PeripheralDeviceCommands.find({ deviceId: playoutDevice._id }, { sort: { time: 1 } }).fetch()
	}
	function clearPeripheralDeviceCommands (playoutDevice: PeripheralDevice) {
		return PeripheralDeviceCommands.remove({ deviceId: playoutDevice._id })
	}

	beforeEach(() => {
		env = setupDefaultStudioEnvironment()

		playoutDevice = setupMockPeripheralDevice(
			PeripheralDeviceAPI.DeviceCategory.PLAYOUT,
			PeripheralDeviceAPI.DeviceType.PLAYOUT,
			PeripheralDeviceAPI.SUBTYPE_PROCESS,
			env.studio
		)

		_.each(Rundowns.find().fetch(),rundown => rundown.remove())
	})
	testInFiber('activateRundown', () => {
		const { playlistId: playlistId0 } = setupDefaultRundownPlaylist(env, protectString('ro0'))
		expect(playlistId0).toBeTruthy()

		const getPlaylist0 = () => RundownPlaylists.findOne(playlistId0) as RundownPlaylist

		const { playlistId: playlistId1 } = setupDefaultRundownPlaylist(env, protectString('ro1'))
		expect(playlistId1).toBeTruthy()

		const getPlaylist1 = () => RundownPlaylists.findOne(playlistId1) as RundownPlaylist

		const { playlistId: playlistId2 } = setupDefaultRundownPlaylist(env, protectString('ro2'))
		expect(playlistId2).toBeTruthy()

		const playlistRemoved = RundownPlaylists.findOne(playlistId2) as RundownPlaylist
		playlistRemoved.remove()

		// Activating a rundown that doesn't exist:
		expect(() => {
			activateRundownPlaylist(playlistRemoved, false)
		}).toThrowError(/not found/)

		expect(getPeripheralDeviceCommands(playoutDevice)).toHaveLength(0)
		// Activating a rundown, to rehearsal
		activateRundownPlaylist(getPlaylist0(), true)
		expect(getPlaylist0()).toMatchObject({ active: true, rehearsal: true })

		// Activating a rundown
		activateRundownPlaylist(getPlaylist0(), false)
		expect(getPlaylist0()).toMatchObject({ active: true, rehearsal: false })

		// Activating a rundown, back to rehearsal
		activateRundownPlaylist(getPlaylist0(), true)
		expect(getPlaylist0()).toMatchObject({ active: true, rehearsal: true })

		// Activating another rundown
		expect(() => {
			activateRundownPlaylist(getPlaylist1(), false)
		}).toThrowError(/only one rundown can be active/i)
	})
	testInFiber('prepareStudioForBroadcast', () => {
		expect(getPeripheralDeviceCommands(playoutDevice)).toHaveLength(0)

		// prepareStudioForBroadcast
		const playlistId = { _id: protectString<RundownPlaylistId>('some-id') } as RundownPlaylist
		const okToDestroyStuff = true
		prepareStudioForBroadcast(env.studio, okToDestroyStuff, playlistId)

		expect(getPeripheralDeviceCommands(playoutDevice)).toHaveLength(1)
		expect(getPeripheralDeviceCommands(playoutDevice)[0]).toMatchObject({
			functionName: 'devicesMakeReady',
			args: [okToDestroyStuff, playlistId._id]
		})
	})
})
