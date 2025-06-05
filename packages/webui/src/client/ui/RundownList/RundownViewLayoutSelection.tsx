import React, { useState } from 'react'
import { UIStateStorage } from '../../lib/UIStateStorage.js'
import { Link } from 'react-router-dom'
import { SplitDropdown } from '../../lib/SplitDropdown.js'
import {
	getRundownPlaylistLink,
	getRundownWithShelfLayoutLink as getRundownWithLayoutLink,
	getShelfLink,
} from './util.js'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownLayoutBase } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { IconProp } from '@fortawesome/fontawesome-svg-core'
import { useTranslation } from 'react-i18next'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts.js'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export const RundownViewLayoutSelection = React.memo(function RundownViewLayoutSelection2({
	playlistId,
	rundowns,
	rundownLayouts,
}: {
	playlistId: RundownPlaylistId
	rundowns: Rundown[]
	rundownLayouts: RundownLayoutBase[]
}): JSX.Element {
	const [selectedView, _setSelectedView] = useState(
		UIStateStorage.getItemString(`rundownList.${playlistId}`, 'defaultView', 'default')
	)
	const { t } = useTranslation()

	function saveViewChoice(key: string) {
		UIStateStorage.setItem(`rundownList.${playlistId}`, 'defaultView', key)
	}

	function renderLinkItem(layout: RundownLayoutBase, link: string, key: string) {
		return {
			key,
			node: (
				<Link to={link} onClick={() => saveViewChoice(key)}>
					<div className="action-btn expco-item">
						<div
							className={classNames('action-btn layout-icon', { small: !layout.icon })}
							style={{ color: layout.iconColor || 'transparent' }}
						>
							<FontAwesomeIcon icon={(layout.icon as IconProp) || 'circle'} />
						</div>
						{layout.name}
					</div>
				</Link>
			),
		}
	}

	const showstylesInPlaylist = rundowns.map((r) => r.showStyleBaseId)
	const layoutsInRundown = rundownLayouts.filter((layout) => showstylesInPlaylist.includes(layout.showStyleBaseId))

	const standaloneLayouts = layoutsInRundown
		.filter((layout) => RundownLayoutsAPI.isLayoutForShelf(layout) && layout.exposeAsStandalone)
		.map((layout) => {
			return renderLinkItem(layout, getShelfLink(playlistId, layout._id), `standalone${layout._id}`)
		})
	const rundownViewLayouts = layoutsInRundown
		.filter((layout) => RundownLayoutsAPI.isLayoutForRundownView(layout) && layout.exposeAsSelectableLayout)
		.map((layout) => {
			return renderLinkItem(layout, getRundownWithLayoutLink(playlistId, layout._id), `shelf${layout._id}`)
		})

	return rundownViewLayouts.length > 0 || standaloneLayouts.length > 0 ? (
		<React.Fragment>
			<SplitDropdown
				selectedKey={selectedView}
				options={[
					{ node: <div className="expco-header">{t('Standalone Shelf')}</div> },
					...standaloneLayouts,
					{ node: <div className="expco-header">{t('Rundown & Shelf')}</div> },
					...rundownViewLayouts,
					{ node: <div className="expco-separator"></div> },
					{
						key: 'default',
						node: (
							<Link to={getRundownPlaylistLink(playlistId)} onClick={() => saveViewChoice('default')} key={'default'}>
								<div className="action-btn expco-item">{t('Default')}</div>
							</Link>
						),
					},
				]}
			/>
		</React.Fragment>
	) : (
		<span className="dimmed">{t('Default')}</span>
	)
})
