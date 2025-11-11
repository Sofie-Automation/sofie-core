import { getSystemVersion } from './lib/index.js'
import { initInfluxdb } from '@sofie-automation/corelib/dist/influxdb'

const config = {
	host: process.env.INFLUX_HOST,
	database: process.env.INFLUX_DATABASE || 'sofie',
	port: parseInt(process.env.INFLUX_PORT + '') || 8086,
	user: process.env.INFLUX_USER || 'sofie',
	password: process.env.INFLUX_PASSWORD,
}

export function setupInfluxDb(): void {
	const versions: { [packageName: string]: string } = {
		'job-worker': getSystemVersion(),
	}

	initInfluxdb(config, versions)
}
