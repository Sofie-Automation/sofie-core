import { WorkerId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { getWorkerId, WorkerStatus } from '@sofie-automation/meteor-lib/dist/collections/Workers'
import { getCurrentTime } from '../lib/lib'
import { Workers } from '../collections'

export async function initializeWorkerStatus(name: string, instanceId: string): Promise<WorkerId> {
	const workerId = getWorkerId()

	const now = getCurrentTime()

	const initWorkerProperties = {
		name: name,
		connected: false,
		instanceId: instanceId,
		startTime: now,
		lastUpdatedTime: now,
		status: 'Starting...',
	}

	const existing = await Workers.findOneAsync(workerId)
	if (existing) {
		await Workers.updateAsync(workerId, {
			$set: initWorkerProperties,
		})
		localWorkerCache.set(workerId, {
			...existing,
			...initWorkerProperties,
		})
	} else {
		const newWorkerStatus = {
			...initWorkerProperties,
			_id: workerId,
			createdTime: now,
			lastUsedTime: now,
		}
		await Workers.insertAsync(newWorkerStatus)
		localWorkerCache.set(workerId, newWorkerStatus)
	}

	return workerId
}
export async function setWorkerStatus(
	workerId: WorkerId,
	connected: boolean,
	status: string,
	startup?: boolean
): Promise<void> {
	const now = getCurrentTime()

	const mod: Partial<WorkerStatus> = {
		lastUpdatedTime: now,
		connected,
		status,
	}
	if (startup) {
		mod.startTime = now
	}
	const result = await Workers.updateAsync(workerId, {
		$set: mod,
	})

	if (result > 0) {
		await updateLocalCache(workerId, mod)
	}
}

const localWorkerCache = new Map<WorkerId, WorkerStatus>()
/** Returns the workerStatus, possibly from a local cache */
async function getWorkerStatus(workerId: WorkerId): Promise<WorkerStatus | undefined> {
	// Use local cache:
	const cached = localWorkerCache.get(workerId)
	if (cached) return cached

	// Fetch from database:
	const workerStatus = await Workers.findOneAsync(workerId)

	// Update local cache:
	if (workerStatus) {
		localWorkerCache.set(workerId, workerStatus)
	} else {
		localWorkerCache.delete(workerId)
	}
	return workerStatus
}
async function updateLocalCache(workerId: WorkerId, mod: Partial<WorkerStatus>) {
	const cache = await getWorkerStatus(workerId)
	if (cache) {
		localWorkerCache.set(workerId, {
			...cache,
			...mod,
		})
	}
}
