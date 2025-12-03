import { BaseRemoteInputIcon } from './RemoteInputIcon.js'

export default function LocalInputIcon(props: Readonly<{ inputNumber?: string; abbreviation?: string }>): JSX.Element {
	return (
		<BaseRemoteInputIcon className="local">
			{props.abbreviation !== undefined ? props.abbreviation : 'EVS'}
			<tspan>{props.inputNumber ?? ''}</tspan>
		</BaseRemoteInputIcon>
	)
}
