export function DashboardButtonThumbnail(props: { url: string }): JSX.Element {
	return (
		<div className="dashboard-panel__panel__button__thumbnail">
			<img src={props.url} />
		</div>
	)
}
