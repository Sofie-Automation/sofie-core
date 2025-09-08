import { useTracker } from '../../lib/ReactMeteorData/react-meteor-data.js'
import { Link } from 'react-router-dom'
import { unprotectString } from '../../lib/tempLib.js'
import { UIStudios } from '../Collections.js'
import { useTranslation } from 'react-i18next'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'

function StudioSelect({ title, path }: Readonly<{ title: string; path: string }>): JSX.Element {
	const studios = useTracker(
		() =>
			UIStudios.find(
				{},
				{
					sort: {
						_id: 1,
					},
				}
			).fetch(),
		[],
		[] as UIStudio[]
	)

	const { t } = useTranslation()

	return (
		<div className="mx-5 recordings-studio-select">
			<header className="mb-2">
				<h1>{t(title)}</h1>
			</header>
			<div className="my-5">
				<strong>Studio</strong>
				<ul>
					{studios.map((studio) => {
						return (
							<li key={unprotectString(studio._id)}>
								<Link to={`${path}/${studio._id}`}>{studio.name}</Link>
							</li>
						)
					})}
				</ul>
			</div>
		</div>
	)
}

export { StudioSelect }
