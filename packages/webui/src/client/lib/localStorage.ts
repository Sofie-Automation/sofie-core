import {
	setReportNotifications as libSetReportNotifications,
	getReportNotifications as libGetReportNotifications,
} from './notifications/notifications.js'

export enum LocalStorageProperty {
	STUDIO = 'studioMode',
	CONFIGURE = 'configureMode',
	DEVELOPER = 'developerMode',
	TESTING = 'testingMode',
	SPEAKING = 'speakingMode',
	VIBRATING = 'vibratingMode',
	SERVICE = 'serviceMode',
	SHELF_FOLLOWS_ON_AIR = 'shelfFollowsOnAir',
	SHOW_HIDDEN_SOURCE_LAYERS = 'showHiddenSourceLayers',
	IGNORE_PIECE_CONTENT_STATUS = 'ignorePieceContentStatus',
	UI_ZOOM_LEVEL = 'uiZoomLevel',
	HELP_MODE = 'helpMode',
	LOG_NOTIFICATIONS = 'logNotifications',
	PROTO_ONE_PART_PER_LINE = 'proto:onePartPerLine',
}

const GUI_FLAGS: {
	[key in LocalStorageProperty]?: string | null
} = {}

function localStorageGetCachedItem(key: LocalStorageProperty): string | null {
	const cacheHit = GUI_FLAGS[key]
	if (cacheHit !== undefined) {
		return cacheHit
	}

	const uncachedVal = localStorage.getItem(key)
	GUI_FLAGS[key] = uncachedVal
	return uncachedVal
}

function localStorageSetCachedItem(key: LocalStorageProperty, value: string): void {
	GUI_FLAGS[key] = value
	localStorage.setItem(key, value)
}
function localStorageUnsetCachedItem(key: LocalStorageProperty): void {
	GUI_FLAGS[key] = null
	localStorage.removeItem(key)
}

export function setAllowStudio(studioMode: boolean): void {
	localStorageSetCachedItem(LocalStorageProperty.STUDIO, studioMode ? '1' : '0')
}
export function getLocalAllowStudio(): boolean {
	return localStorageGetCachedItem(LocalStorageProperty.STUDIO) === '1'
}

export function setAllowConfigure(configureMode: boolean): void {
	localStorageSetCachedItem(LocalStorageProperty.CONFIGURE, configureMode ? '1' : '0')
}
export function getLocalAllowConfigure(): boolean {
	return localStorageGetCachedItem(LocalStorageProperty.CONFIGURE) === '1'
}

export function setAllowService(serviceMode: boolean): void {
	localStorageSetCachedItem(LocalStorageProperty.SERVICE, serviceMode ? '1' : '0')
}
export function getLocalAllowService(): boolean {
	return localStorageGetCachedItem(LocalStorageProperty.SERVICE) === '1'
}

export function setAllowDeveloper(developerMode: boolean): void {
	localStorageSetCachedItem(LocalStorageProperty.DEVELOPER, developerMode ? '1' : '0')
}
export function getLocalAllowDeveloper(): boolean {
	return localStorageGetCachedItem(LocalStorageProperty.DEVELOPER) === '1'
}

export function setAllowTesting(testingMode: boolean): void {
	localStorageSetCachedItem(LocalStorageProperty.TESTING, testingMode ? '1' : '0')
}
export function getLocalAllowTesting(): boolean {
	return localStorageGetCachedItem(LocalStorageProperty.TESTING) === '1'
}

// GUI features: ----------------------------------

export function setAllowSpeaking(speakingMode: boolean): void {
	localStorageSetCachedItem(LocalStorageProperty.SPEAKING, speakingMode ? '1' : '0')
}
export function getAllowSpeaking(): boolean {
	return localStorageGetCachedItem(LocalStorageProperty.SPEAKING) === '1'
}

export function setAllowVibrating(vibratingMode: boolean): void {
	localStorageSetCachedItem(LocalStorageProperty.VIBRATING, vibratingMode ? '1' : '0')
}
export function getAllowVibrating(): boolean {
	return localStorageGetCachedItem(LocalStorageProperty.VIBRATING) === '1'
}

export function setHelpMode(helpMode: boolean): void {
	localStorageSetCachedItem(LocalStorageProperty.HELP_MODE, helpMode ? '1' : '0')
}

export function getHelpMode(): boolean {
	return localStorageGetCachedItem(LocalStorageProperty.HELP_MODE) === '1'
}

export function setUIZoom(uiZoomLevel: number): void {
	localStorageSetCachedItem(LocalStorageProperty.UI_ZOOM_LEVEL, uiZoomLevel + '')
}

export function getUIZoom(): number {
	return parseFloat(localStorageGetCachedItem(LocalStorageProperty.UI_ZOOM_LEVEL) || '1') || 1
}

export function setShowHiddenSourceLayers(show: boolean): void {
	localStorageSetCachedItem(LocalStorageProperty.SHOW_HIDDEN_SOURCE_LAYERS, show ? '1' : '0')
}
export function getShowHiddenSourceLayers(): boolean {
	return localStorageGetCachedItem(LocalStorageProperty.SHOW_HIDDEN_SOURCE_LAYERS) === '1'
}

export function setIgnorePieceContentStatus(show: boolean): void {
	localStorageSetCachedItem(LocalStorageProperty.IGNORE_PIECE_CONTENT_STATUS, show ? '1' : '0')
}
export function getIgnorePieceContentStatus(): boolean {
	return localStorageGetCachedItem(LocalStorageProperty.IGNORE_PIECE_CONTENT_STATUS) === '1'
}

export function setShelfFollowsOnAir(followOnAir: boolean): void {
	localStorageSetCachedItem(LocalStorageProperty.SHELF_FOLLOWS_ON_AIR, followOnAir ? '1' : '0')
}
export function getShelfFollowsOnAir(): boolean {
	// follows on air === true is the default
	return localStorageGetCachedItem(LocalStorageProperty.SHELF_FOLLOWS_ON_AIR) !== '0'
}

export function setReportNotifications(logNotifications: string): void {
	libSetReportNotifications(logNotifications)
	localStorageSetCachedItem(LocalStorageProperty.LOG_NOTIFICATIONS, logNotifications)
}
export function unsetReportNotifications(): void {
	libSetReportNotifications(null)
	localStorageUnsetCachedItem(LocalStorageProperty.LOG_NOTIFICATIONS)
}
export function getReportNotifications(): string | null {
	return libGetReportNotifications()
}
