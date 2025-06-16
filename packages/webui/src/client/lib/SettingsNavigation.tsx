import { useCallback } from 'react'
import { useHistory } from 'react-router-dom'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import Button from 'react-bootstrap/Button'

export function RedirectToBlueprintButton(props: Readonly<{ id: BlueprintId | undefined }>): JSX.Element {
	const history = useHistory()

	const redirectToId = useCallback(() => history.push('/settings/showStyleBase/' + props.id), [props.id])

	return (
		<Button variant="primary" onClick={redirectToId} disabled={!props.id}>
			Edit Blueprint
		</Button>
	)
}
