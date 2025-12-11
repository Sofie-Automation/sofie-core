import { translateStringIfHasNamespaces } from './schemaFormUtil.js'

export function SchemaFormSectionHeader({
	title,
	description,
	translationNamespaces,
}: Readonly<{
	title: string | undefined
	description: string | undefined
	translationNamespaces: string[] | undefined
}>): JSX.Element | null {
	if (!title) return null

	return (
		<>
			<h3 className="m-0">{translateStringIfHasNamespaces(title, translationNamespaces)}</h3>
			{description ? (
				<p className="text-s subtle">{translateStringIfHasNamespaces(description, translationNamespaces)}</p>
			) : null}
		</>
	)
}
