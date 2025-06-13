import { BaseRemoteInputIcon } from './RemoteInputIcon'

export default function LocalInputIcon(props: Readonly<{ inputIndex?: string; abbreviation?: string }>): JSX.Element {
	return <BaseRemoteInputIcon className="local">{props.abbreviation ? props.abbreviation : 'EVS'}</BaseRemoteInputIcon>
}
