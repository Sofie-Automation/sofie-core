import { PackageInfo } from '../../coreSystem'
import { initInfluxdb } from '@sofie-automation/corelib/dist/influxdb'
export { startTrace, endTrace, sendTrace, TimeTrace, FinishedTrace } from '@sofie-automation/corelib/dist/influxdb'

const config = {
	host: process.env.INFLUX_HOST,
	database: process.env.INFLUX_DATABASE || 'sofie',
	port: Number(process.env.INFLUX_PORT) || 8086,
	user: process.env.INFLUX_USER || 'sofie',
	password: process.env.INFLUX_PASSWORD,
}

initInfluxdb(config, getVersions())

function getVersions(): Record<string, string> {
	const versions: { [packageName: string]: string } = {}

	versions['coreVersion'] = PackageInfo.versionExtended || PackageInfo.version // package version

	return versions
}
