import { useCallback, useEffect, useMemo, useRef, useState, JSX, CSSProperties } from 'react'
import {
	MediaStatus as MediaStatusComponent,
	MediaStatusListItem as IMediaStatusListItem,
	sortItems,
	SortBy,
	SortOrder,
} from '../../MediaStatus/MediaStatus'
import { useSubscription, useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { RundownPlaylists } from '../../../collections'
import { Spinner } from '../../../lib/Spinner'
import { MediaStatusListItem } from './MediaStatusListItem'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { useTranslation } from 'react-i18next'
import { MediaStatusListHeader } from './MediaStatusListHeader'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes } from '@fortawesome/free-solid-svg-icons'
import { mapOrFallback, useDebounce } from '../../../lib/lib'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'

export function MediaStatus(): JSX.Element | null {
	const scrollBox = useRef<HTMLDivElement>(null)
	const [offsetTop, setOffsetTop] = useState(0)

	const [sortBy, setSortBy] = useState<'rundown' | 'status' | 'sourceLayer' | 'name'>('rundown')
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
	const [filter, setFilter] = useState('')
	const debouncedFilter = useDebounce(filter, 100)

	const playlistIds = useTracker(() => RundownPlaylists.find({}).map((playlist) => playlist._id), [], [])

	function onChangeSort(sortBy: SortBy, sortOrder: SortOrder) {
		setSortOrder(sortOrder === 'inactive' ? 'asc' : sortOrder)
		setSortBy(sortBy)
	}

	useSubscription(CorelibPubSub.rundownPlaylists, null, null)

	const { t } = useTranslation()

	useEffect(() => {
		if (!scrollBox.current) return

		setOffsetTop(scrollBox.current.offsetTop)
	}, [])

	const emptyFilter = !debouncedFilter || debouncedFilter.trim().length === 0

	const filterItems = useCallback(
		(item: IMediaStatusListItem) => {
			if (emptyFilter) return true
			if (item.name.toLowerCase().indexOf(debouncedFilter.toLowerCase().trim()) >= 0) return true
			if ((item.partIdentifier?.toLocaleLowerCase() ?? '').indexOf(debouncedFilter.toLowerCase().trim()) === 0)
				return true
			if ((item.segmentIdentifier?.toLocaleLowerCase() ?? '').indexOf(debouncedFilter.toLowerCase().trim()) === 0)
				return true
			return false
		},
		[debouncedFilter, emptyFilter]
	)

	const scrollBoxStyle = useMemo<CSSProperties>(
		() => ({
			maxHeight: offsetTop ? `calc(100vh - ${offsetTop}px)` : undefined,
		}),
		[offsetTop]
	)

	return (
		<div className="mhl gutter">
			<header className="mbs">
				<div className="media-status-table-search">
					<input
						className="media-status-table-search__search-input"
						type="search"
						value={filter}
						placeholder="Filter…"
						onChange={(e) => setFilter(e.target.value)}
					/>
					{filter && (
						<div className="media-status-table-search__clear-search-input" onClick={() => setFilter('')}>
							<FontAwesomeIcon icon={faTimes} />
						</div>
					)}
				</div>
				<h1>{t('Media Status')}</h1>
			</header>
			<div className="media-status-table-scrollbox mlm prs" ref={scrollBox} style={scrollBoxStyle}>
				<table className="media-status-table mbl">
					<MediaStatusListHeader sortOrder={sortOrder} sortBy={sortBy} onChange={onChangeSort} />
					<tbody>
						<MediaStatusComponent
							playlistIds={playlistIds}
							fallback={
								<tr>
									<td colSpan={6} className="media-status-list-message">
										<Spinner />
									</td>
								</tr>
							}
						>
							{(items) => (
								<>
									{mapOrFallback(
										items.filter((item) => filterItems(item)).sort((a, b) => sortItems(a, b, sortBy, sortOrder)),
										(item) => (
											<MediaStatusListItem
												rundownName={item.playlistName}
												rundownTo={`/rundown/${item.playlistId}`}
												status={item.status}
												isWorkingOn={
													item.pieceContentStatus?.progress !== undefined && item.pieceContentStatus?.progress > 0
												}
												statusOverlay={item.pieceContentStatus?.messages
													.map((message) => translateMessage(message, t))
													.join(', ')}
												sourceLayerType={item.sourceLayerType}
												sourceLayerName={item.sourceLayerName}
												partIdentifier={item.partIdentifier}
												segmentIdentifier={item.segmentIdentifier}
												invalid={item.invalid}
												key={unprotectString(item._id)}
												label={item.name}
												duration={item.duration}
											/>
										),
										() => (
											<tr>
												<td colSpan={6} className="media-status-list-message">
													{emptyFilter ? t('No Media required by this system') : t('No Media matches this filter')}
												</td>
											</tr>
										)
									)}
								</>
							)}
						</MediaStatusComponent>
					</tbody>
				</table>
			</div>
		</div>
	)
}
