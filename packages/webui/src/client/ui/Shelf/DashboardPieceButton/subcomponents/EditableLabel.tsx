type Props = {
	editable: boolean | undefined
	label: string
	labelRef: React.Ref<HTMLTextAreaElement>
	onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
	onBlur: (e: React.FocusEvent<HTMLTextAreaElement>) => void
	onKeyUp: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}

function renderLabelWithWbr(label: string): Array<React.ReactNode> {
	const out: Array<React.ReactNode> = []

	// Insert <wbr/> after every "special" character (anything that's not a unicode letter/number).
	// This gives the browser more break opportunities without changing visible text.
	const chars = Array.from(label)
	for (let i = 0; i < chars.length; i++) {
		const ch = chars[i]
		out.push(ch)
		if (/[^\p{L}\p{N}.]/u.test(ch)) out.push(<wbr key={`wbr-${i}`} />)
	}

	return out
}

export function EditableLabel(props: Props): JSX.Element {
	return (
		<div
			className={[
				'dashboard-panel__panel__button__label',
				props.editable ? 'dashboard-panel__panel__button__label--editable' : undefined,
			]
				.filter(Boolean)
				.join(' ')}
		>
			{props.editable ? (
				<textarea
					ref={props.labelRef}
					className="dashboard-panel__panel__button__label__content dashboard-panel__panel__button__label__content--editable"
					value={props.label}
					onChange={props.onChange}
					onBlur={props.onBlur}
					onKeyUp={props.onKeyUp}
				/>
			) : (
				<div className="dashboard-panel__panel__button__label__content">{renderLabelWithWbr(props.label)}</div>
			)}
		</div>
	)
}
