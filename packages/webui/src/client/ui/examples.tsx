import { useTracker } from '../lib/ReactMeteorData/ReactMeteorData.js'
import * as React from 'react'
import { TimingDataResolution, TimingTickResolution, useTiming } from './RundownView/RundownTiming/withTiming.js'
import { useTranslation } from 'react-i18next'
import { Meteor } from 'meteor/meteor'

// These are examples of how to write different types of components

// Simple component ----------------------------

interface SimpleComponentProps {
	myProp0: string
}
export function SimpleComponent({ myProp0 }: Readonly<SimpleComponentProps>): JSX.Element {
	const { t } = useTranslation()

	const [myState0, _setMyState0] = React.useState<string>('default')
	return (
		<div>
			{t('Test test')}
			{myProp0}
			{myState0}
			{/* {this.props.asdf} invalid argument */}
			{/* {this.state.asdf} invalid argument */}
		</div>
	)
}

// Reactive Component ----------------------------

interface ReactiveComponentProps {
	myProp0: string
}
export function ReactiveComponent(props: Readonly<ReactiveComponentProps>): JSX.Element {
	const { t } = useTranslation()

	const myReactiveProp0 = useTracker(() => Meteor.status().status, [])

	return (
		<div>
			{t('Test test')}
			{props.myProp0}
			{myReactiveProp0}
			{/* {this.props.asdf} invalid argument */}
			{/* {this.state.asdf} invalid argument */}
		</div>
	)
}

// withTiming ----------------------
interface WithTimingComponentProps {
	myProp0: string
}
export function WithTimingComponent({ myProp0 }: Readonly<WithTimingComponentProps>): JSX.Element {
	const timingDurations = useTiming(TimingTickResolution.Synced, TimingDataResolution.Synced)

	return (
		<div>
			{myProp0}
			{timingDurations.currentTime}
			{/* {this.props.asdf} invalid argument */}
			{/* {this.state.asdf} invalid argument */}
		</div>
	)
}
