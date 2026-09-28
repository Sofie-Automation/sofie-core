declare module 'ntp-client' {
	interface NtpClient {
		ntpReplyTimeout: number
		getNetworkTime(host: string, port: number, cb: (error: Error, date: Date) => void): void
	}

	const ntpClient: NtpClient
	export default ntpClient
}
