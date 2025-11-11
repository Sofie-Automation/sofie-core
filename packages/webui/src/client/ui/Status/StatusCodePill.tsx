import * as React from 'react'
import { useTranslation, TFunction } from 'react-i18next'
import { assertNever } from '../../lib/tempLib.js'
import ClassNames from 'classnames'
import { StatusCode } from '@sofie-automation/blueprints-integration'
import {} from './SystemStatus/SystemStatus.js'

export function statusCodeToString(t: TFunction, statusCode: StatusCode): string {
	switch (statusCode) {
		case StatusCode.UNKNOWN:
			return t('Unknown')
		case StatusCode.GOOD:
			return t('Good')
		case StatusCode.WARNING_MINOR:
			return t('Minor Warning')
		case StatusCode.WARNING_MAJOR:
			return t('Warning')
		case StatusCode.BAD:
			return t('Bad')
		case StatusCode.FATAL:
			return t('Fatal')
		default:
			assertNever(statusCode)
			return t('Unknown')
	}
}

export const StatusCodePill: React.FC<{
	connected: boolean
	statusCode: StatusCode
	messages?: string[]
}> = function StatusCodePill(props) {
	const { t } = useTranslation()

	function statusCodeString() {
		return props.connected ? statusCodeToString(t, props.statusCode) : t('Not Connected')
	}
	function statusMessages() {
		const messages = props.messages || []
		return messages.length ? '"' + messages.join(', ') + '"' : ''
	}
	function getStatusClassName(): string {
		if (!props.connected) return 'device-status--unknown'

		switch (props.statusCode) {
			case StatusCode.UNKNOWN:
				return 'device-status--unknown'
			case StatusCode.GOOD:
				return 'device-status--good'
			case StatusCode.WARNING_MINOR:
				return 'device-status--minor-warning'
			case StatusCode.WARNING_MAJOR:
				return 'device-status--warning'
			case StatusCode.BAD:
				return 'device-status--bad'
			case StatusCode.FATAL:
				return 'device-status--fatal'
			default:
				assertNever(props.statusCode)
				return 'unknown-' + props.statusCode
		}
	}

	return (
		<div className={ClassNames('device-status', getStatusClassName())}>
			<div className="value">
				<span className="pill device-status__label">{statusCodeString()}</span>
			</div>
			<div className="device-item__device-status-message">
				<span className="text-s dimmed field-hint">{statusMessages()}</span>
			</div>
		</div>
	)
}
