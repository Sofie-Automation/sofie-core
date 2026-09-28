import _ from 'underscore'

const REVERSE_PROXY_COUNT = process.env.HTTP_FORWARDED_COUNT ? parseInt(process.env.HTTP_FORWARDED_COUNT) : 0

// X-Forwarded-For (a de-facto standard) has the following syntax by convention
// X-Forwarded-For: 203.0.113.195, 2001:db8:85a3:8d3:1319:8a2e:370:7348
// X-Forwarded-For: 203.0.113.195,2001:db8:85a3:8d3:1319:8a2e:370:7348,198.51.100.178
function getClientAddrFromXForwarded(headerVal: undefined | string | string[]): string | undefined {
	if (headerVal === undefined) return undefined
	if (typeof headerVal !== 'string') {
		headerVal = _.last(headerVal) as string
	}
	const remoteAddresses = headerVal.split(',')
	return remoteAddresses[remoteAddresses.length - REVERSE_PROXY_COUNT]?.trim() ?? remoteAddresses[0]?.trim()
}

// Forwarded uses the following syntax:
// Forwarded: for=192.0.2.60;proto=http;by=203.0.113.43
// Forwarded: for=192.0.2.43, for="[2001:db8:cafe::17]"
function getClientAddrFromForwarded(forwardedVal: string | string[] | undefined): string | undefined {
	if (forwardedVal === undefined) return undefined
	if (typeof forwardedVal !== 'string') {
		forwardedVal = _.last(forwardedVal) as string
	}
	const allProxies = forwardedVal.split(',')
	const proxyInfo = allProxies[allProxies.length - REVERSE_PROXY_COUNT] ?? allProxies[0]
	const directives = proxyInfo?.trim().split(';')
	for (const directive of directives) {
		let match: RegExpMatchArray | null
		if ((match = directive.trim().match(/^for=("\[)?([\w.:]+)(\]")?/))) {
			return match[2]
		}
	}
	return undefined
}

/**
 * Determine the "world-facing" client IP from request headers.
 *
 * This replicates Meteor behaviour, which uses the `HTTP_FORWARDED_COUNT` env var to extract the
 * client IP from the `Forwarded` / `X-Forwarded-For` headers, falling back to the socket address.
 * Shared between the Koa (REST) and the standalone DDP transports so both report addresses identically.
 */
export function getClientAddress(
	headers: { forwarded?: string | string[]; 'x-forwarded-for'?: string | string[] },
	socketRemoteAddress: string | undefined
): string {
	return (
		getClientAddrFromForwarded(headers.forwarded) ||
		getClientAddrFromXForwarded(headers['x-forwarded-for']) ||
		socketRemoteAddress ||
		'unknown'
	)
}
