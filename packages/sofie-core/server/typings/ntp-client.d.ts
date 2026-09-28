export class NtpClient {
	public ntpReplyTimeout: number
	getNetworkTime(host: string, port: number, cb: (error: Error, date: Date) => void): void
}
