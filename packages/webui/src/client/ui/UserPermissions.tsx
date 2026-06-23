import React, { useEffect, useMemo, useState } from 'react'
import {
	getLocalAllowStudio,
	getLocalAllowConfigure,
	getLocalAllowDeveloper,
	getLocalAllowTesting,
	getLocalAllowService,
	setAllowStudio,
	setAllowConfigure,
	setAllowDeveloper,
	setAllowTesting,
	setAllowService,
} from '../lib/localStorage.js'
import { parse as queryStringParse } from 'query-string'
import { MeteorCall } from '../lib/meteorApi.js'
import type { UserPermissions } from '@sofie-automation/meteor-lib/dist/userPermissions'
import { APP_HEADER_AUTH_ENABLED } from '../lib/Settings.js'
import { useTracker } from '../lib/ReactMeteorData/ReactMeteorData.js'
import { Meteor } from 'meteor/meteor'

export type { UserPermissions }

const NO_PERMISSIONS: UserPermissions = Object.freeze({
	studio: false,
	configure: false,
	developer: false,
	testing: false,
	service: false,
	gateway: false,
})

export const UserPermissionsContext = React.createContext<Readonly<UserPermissions>>(NO_PERMISSIONS)

export function useUserPermissions(): [roles: UserPermissions, ready: boolean] {
	const location = window.location

	const [ready, setReady] = useState(!APP_HEADER_AUTH_ENABLED)

	const [permissions, setPermissions] = useState<UserPermissions>(
		APP_HEADER_AUTH_ENABLED
			? NO_PERMISSIONS
			: {
					studio: getLocalAllowStudio(),
					configure: getLocalAllowConfigure(),
					developer: getLocalAllowDeveloper(),
					testing: getLocalAllowTesting(),
					service: getLocalAllowService(),
					gateway: false,
				}
	)

	const isConnected = useTracker(() => Meteor.status().connected, [], false)

	useEffect(() => {
		if (!APP_HEADER_AUTH_ENABLED) return

		// Do nothing when not connected. Persist the previous values.
		if (!isConnected) return

		const checkPermissions = () => {
			MeteorCall.user
				.getUserPermissions()
				.then((v) => {
					setPermissions(v || NO_PERMISSIONS)
					setReady(true)
				})
				.catch((e) => {
					console.error('Failed to set level', e)
					setPermissions(NO_PERMISSIONS)
				})
		}

		const interval = setInterval(checkPermissions, 30000) // Arbitrary poll interval

		// Initial check now
		checkPermissions()

		return () => {
			clearInterval(interval)
		}
	}, [APP_HEADER_AUTH_ENABLED, isConnected])

	useEffect(() => {
		if (APP_HEADER_AUTH_ENABLED) return

		if (!location.search) return

		const params = queryStringParse(location.search)

		if (params['studio']) setAllowStudio(params['studio'] === '1')
		if (params['configure']) setAllowConfigure(params['configure'] === '1')
		if (params['develop']) setAllowDeveloper(params['develop'] === '1')
		if (params['testing']) setAllowTesting(params['testing'] === '1')
		if (params['service']) setAllowService(params['service'] === '1')

		if (params['admin']) {
			const val = params['admin'] === '1'
			setAllowStudio(val)
			setAllowConfigure(val)
			setAllowDeveloper(val)
			setAllowTesting(val)
			setAllowService(val)
		}

		setPermissions({
			studio: getLocalAllowStudio(),
			configure: getLocalAllowConfigure(),
			developer: getLocalAllowDeveloper(),
			testing: getLocalAllowTesting(),
			service: getLocalAllowService(),
			gateway: false,
		})
	}, [location.search, APP_HEADER_AUTH_ENABLED])

	// A naive memoizing of the value, to avoid reactions when the value is identical
	return [useMemo(() => permissions, [JSON.stringify(permissions)]), ready]
}
