import '../../../__mocks__/_extendJest'
import { waitTime } from '../../../__mocks__/helpers/jest'
import { WorkerJobQueueManager } from '../jobQueue'

// Mock Meteor.defer to run synchronously for testing
jest.mock('meteor/meteor', () => ({
	Meteor: {
		defer: (fn: () => void) => {
			// Run deferred functions immediately in tests
			setTimeout(fn, 0)
		},
	},
}))

// Mock the logging module
jest.mock('../../logging')

// Mock getCurrentTime
const mockCurrentTime = jest.fn(() => Date.now())
jest.mock('../../lib/lib', () => ({
	getCurrentTime: () => mockCurrentTime(),
}))

describe('WorkerJobQueueManager', () => {
	let manager: WorkerJobQueueManager

	beforeEach(() => {
		manager = new WorkerJobQueueManager()
		mockCurrentTime.mockReturnValue(Date.now())
	})

	afterEach(() => {
		jest.clearAllMocks()
	})

	describe('queueJobWithoutResult', () => {
		it('should queue a job in the high priority queue by default', async () => {
			const queueName = 'testQueue'
			const jobName = 'testJob'
			const jobData = { foo: 'bar' }

			await manager.queueJobWithoutResult(queueName, jobName, jobData, undefined)

			// Verify job is retrievable
			const job = await manager.getNextJob(queueName)
			expect(job).not.toBeNull()
			expect(job?.name).toBe(jobName)
			expect(job?.data).toEqual(jobData)
		})

		it('should queue a job in the low priority queue when lowPriority is true', async () => {
			const queueName = 'testQueue'
			const jobName = 'testJob'
			const jobData = { foo: 'bar' }

			await manager.queueJobWithoutResult(queueName, jobName, jobData, { lowPriority: true })

			// Verify job is retrievable
			const job = await manager.getNextJob(queueName)
			expect(job).not.toBeNull()
			expect(job?.name).toBe(jobName)
		})

		it('should prioritize high priority jobs over low priority jobs', async () => {
			const queueName = 'testQueue'

			// Queue low priority job first
			await manager.queueJobWithoutResult(queueName, 'lowPriorityJob', { priority: 'low' }, { lowPriority: true })

			// Queue high priority job second
			await manager.queueJobWithoutResult(queueName, 'highPriorityJob', { priority: 'high' }, undefined)

			// First job retrieved should be high priority
			const firstJob = await manager.getNextJob(queueName)
			expect(firstJob?.name).toBe('highPriorityJob')

			// Second job retrieved should be low priority
			const secondJob = await manager.getNextJob(queueName)
			expect(secondJob?.name).toBe('lowPriorityJob')
		})
	})

	describe('queueJobAndWrapResult', () => {
		it('should return a WorkerJob with complete and getTimings promises', async () => {
			const queueName = 'testQueue'
			const jobName = 'testJob'
			const jobData = { foo: 'bar' }
			const now = Date.now()

			const workerJob = manager.queueJobAndWrapResult(queueName, jobName, jobData, now)

			expect(workerJob).toHaveProperty('complete')
			expect(workerJob).toHaveProperty('getTimings')
			expect(workerJob.complete).toBeInstanceOf(Promise)
			expect(workerJob.getTimings).toBeInstanceOf(Promise)
		})

		it('should resolve complete promise with result when job finishes successfully', async () => {
			const queueName = 'testQueue'
			const jobName = 'testJob'
			const jobData = { foo: 'bar' }
			const now = Date.now()
			const expectedResult = { success: true }

			const workerJob = manager.queueJobAndWrapResult<typeof expectedResult>(queueName, jobName, jobData, now)

			// Get the job from queue
			const job = await manager.getNextJob(queueName)
			expect(job).not.toBeNull()

			// Simulate job completion
			const startedTime = now + 100
			const finishedTime = now + 200
			await manager.jobFinished(job!.id, startedTime, finishedTime, null, expectedResult)

			// Wait for the deferred callback
			await waitTime(10)

			// Verify result
			const result = await workerJob.complete
			expect(result).toEqual(expectedResult)
		})

		it('should reject complete promise when job finishes with error', async () => {
			const queueName = 'testQueue'
			const jobName = 'testJob'
			const jobData = { foo: 'bar' }
			const now = Date.now()

			const workerJob = manager.queueJobAndWrapResult(queueName, jobName, jobData, now)

			// Add catch handler to avoid unhandled rejection
			workerJob.complete.catch(() => {
				// Expected rejection
			})

			// Get the job from queue
			const job = await manager.getNextJob(queueName)
			expect(job).not.toBeNull()

			// Simulate job failure
			const startedTime = now + 100
			const finishedTime = now + 200
			await manager.jobFinished(job!.id, startedTime, finishedTime, 'Job failed', null)

			// Wait for the deferred callback
			await waitTime(10)

			// Verify error - the error message is wrapped in an Error object
			await expect(workerJob.complete).rejects.toBeInstanceOf(Error)
		})

		it('should resolve getTimings promise with correct timing information', async () => {
			const queueName = 'testQueue'
			const jobName = 'testJob'
			const jobData = { foo: 'bar' }
			const queueTime = 1000
			const startedTime = 1100
			const finishedTime = 1200
			const completedTime = 1250

			mockCurrentTime.mockReturnValue(completedTime)

			const workerJob = manager.queueJobAndWrapResult(queueName, jobName, jobData, queueTime)

			// Get the job from queue
			const job = await manager.getNextJob(queueName)
			expect(job).not.toBeNull()

			// Simulate job completion
			await manager.jobFinished(job!.id, startedTime, finishedTime, null, { result: 'ok' })

			// Wait for the deferred callback
			await waitTime(10)

			// Verify timings
			const timings = await workerJob.getTimings
			expect(timings.queueTime).toBe(queueTime)
			expect(timings.startedTime).toBe(startedTime)
			expect(timings.finishedTime).toBe(finishedTime)
			expect(timings.completedTime).toBe(completedTime)
		})
	})

	describe('getNextJob', () => {
		it('should return null when no jobs are queued', async () => {
			const job = await manager.getNextJob('emptyQueue')
			expect(job).toBeNull()
		})

		it('should return jobs in FIFO order within same priority', async () => {
			const queueName = 'testQueue'

			await manager.queueJobWithoutResult(queueName, 'job1', { order: 1 }, undefined)
			await manager.queueJobWithoutResult(queueName, 'job2', { order: 2 }, undefined)
			await manager.queueJobWithoutResult(queueName, 'job3', { order: 3 }, undefined)

			const firstJob = await manager.getNextJob(queueName)
			expect(firstJob?.name).toBe('job1')

			const secondJob = await manager.getNextJob(queueName)
			expect(secondJob?.name).toBe('job2')

			const thirdJob = await manager.getNextJob(queueName)
			expect(thirdJob?.name).toBe('job3')

			const noJob = await manager.getNextJob(queueName)
			expect(noJob).toBeNull()
		})
	})

	describe('waitForNextJob', () => {
		it('should resolve immediately if jobs are already queued', async () => {
			const queueName = 'testQueue'

			await manager.queueJobWithoutResult(queueName, 'existingJob', {}, undefined)

			// Should resolve without waiting
			await expect(manager.waitForNextJob(queueName)).resolves.toBeUndefined()
		})

		it('should wait for a job to be queued', async () => {
			const queueName = 'testQueue'

			// Start waiting for a job
			const waitPromise = manager.waitForNextJob(queueName)

			// Queue a job after a short delay
			setTimeout(async () => {
				await manager.queueJobWithoutResult(queueName, 'newJob', {}, undefined)
			}, 10)

			// Wait should resolve once job is queued
			await expect(waitPromise).resolves.toBeUndefined()
		})

		it('should reject old worker when new worker starts waiting', async () => {
			const queueName = 'testQueue'

			// First worker starts waiting
			const firstWaitPromise = manager.waitForNextJob(queueName)

			// Add catch handler to prevent unhandled rejection warning
			firstWaitPromise.catch(() => {
				// Expected rejection
			})

			// Second worker starts waiting, should reject first
			const secondWaitPromise = manager.waitForNextJob(queueName)

			// Wait for deferred rejection
			await waitTime(10)

			// First worker should be rejected
			await expect(firstWaitPromise).rejects.toThrow('new workerThread, replacing the old')

			// Queue a job for second worker
			await manager.queueJobWithoutResult(queueName, 'job', {}, undefined)

			// Wait for deferred notification
			await waitTime(10)

			// Second worker should resolve
			await expect(secondWaitPromise).resolves.toBeUndefined()
		})
	})

	describe('interruptJobStream', () => {
		it('should resolve waiting worker', async () => {
			const queueName = 'testQueue'

			// Start waiting for a job
			const waitPromise = manager.waitForNextJob(queueName)

			// Interrupt the queue
			await manager.interruptJobStream(queueName)

			// Wait for deferred resolution
			await waitTime(10)

			// Wait should resolve
			await expect(waitPromise).resolves.toBeUndefined()
		})

		it('should push null job if no worker is waiting', async () => {
			const queueName = 'testQueue'

			// Interrupt without any worker waiting
			await manager.interruptJobStream(queueName)

			// Next worker should get null immediately (handled in getNextJob)
			// But waitForNextJob should return immediately as there's a null job in queue
			await expect(manager.waitForNextJob(queueName)).resolves.toBeUndefined()
		})
	})

	describe('rejectAllRunning', () => {
		it('should reject all running jobs with error', async () => {
			const queueName = 'testQueue'

			// Queue multiple jobs
			const job1 = manager.queueJobAndWrapResult(queueName, 'job1', {}, Date.now())
			const job2 = manager.queueJobAndWrapResult(queueName, 'job2', {}, Date.now())

			// Get jobs from queue (marks them as running)
			await manager.getNextJob(queueName)
			await manager.getNextJob(queueName)

			// Reject all running
			manager.rejectAllRunning()

			// Both jobs should be rejected
			await expect(job1.complete).rejects.toThrow('Thread closed')
			await expect(job2.complete).rejects.toThrow('Thread closed')
		})
	})

	describe('debounce', () => {
		it('should skip queueing duplicate job when debounce is enabled', async () => {
			const queueName = 'testQueue'
			const jobName = 'debounceJob'
			const jobData = { foo: 'bar' }
			const startTime = Date.now()

			mockCurrentTime.mockReturnValue(startTime)

			// Queue first job with debounce
			await manager.queueJobWithoutResult(queueName, jobName, jobData, { debounce: 1000 })

			// Queue identical job with debounce
			await manager.queueJobWithoutResult(queueName, jobName, jobData, { debounce: 1000 })

			// Advance time past debounce
			mockCurrentTime.mockReturnValue(startTime + 1001)

			// Only one job should be in the queue
			const firstJob = await manager.getNextJob(queueName)
			expect(firstJob?.name).toBe(jobName)

			const secondJob = await manager.getNextJob(queueName)
			expect(secondJob).toBeNull()
		})

		it('should allow queueing different job names even with debounce', async () => {
			const queueName = 'testQueue'
			const jobData = { foo: 'bar' }
			const startTime = Date.now()

			mockCurrentTime.mockReturnValue(startTime)

			await manager.queueJobWithoutResult(queueName, 'job1', jobData, { debounce: 1000 })
			await manager.queueJobWithoutResult(queueName, 'job2', jobData, { debounce: 1000 })

			// Advance time past debounce
			mockCurrentTime.mockReturnValue(startTime + 1001)

			const firstJob = await manager.getNextJob(queueName)
			expect(firstJob?.name).toBe('job1')

			const secondJob = await manager.getNextJob(queueName)
			expect(secondJob?.name).toBe('job2')
		})

		it('should allow queueing same job name with different data even with debounce', async () => {
			const queueName = 'testQueue'
			const jobName = 'debounceJob'
			const startTime = Date.now()

			mockCurrentTime.mockReturnValue(startTime)

			await manager.queueJobWithoutResult(queueName, jobName, { value: 1 }, { debounce: 1000 })
			await manager.queueJobWithoutResult(queueName, jobName, { value: 2 }, { debounce: 1000 })

			// Advance time past debounce
			mockCurrentTime.mockReturnValue(startTime + 1001)

			const firstJob = await manager.getNextJob(queueName)
			expect(firstJob?.name).toBe(jobName)
			expect(firstJob?.data).toEqual({ value: 1 })

			const secondJob = await manager.getNextJob(queueName)
			expect(secondJob?.name).toBe(jobName)
			expect(secondJob?.data).toEqual({ value: 2 })
		})

		it('should queue job without debounce flag even if identical job exists', async () => {
			const queueName = 'testQueue'
			const jobName = 'testJob'
			const jobData = { foo: 'bar' }
			const startTime = Date.now()

			mockCurrentTime.mockReturnValue(startTime)

			// Queue with debounce
			await manager.queueJobWithoutResult(queueName, jobName, jobData, { debounce: 1000 })

			// Queue without debounce - should still be added (and available immediately)
			await manager.queueJobWithoutResult(queueName, jobName, jobData, undefined)

			// The non-debounced job should be available immediately
			const firstJob = await manager.getNextJob(queueName)
			expect(firstJob?.name).toBe(jobName)

			// The debounced job is not ready yet
			const noJobYet = await manager.getNextJob(queueName)
			expect(noJobYet).toBeNull()

			// Advance time past debounce
			mockCurrentTime.mockReturnValue(startTime + 1001)

			const secondJob = await manager.getNextJob(queueName)
			expect(secondJob?.name).toBe(jobName)
		})

		it('should allow re-queueing job after original is consumed', async () => {
			const queueName = 'testQueue'
			const jobName = 'debounceJob'
			const jobData = { foo: 'bar' }

			// Queue first job with debounce
			await manager.queueJobWithoutResult(queueName, jobName, jobData, { debounce: 1000 })

			// Consume the job - need to wait for debounce time first
			mockCurrentTime.mockReturnValue(Date.now() + 1001)
			const firstJob = await manager.getNextJob(queueName)
			expect(firstJob?.name).toBe(jobName)

			// Queue same job again with debounce - should work since original was consumed
			await manager.queueJobWithoutResult(queueName, jobName, jobData, { debounce: 1000 })

			mockCurrentTime.mockReturnValue(Date.now() + 2002)
			const secondJob = await manager.getNextJob(queueName)
			expect(secondJob?.name).toBe(jobName)
		})

		it('should debounce across priority queues - high to low', async () => {
			const queueName = 'testQueue'
			const jobName = 'debounceJob'
			const jobData = { foo: 'bar' }

			// Queue in high priority with debounce
			await manager.queueJobWithoutResult(queueName, jobName, jobData, { debounce: 1000 })

			// Try to queue identical in low priority with debounce - should be debounced
			await manager.queueJobWithoutResult(queueName, jobName, jobData, { debounce: 1000, lowPriority: true })

			// Wait for debounce time
			mockCurrentTime.mockReturnValue(Date.now() + 1001)

			// Only one job should exist (still in high priority)
			const firstJob = await manager.getNextJob(queueName)
			expect(firstJob?.name).toBe(jobName)

			const secondJob = await manager.getNextJob(queueName)
			expect(secondJob).toBeNull()
		})

		it('should debounce across priority queues - low to high with priority upgrade', async () => {
			const queueName = 'testQueue'
			const jobName = 'debounceJob'
			const jobData = { foo: 'bar' }

			// Queue in low priority with debounce
			await manager.queueJobWithoutResult(queueName, jobName, jobData, { debounce: 1000, lowPriority: true })

			// Try to queue identical in high priority with debounce - should upgrade existing job
			await manager.queueJobWithoutResult(queueName, jobName, jobData, { debounce: 1000 })

			// Wait for debounce time
			mockCurrentTime.mockReturnValue(Date.now() + 1001)

			// Only one job should exist (upgraded to high priority)
			const firstJob = await manager.getNextJob(queueName)
			expect(firstJob?.name).toBe(jobName)

			const secondJob = await manager.getNextJob(queueName)
			expect(secondJob).toBeNull()
		})

		it('should prioritize upgraded job over other low priority jobs', async () => {
			const queueName = 'testQueue'
			const jobName = 'debounceJob'
			const jobData = { foo: 'bar' }

			// Queue a low priority job first
			await manager.queueJobWithoutResult(queueName, jobName, jobData, { debounce: 1000, lowPriority: true })

			// Queue another low priority job
			await manager.queueJobWithoutResult(
				queueName,
				'otherLowPriorityJob',
				{ other: true },
				{ lowPriority: true }
			)

			// Upgrade the first job to high priority
			await manager.queueJobWithoutResult(queueName, jobName, jobData, { debounce: 1000 })

			// Wait for debounce time
			mockCurrentTime.mockReturnValue(Date.now() + 1001)

			// First job retrieved should be the upgraded one (now high priority)
			const firstJob = await manager.getNextJob(queueName)
			expect(firstJob?.name).toBe(jobName)

			// Second should be the other low priority job
			const secondJob = await manager.getNextJob(queueName)
			expect(secondJob?.name).toBe('otherLowPriorityJob')
		})

		it('should respect debounce timing - getNextJob ignores jobs before notBefore', async () => {
			const queueName = 'testQueue'
			const jobName = 'debounceJob'
			const jobData = { foo: 'bar' }
			const debounceTime = 100
			const startTime = Date.now()

			mockCurrentTime.mockReturnValue(startTime)

			// Queue job with debounce
			await manager.queueJobWithoutResult(queueName, jobName, jobData, { debounce: debounceTime })

			// Job should not be available yet (before notBefore)
			const jobBefore = await manager.getNextJob(queueName)
			expect(jobBefore).toBeNull()

			// Advance time past debounce
			mockCurrentTime.mockReturnValue(startTime + debounceTime + 1)

			// Job should now be available
			const jobAfter = await manager.getNextJob(queueName)
			expect(jobAfter?.name).toBe(jobName)
		})

		it('should respect debounce timing - waitForNextJob considers notBefore', async () => {
			const queueName = 'testQueue'
			const jobName = 'debounceJob'
			const jobData = { foo: 'bar' }
			const debounceTime = 100
			const startTime = Date.now()

			mockCurrentTime.mockReturnValue(startTime)

			// Queue job with debounce
			await manager.queueJobWithoutResult(queueName, jobName, jobData, { debounce: debounceTime })

			// waitForNextJob should wait (no ready jobs) - start waiting
			const waitPromise = manager.waitForNextJob(queueName)

			// Advance time past debounce - this should trigger the timer and resolve the wait
			mockCurrentTime.mockReturnValue(startTime + debounceTime + 1)

			// Wait a bit for the timer to fire
			await waitTime(debounceTime + 50)

			// The wait should have resolved
			await expect(waitPromise).resolves.toBeUndefined()

			// And the job should now be available
			const job = await manager.getNextJob(queueName)
			expect(job?.name).toBe(jobName)
		})

		it('should allow duplicate job after debounce time expires and job is consumed', async () => {
			const queueName = 'testQueue'
			const jobName = 'debounceJob'
			const jobData = { foo: 'bar' }
			const debounceTime = 100
			const startTime = Date.now()

			mockCurrentTime.mockReturnValue(startTime)

			// Queue first job with debounce
			await manager.queueJobWithoutResult(queueName, jobName, jobData, { debounce: debounceTime })

			// Advance time past debounce and consume the job
			mockCurrentTime.mockReturnValue(startTime + debounceTime + 1)
			const firstJob = await manager.getNextJob(queueName)
			expect(firstJob?.name).toBe(jobName)

			// Queue same job again - should work since original was consumed
			await manager.queueJobWithoutResult(queueName, jobName, jobData, { debounce: debounceTime })

			// Advance time past second debounce
			mockCurrentTime.mockReturnValue(startTime + 2 * debounceTime + 2)
			const secondJob = await manager.getNextJob(queueName)
			expect(secondJob?.name).toBe(jobName)
		})

		it('should extend debounce window (notBefore) on subsequent debounce calls', async () => {
			const queueName = 'testQueue'
			const jobName = 'debounceJob'
			const jobData = { foo: 'bar' }
			const debounceTime = 100
			const startTime = Date.now()

			mockCurrentTime.mockReturnValue(startTime)

			// Queue first job with debounce - notBefore = startTime + 100
			await manager.queueJobWithoutResult(queueName, jobName, jobData, { debounce: debounceTime })

			// After 50ms, queue duplicate - should extend notBefore to startTime + 150
			mockCurrentTime.mockReturnValue(startTime + 50)
			await manager.queueJobWithoutResult(queueName, jobName, jobData, { debounce: debounceTime })

			// At startTime + 110, job should NOT be ready (extended to 150)
			mockCurrentTime.mockReturnValue(startTime + 110)
			const jobTooEarly = await manager.getNextJob(queueName)
			expect(jobTooEarly).toBeNull()

			// At startTime + 151, job should be ready
			mockCurrentTime.mockReturnValue(startTime + 151)
			const jobReady = await manager.getNextJob(queueName)
			expect(jobReady?.name).toBe(jobName)

			// Should only be one job
			const noMoreJobs = await manager.getNextJob(queueName)
			expect(noMoreJobs).toBeNull()
		})

		it('should process non-debounced jobs immediately even when debounced jobs are waiting', async () => {
			const queueName = 'testQueue'
			const debounceTime = 1000
			const startTime = Date.now()

			mockCurrentTime.mockReturnValue(startTime)

			// Queue debounced job first
			await manager.queueJobWithoutResult(
				queueName,
				'debouncedJob',
				{ debounced: true },
				{ debounce: debounceTime }
			)

			// Queue non-debounced job second
			await manager.queueJobWithoutResult(queueName, 'immediateJob', { immediate: true }, undefined)

			// Non-debounced job should be available immediately
			const firstJob = await manager.getNextJob(queueName)
			expect(firstJob?.name).toBe('immediateJob')

			// Debounced job should not be available yet
			const secondJob = await manager.getNextJob(queueName)
			expect(secondJob).toBeNull()

			// After debounce time, debounced job should be available
			mockCurrentTime.mockReturnValue(startTime + debounceTime + 1)
			const thirdJob = await manager.getNextJob(queueName)
			expect(thirdJob?.name).toBe('debouncedJob')
		})
	})

	describe('multiple queues', () => {
		it('should maintain separate queues for different queue names', async () => {
			const queue1 = 'queue1'
			const queue2 = 'queue2'

			await manager.queueJobWithoutResult(queue1, 'jobInQueue1', { queue: 1 }, undefined)
			await manager.queueJobWithoutResult(queue2, 'jobInQueue2', { queue: 2 }, undefined)

			const jobFromQueue1 = await manager.getNextJob(queue1)
			expect(jobFromQueue1?.name).toBe('jobInQueue1')

			const jobFromQueue2 = await manager.getNextJob(queue2)
			expect(jobFromQueue2?.name).toBe('jobInQueue2')

			// Each queue should be empty now
			expect(await manager.getNextJob(queue1)).toBeNull()
			expect(await manager.getNextJob(queue2)).toBeNull()
		})

		it('should not mix jobs between different queues', async () => {
			const queue1 = 'queue1'
			const queue2 = 'queue2'

			await manager.queueJobWithoutResult(queue1, 'job1', {}, undefined)
			await manager.queueJobWithoutResult(queue1, 'job2', {}, undefined)

			// Queue2 should have no jobs
			expect(await manager.getNextJob(queue2)).toBeNull()

			// Queue1 should have both jobs
			expect(await manager.getNextJob(queue1)).not.toBeNull()
			expect(await manager.getNextJob(queue1)).not.toBeNull()
		})
	})
})
