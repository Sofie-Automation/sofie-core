import { StudioRouteBehavior, StudioRouteSet } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { abPoolFilterDisabled, findPlayersInRouteSets } from '../routeSetDisabling.js'
import { ABPlayerDefinition } from '@sofie-automation/blueprints-integration'
import { clone } from '@sofie-automation/corelib/dist/lib'

describe('route set disabling ab players', () => {
	const POOL_NAME = '_test_'
	function runDisablePlayersFiltering(
		routeSets: Record<string, StudioRouteSet>,
		players: ABPlayerDefinition[]
	): ABPlayerDefinition[] {
		const members = findPlayersInRouteSets(routeSets)
		return abPoolFilterDisabled(POOL_NAME, players, members)
	}

	const DEFAULT_PLAYERS: ABPlayerDefinition[] = [
		{ playerId: 1 },
		{ playerId: 2 },
		{ playerId: 3 },
		{ playerId: 4 },
		{ playerId: 5 },
	]

	test('no routesets', () => {
		const result = runDisablePlayersFiltering({}, DEFAULT_PLAYERS)
		expect(result).toEqual(DEFAULT_PLAYERS)
	})

	test('mismatch of playerId types', () => {
		const routesets: Record<string, StudioRouteSet> = {
			route1: {
				name: '',
				active: false,
				behavior: StudioRouteBehavior.TOGGLE,
				routes: [],
				abPlayers: [
					{
						poolName: POOL_NAME,
						playerId: '1', // because ui field is always a string
					},
				],
			},
		}

		const players: ABPlayerDefinition[] = [
			{
				playerId: 1, // number because blueprint defined it as such
			},
			{ playerId: 2 },
		]

		const result = runDisablePlayersFiltering(routesets, players)

		const expectedPlayers = players.filter((p) => p.playerId !== 1)
		expect(result).toEqual(expectedPlayers)
	})

	describe('single routeset per player', () => {
		const ROUTESETS_SEPARATE: Record<string, StudioRouteSet> = {
			pl1: {
				name: '',
				active: true,
				behavior: StudioRouteBehavior.TOGGLE,
				routes: [],
				abPlayers: [
					{
						poolName: POOL_NAME,
						playerId: 1,
					},
				],
			},
			pl2: {
				name: '',
				active: true,
				behavior: StudioRouteBehavior.TOGGLE,
				routes: [],
				abPlayers: [
					{
						poolName: POOL_NAME,
						playerId: 2,
					},
				],
			},
			pl3: {
				name: '',
				active: true,
				behavior: StudioRouteBehavior.TOGGLE,
				routes: [],
				abPlayers: [
					{
						poolName: POOL_NAME,
						playerId: 3,
					},
				],
			},
		}

		test('active routes', () => {
			const result = runDisablePlayersFiltering(ROUTESETS_SEPARATE, DEFAULT_PLAYERS)
			expect(result).toEqual(DEFAULT_PLAYERS)
		})

		test('inactive routes', () => {
			const routesets = clone(ROUTESETS_SEPARATE)
			routesets['pl3'].active = false

			// deactivate this, but for a different pool
			routesets['pl2'].active = false
			routesets['pl2'].abPlayers[0].poolName = 'ANOTHER'

			const result = runDisablePlayersFiltering(routesets, DEFAULT_PLAYERS)

			const expectedPlayers = DEFAULT_PLAYERS.filter((p) => p.playerId !== 3)
			expect(result).toEqual(expectedPlayers)
		})
	})

	describe('multiple routesets per player', () => {
		/**
		 * This is testing the scenario of these 3 routesets where only one can be active at a time
		 */
		const ROUTESETS_GROUPED: Record<string, StudioRouteSet> = {
			all: {
				name: '',
				active: true,
				behavior: StudioRouteBehavior.TOGGLE,
				exclusivityGroup: 'ab',
				routes: [],
				abPlayers: [
					{
						poolName: POOL_NAME,
						playerId: 1,
					},
					{
						poolName: POOL_NAME,
						playerId: 2,
					},
					{
						poolName: POOL_NAME,
						playerId: 3,
					},
					{
						poolName: POOL_NAME,
						playerId: 4,
					},
				],
			},
			first: {
				name: '',
				active: false,
				behavior: StudioRouteBehavior.TOGGLE,
				exclusivityGroup: 'ab',
				routes: [],
				abPlayers: [
					{
						poolName: POOL_NAME,
						playerId: 1,
					},
					{
						poolName: POOL_NAME,
						playerId: 2,
					},
				],
			},
			second: {
				name: '',
				active: false,
				behavior: StudioRouteBehavior.TOGGLE,
				exclusivityGroup: 'ab',
				routes: [],
				abPlayers: [
					{
						poolName: POOL_NAME,
						playerId: 3,
					},
					{
						poolName: POOL_NAME,
						playerId: 4,
					},
				],
			},
		}

		test('all', () => {
			const result = runDisablePlayersFiltering(ROUTESETS_GROUPED, DEFAULT_PLAYERS)
			expect(result).toEqual(DEFAULT_PLAYERS)
		})

		test('first', () => {
			const routesets = clone(ROUTESETS_GROUPED)
			routesets['all'].active = false
			routesets['first'].active = true

			const result = runDisablePlayersFiltering(routesets, DEFAULT_PLAYERS)

			const expectedPlayers = DEFAULT_PLAYERS.filter((p) => p.playerId !== 3 && p.playerId !== 4)
			expect(result).toEqual(expectedPlayers)
		})

		test('second', () => {
			const routesets = clone(ROUTESETS_GROUPED)
			routesets['all'].active = false
			routesets['second'].active = true

			const result = runDisablePlayersFiltering(routesets, DEFAULT_PLAYERS)

			const expectedPlayers = DEFAULT_PLAYERS.filter((p) => p.playerId !== 1 && p.playerId !== 2)
			expect(result).toEqual(expectedPlayers)
		})
	})
})
