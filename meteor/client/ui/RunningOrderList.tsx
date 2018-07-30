import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as _ from 'underscore'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { Link } from 'react-router-dom'
import timer from 'react-timer-hoc'
import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import Moment from 'react-moment'
import { RundownUtils } from '../lib/rundown'
import { getCurrentTime } from '../../lib/lib'

interface IRunningOrdersListProps {
	runningOrders: Array<RunningOrder>
}

export const RunningOrderList = translateWithTracker(() => {
	// console.log('PeripheralDevices',PeripheralDevices);
	// console.log('PeripheralDevices.find({}).fetch()',PeripheralDevices.find({}, { sort: { created: -1 } }).fetch());

	return {
		runningOrders: RunningOrders.find({}, { sort: { created: -1 } }).fetch()
	}
})(
class extends React.Component<Translated<IRunningOrdersListProps>> {
	private _subscriptions: Array<Meteor.SubscriptionHandle> = []

	renderRunningOrders () {
		return this.props.runningOrders.map((runningOrder) => (
			<RunningOrderListItem key={runningOrder._id} runningOrder={runningOrder} />
		))
	}
	componentWillMount () {
		// Subscribe to data:
		this._subscriptions.push(Meteor.subscribe('runningOrders', {
		}))
	}
	componentWillUnmount () {
		_.each(this._subscriptions, (sub ) => {
			sub.stop()
		})
	}

	render () {
		const { t } = this.props

		return (
			<div className='mtl gutter'>
				<header className='mvs'>
					<h1>{t('Running Orders')}</h1>
				</header>
				<div className='mod mvl'>
					<table className='table system-status-table expando expando-tight'>
						<thead>
							<tr className='hl'>
								<th className='c3'>
									{t('Slug')}
								</th>
								<th className='c2'>
									{t('ID')}
								</th>
								<th className='c2'>
									{t('Created')}
								</th>
								<th className='c2'>
									{t('Air Time')}
								</th>
								<th className='c1'>
									{t('Duration')}
								</th>
								<th className='c1'>
									{t('Status')}
								</th>
								<th className='c1'>
									{t('Air Status')}
								</th>
							</tr>
						</thead>
						<tbody>
							{this.renderRunningOrders()}
						</tbody>
					</table>
				</div>
			</div>
		)
	}
}
)

interface IActiveProgressBarProps {
	runningOrder: RunningOrder
}

const ActiveProgressBar = timer(1000)(class extends React.Component<IActiveProgressBarProps> {
	render () {
		return (this.props.runningOrder.startedPlayback && this.props.runningOrder.expectedDuration ?
			<div className='progress-bar'>
				<div className='pb-indicator' style={{
					'width': Math.min(((getCurrentTime() - this.props.runningOrder.startedPlayback) / this.props.runningOrder.expectedDuration) * 100, 100) + '%'
				}} />
			</div> : null
		)
	}
})

interface IRunningOrderListItemProps {
	key: string,
	runningOrder: RunningOrder
}

export class RunningOrderListItem extends React.Component<IRunningOrderListItemProps> {
	getRunningOrderLink (runningOrderId) {
		// double encoding so that "/" are handled correctly
		return '/ro/' + encodeURIComponent(encodeURIComponent( runningOrderId ))
	}

	render () {
		return (
			<React.Fragment>
				<tr className='running-order-list-item'>
					<th className='running-order-list-item__name'>
						{this.props.runningOrder.active ?
							<div className='origo-pulse small right mrs'>
								<div className='pulse-marker'>
									<div className='pulse-rays'></div>
									<div className='pulse-rays delay'></div>
								</div>
							</div>
							: null
						}
							<Link to={this.getRunningOrderLink(this.props.runningOrder._id)}>{this.props.runningOrder.name}</Link>
					</th>
					<td className='running-order-list-item__id'>
						{this.props.runningOrder._id}
					</td>
					<td className='running-order-list-item__created'>
						<Moment fromNow>{this.props.runningOrder.created}</Moment>
					</td>
					<td className='running-order-list-item__airTime'>
						{this.props.runningOrder.expectedStart &&
							<Moment format='YYYY/MM/DD HH:mm:ss'>{this.props.runningOrder.expectedStart}</Moment>
						}
					</td>
					<td className='running-order-list-item__duration'>
						{this.props.runningOrder.expectedDuration &&
							RundownUtils.formatDiffToTimecode(this.props.runningOrder.expectedDuration, false, false, true, false, true)
						}
					</td>
					<td className='running-order-list-item__status'>
						{this.props.runningOrder.status}
					</td>
					<td className='running-order-list-item__air-status'>
						{this.props.runningOrder.airStatus}
					</td>
				</tr>
				{this.props.runningOrder.startedPlayback && this.props.runningOrder.expectedDuration && this.props.runningOrder.active &&
					<tr className='hl expando-addon'>
						<td colSpan={7}>
							<ActiveProgressBar
								runningOrder={this.props.runningOrder}
							/>
						</td>
					</tr>
				}
			</React.Fragment>
		)
	}
}
