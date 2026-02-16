/* eslint-disable n/no-process-exit */

import { Atem } from 'atem-connection'
import * as fs from 'fs'
import { AtemMediaPoolAsset, AtemMediaPoolType } from 'timeline-state-resolver'
import _ from 'underscore'
import * as path from 'path'

/**
 * This script is a temporary implementation to upload media to the atem.
 * @todo: proper atem media management
 */

const ATEM_MAX_FILENAME_LENGTH = 63
const ATEM_MAX_CLIPNAME_LENGTH = 43

function consoleLog(...args: any[]) {
	console.log('AtemUpload:', ...args)
}
function consoleError(...args: any[]) {
	console.error('AtemUpload:', ...args)
}
export class AtemUploadScript {
	private readonly connection: Atem

	constructor() {
		this.connection = new Atem()

		this.connection.on('error', consoleError)
	}

	public async connect(ip: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this.connection.once('connected', resolve)
			this.connection.connect(ip).catch(reject)
		})
	}

	public async loadFile(fileUrl: string): Promise<Buffer> {
		return new Promise<Buffer>((resolve, reject) => {
			fs.readFile(fileUrl, (e, data) => {
				consoleLog('got file')
				if (e) reject(e)
				else resolve(data)
			})
		})
	}
	public async loadFiles(folder: string): Promise<Buffer[]> {
		const files = await fs.promises.readdir(folder)
		consoleLog(files)
		const loadBuffers = files.map(async (file) => fs.promises.readFile(path.join(folder, file)))
		const buffers = Promise.all(loadBuffers)

		consoleLog('got files')
		return buffers
	}

	public checkIfFileOrClipExistsOnAtem(fileName: string, stillOrClipIndex: number, type: AtemMediaPoolType): boolean {
		consoleLog('got a file')

		const still = this.connection.state ? this.connection.state.media.stillPool[stillOrClipIndex] : undefined
		const clip = this.connection.state ? this.connection.state.media.clipPool[stillOrClipIndex] : undefined
		let pool: typeof still | typeof clip
		if (type === AtemMediaPoolType.Still) pool = still
		else if (type === AtemMediaPoolType.Clip) pool = clip

		if (pool) {
			consoleLog('has ' + type)
			if (pool.isUsed) {
				consoleLog(type + ' is used')
				const comparisonName = fileName.substr(
					type === AtemMediaPoolType.Still ? -ATEM_MAX_FILENAME_LENGTH : -ATEM_MAX_CLIPNAME_LENGTH
				)
				const poolName = 'fileName' in pool ? pool.fileName : pool.name

				if (poolName === comparisonName) {
					consoleLog('name equals')
					return true
				} else {
					return false
				}
			} else {
				return false
			}
		} else {
			consoleLog('has no still')
			throw Error('Atem appears to be missing ' + type)
		}
	}

	public async uploadStillToAtem(fileName: string, fileData: Buffer, stillIndex: number): Promise<void> {
		fileName = fileName.substr(-ATEM_MAX_FILENAME_LENGTH) // cannot be longer than 63 chars
		if (!this.checkIfFileOrClipExistsOnAtem(fileName, stillIndex, AtemMediaPoolType.Still)) {
			consoleLog(fileName + ' does not exist on ATEM')
			await this.connection.clearMediaPoolStill(stillIndex)
			await this.connection.uploadStill(stillIndex, fileData, fileName, '')
		} else {
			consoleLog(fileName + ' does exist on ATEM')
		}
	}
	public async uploadClipToAtem(name: string, fileData: Buffer[], clipIndex: number): Promise<void> {
		name = name.substr(-ATEM_MAX_CLIPNAME_LENGTH) // cannot be longer than 43 chars
		if (!this.checkIfFileOrClipExistsOnAtem(name, clipIndex, AtemMediaPoolType.Clip)) {
			consoleLog(name + ' does not exist on ATEM')
			await this.connection.clearMediaPoolClip(clipIndex)
			await this.connection.uploadClip(clipIndex, fileData, name)
		} else {
			consoleLog(name + ' does exist on ATEM')
		}
	}
}

console.log('Setup AtemUploader...')
const singleton = new AtemUploadScript()
const assets: AtemMediaPoolAsset[] = JSON.parse(process.argv[3])
singleton.connect(process.argv[2]).then(
	async () => {
		consoleLog('ATEM upload connected')

		for (const asset of assets) {
			// upload 1 by 1

			if (asset.position === undefined || isNaN(asset.position) || !_.isNumber(asset.position)) {
				console.error('Skipping due to invalid media pool ' + asset.path)
				continue
			}

			try {
				if (asset.type === AtemMediaPoolType.Still) {
					const fileData = await singleton.loadFile(asset.path)

					await singleton.uploadStillToAtem(asset.path, fileData, asset.position)
					consoleLog('uploaded ATEM media to stillpool ' + asset.position)
				} else if (asset.type === AtemMediaPoolType.Clip) {
					const fileData = await singleton.loadFiles(asset.path)

					await singleton.uploadClipToAtem(asset.path, fileData, asset.position)
					consoleLog('uploaded ATEM media to clippool ' + asset.position)
				}
			} catch (e) {
				consoleError('Failed to upload ' + asset.path)
				consoleError(e)
			}
		}

		consoleLog('All media checked/uploaded, exiting...')
		process.exit(0)
	},
	() => process.exit(-1)
)
