export function HotkeyBadge(props: { hotkey: string | undefined }): JSX.Element | null {
	if (!props.hotkey) return null
	return <div className="dashboard-panel__panel__button__hotkey">{props.hotkey}</div>
}
