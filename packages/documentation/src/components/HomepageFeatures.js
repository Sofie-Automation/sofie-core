import React from 'react'
import Link from '@docusaurus/Link'
import clsx from 'clsx'
import styles from './HomepageFeatures.module.css'

const FeatureList = [
	{
		title: 'User Guide',
		Svg: require('../img/undraw_press_play.svg').default,
		link: 'docs/user-guide/intro',
		description: (
			<>
				General documentation describing functionality, installation, and operation of a <em>Sofie</em> system.
			</>
		),
	},
	{
		title: 'For Developers',
		Svg: require('../img/undraw_developer_activity.svg').default,
		link: 'docs/for-developers/intro',
		description: (
			<>
				Specific documentation regarding development and contribution to the <em>Sofie</em> code base.
			</>
		),
	},
	{
		title: 'Releases',
		Svg: require('../img/undraw_going_up.svg').default,
		link: 'releases',
		description: (
			<>
				Current, past, and upcoming releases of the <em>Sofie</em> system.
			</>
		),
	},
	{
		title: 'Community',
		Svg: require('../img/undraw_work_chat.svg').default,
		link: 'https://join.slack.com/t/sofietv/shared_invite/zt-2bfz8l9lw-azLeDB55cvN2wvMgqL1alA',
		description: (
			<>
				Please join the growing <em>Slack</em> to meet the developers and other <em>Sofie</em> users.
			</>
		),
	},
]

function Feature({ Svg, title, description, link }) {
	return (
		<div className={clsx('col col--3')}>
			<div className="text--center">
				{Svg ? (
					<Link to={link}>
						<Svg className={styles.featureSvg} alt={title} />
					</Link>
				) : null}
			</div>
			<div className="text--center padding-horiz--md">
				<h3>
					<Link to={link}>{title}</Link>
				</h3>
				<p>{description}</p>
			</div>
		</div>
	)
}

export default function HomepageFeatures() {
	return (
		<section className={styles.features}>
			<div className="container">
				<div className="row">
					{FeatureList.map((props, idx) => (
						<Feature key={idx} {...props} />
					))}
				</div>
			</div>
		</section>
	)
}
