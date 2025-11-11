import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
// import classNames from 'classnames'
// import Tooltip from 'rc-tooltip'
// import { TOOLTIP_DEFAULT_DELAY } from '../../lib/lib.js'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData.js'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	MediaStatus,
	MediaStatusListItem as IMediaStatusListItem,
	sortItems,
	SortBy,
	SortOrder,
} from '../../MediaStatus/MediaStatus.js'
import { MediaStatusPopUpItem } from './MediaStatusPopUpItem.js'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { MediaStatusPopUpHeader } from './MediaStatusPopUpHeader.js'
import { RundownPlaylists } from '../../../collections/index.js'
import { MediaStatusPopUpSegmentRule } from './MediaStatusPopUpSegmentRule.js'
import { mapOrFallback, useDebounce } from '../../../lib/lib.js'
import { Spinner } from '../../../lib/Spinner.js'
import { NavLink } from 'react-router-dom'
import { MediaStatusPopOutIcon } from '../../../lib/ui/icons/mediaStatus.js'
import { PopUpPanel } from '../PopUpPanel.js'

interface IProps {
	playlistId: RundownPlaylistId
}

/**
 * This is a panel for monitoring the state of all the Media for this Playlist
 */
export function MediaStatusPopUp({ playlistId }: Readonly<IProps>): JSX.Element {
	const { t } = useTranslation()

	const [sortBy, setSortBy] = useState<'rundown' | 'status' | 'sourceLayer' | 'name'>('rundown')
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
	const [filter, setFilter] = useState<string>('')
	const debouncedFilter = useDebounce(filter, 100)

	function onChangeSort(sortBy: SortBy, sortOrder: SortOrder) {
		setSortOrder(sortOrder === 'inactive' ? 'asc' : sortOrder)
		setSortBy(sortBy)
	}

	const emptyFilter = !debouncedFilter || debouncedFilter.trim().length === 0

	const filterItems = useCallback(
		(item: IMediaStatusListItem) => {
			if (emptyFilter) return true
			if (item.name.toLowerCase().indexOf(debouncedFilter.toLowerCase().trim()) >= 0) return true
			if ((item.partIdentifier?.toLocaleLowerCase() ?? '').startsWith(debouncedFilter.toLowerCase().trim())) return true
			if ((item.segmentIdentifier?.toLocaleLowerCase() ?? '').startsWith(debouncedFilter.toLowerCase().trim()))
				return true
			return false
		},
		[debouncedFilter, emptyFilter]
	)

	const playlistIds = useMemo(() => [playlistId], [playlistId])

	const { currentPartInstanceId, nextPartInstanceId } = useTracker(
		() => {
			const playlist = RundownPlaylists.findOne(playlistId, {
				projection: {
					nextPartInfo: 1,
					currentPartInfo: 1,
				},
			})
			return {
				currentPartInstanceId: playlist?.currentPartInfo?.partInstanceId,
				nextPartInstanceId: playlist?.nextPartInfo?.partInstanceId,
			}
		},
		[playlistId],
		{
			currentPartInstanceId: undefined,
			nextPartInstanceId: undefined,
		}
	)

	return (
		<PopUpPanel className="media-status-panel" role="dialog">
			<div className="media-status-panel__inside">
				<div className="media-status-panel__pop-out">
					<NavLink to="/status/media" target="_blank">
						<MediaStatusPopOutIcon />
					</NavLink>
				</div>
				<h2 className="mx-3 my-0">{t('Media Status')}</h2>
				<div className="media-status-panel__scrollbox">
					<table className="media-status-panel__table">
						<MediaStatusPopUpHeader
							sortBy={sortBy}
							sortOrder={sortOrder}
							onChange={onChangeSort}
							filter={filter}
							onFilterChange={setFilter}
						/>
						<tbody>
							<MediaStatus
								playlistIds={playlistIds}
								fallback={
									<tr>
										<td colSpan={6} className="media-status-panel__empty-message">
											<Spinner />
										</td>
									</tr>
								}
							>
								{(items) => (
									<>
										{mapOrFallback(
											items.filter((item) => filterItems(item)).sort((a, b) => sortItems(a, b, sortBy, sortOrder)),
											(item, index, otherItems) => {
												let line: JSX.Element | null = null
												// The Segment separators (rules) only make sense in rundown mode
												if (sortBy === 'rundown' && index > 0 && emptyFilter) {
													if (otherItems[index - 1].segmentId !== item.segmentId) {
														line = <MediaStatusPopUpSegmentRule />
													}
												}

												const isLive =
													currentPartInstanceId !== undefined && item.partInstanceId === currentPartInstanceId
												const isNext = nextPartInstanceId !== undefined && item.partInstanceId === nextPartInstanceId

												return (
													<React.Fragment key={unprotectString(item._id)}>
														{line}
														<MediaStatusPopUpItem
															label={item.name}
															partId={item.partId}
															segmentId={item.segmentId}
															partInstanceId={item.partInstanceId}
															partIdentifier={item.partIdentifier}
															segmentIdentifier={item.segmentIdentifier}
															sourceLayerName={item.sourceLayerName}
															sourceLayerType={item.sourceLayerType}
															invalid={item.invalid}
															statusOverlay={item.pieceContentStatus?.messages
																.map((message) => translateMessage(message, t))
																.join(', ')}
															status={item.status}
															isWorkingOn={
																item.pieceContentStatus?.progress !== undefined && item.pieceContentStatus?.progress > 0
															}
															isAdLib={item.isAdLib}
															isLive={isLive}
															isNext={isNext}
														/>
													</React.Fragment>
												)
											},
											() => (
												<tr>
													<td colSpan={6} className="media-status-panel__empty-message">
														{!emptyFilter ? t('No Media matches this filter') : t('No Media required for this Rundown')}
													</td>
												</tr>
											)
										)}
									</>
								)}
							</MediaStatus>
						</tbody>
					</table>
				</div>
			</div>
		</PopUpPanel>
	)
}
