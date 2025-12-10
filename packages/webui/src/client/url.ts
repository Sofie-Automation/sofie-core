// @ts-expect-error no types defined
const MeteorInjectedSettings: any = window.__meteor_runtime_config__

export const ROOT_URL_PATH_PREFIX: string = MeteorInjectedSettings?.ROOT_URL_PATH_PREFIX ?? ''

export function relativeToSiteRootUrl(path: string): string {
	if (!ROOT_URL_PATH_PREFIX) return path

	// Preserve relative or external links
	if (!path.startsWith('/')) return path

	return ROOT_URL_PATH_PREFIX + path
}

export function createPrivateApiPath(path: string): string {
	return ROOT_URL_PATH_PREFIX + '/api/private/' + path
}
