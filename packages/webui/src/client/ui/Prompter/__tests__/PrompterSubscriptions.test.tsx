import type React from 'react'
import { render } from '@testing-library/react'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import type { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'

const useSubscriptionIfEnabled = jest.fn()

// Only the subscriptions are under test: no reactive data, so the prompter renders its loading state
jest.mock('../../../lib/ReactMeteorData/ReactMeteorData.js', () => ({
	...jest.requireActual('../../../lib/ReactMeteorData/ReactMeteorData.js'),
	useSubscription: jest.fn(),
	useSubscriptions: jest.fn(),
	useSubscriptionIfEnabled: (...args: unknown[]) => useSubscriptionIfEnabled(...args),
	useTracker: (_fn: unknown, _deps: unknown, initial?: unknown) => initial,
	useGlobalDelayedTrackerUpdateState: (value: unknown) => value,
}))
jest.mock('react-i18next', () => ({
	...jest.requireActual('react-i18next'),
	withTranslation: () => (Component: React.ComponentType<any>) =>
		function Translated(props: any) {
			return <Component {...props} t={(str: string) => str} />
		},
}))

// Components the loading state does not render, mocked so that their stylesheets are not loaded
jest.mock('../../ClockView/RundownStatusBar.js', () => ({ RundownStatusBar: () => null }))
jest.mock('../../../lib/Components/OverUnderChip.js', () => ({ OverUnderChip: () => null }))
jest.mock('../../StudioScreenSaver/StudioScreenSaver.js', () => ({ StudioScreenSaver: () => null }))
jest.mock('../PrompterControlButtons/PrompterControlButtons.js', () => ({ PrompterControlButtons: () => null }))

import { Prompter } from '../PrompterView.js'

const PLAYLIST_ID = protectString<RundownPlaylistId>('playlist0')

function renderPrompter(showOverUnder: boolean) {
	const config = { showOverUnder } as React.ComponentProps<typeof Prompter>['config']
	render(<Prompter rundownPlaylistId={PLAYLIST_ID} config={config} allowTestingAdlibsToPersist={false} />)
}

function timingSubscriptionCalls() {
	return useSubscriptionIfEnabled.mock.calls.filter((call) => call[0] === CorelibPubSub.playlistTimingState)
}

describe('Prompter subscriptions', () => {
	beforeEach(() => {
		useSubscriptionIfEnabled.mockClear()
	})

	it('subscribes to the timing publication when the Over/Under chip is shown', () => {
		renderPrompter(true)
		expect(timingSubscriptionCalls()).toEqual([[CorelibPubSub.playlistTimingState, true, PLAYLIST_ID]])
	})

	it('does not subscribe to it when the chip is hidden', () => {
		renderPrompter(false)
		expect(timingSubscriptionCalls()).toEqual([[CorelibPubSub.playlistTimingState, false, PLAYLIST_ID]])
	})
})
