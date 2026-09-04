import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { getDefaultDataFromSchema } from 'ograf-form'
import type { JSONSchema } from '@sofie-automation/blueprints-integration'

declare global {
	namespace JSX {
		interface IntrinsicElements {
			'superflytv-ograf-form': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
				schema?: string
				value?: string
			}
		}
	}
}

interface OGrafSchemaFormProps {
	data: unknown
	schema: JSONSchema
	onUpdate: (data: unknown) => void
}

export function OGrafSchemaForm({ data, onUpdate, schema }: Readonly<OGrafSchemaFormProps>): JSX.Element {
	/** Ref to the form component */
	const formRef = useRef<HTMLElement | null>(null)
	/** State to hold the data */
	const [dataState, setDataState] = useState(() =>
		// Use default data from schema as initial data:
		data ? data : schema ? getDefaultDataFromSchema(schema) : {}
	)

	/** Callback when the data changes */
	const onDataChange = useCallback(
		(newData: unknown) => {
			setDataState(newData)
			onUpdate(newData)
		},
		[onUpdate]
	)

	// Set up listener for when the data has changed in the form:
	useLayoutEffect(() => {
		if (!formRef.current) return
		const currentForm = formRef.current
		const listener = (e: any) => onDataChange(e.detail.value)
		currentForm.addEventListener('change', listener)

		return () => currentForm.removeEventListener('change', listener)
	})

	return (
		<div>
			<superflytv-ograf-form
				ref={formRef}
				schema={JSON.stringify(schema)}
				value={JSON.stringify(dataState)}
			></superflytv-ograf-form>
		</div>
	)
}
