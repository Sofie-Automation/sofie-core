/* eslint-disable jest/no-export */
/**
 * Differential-conformance harness: run the SAME operation against both the in-memory mock collection
 * (corelib's {@link InMemoryMongoCollection}, the real code path the unit-test mock uses) and a real
 * mongodb-memory-server collection, then assert identical results.
 *
 * This is the consistency oracle for the hand-rolled mongo semantics in `packages/corelib/src/mongo.ts`
 * (`mongoWhere` / `mongoModify` / `mongoFindOptions` / `mongoProjectDocument`) plus the in-memory
 * collection's own `bulkWrite`/`insert`/`remove` arms. Because Part 1 covers the whole in-memory
 * collection, the wrapper-parity suite (Part 2) does not need to re-run any of this matrix.
 */
import { MongoClient } from 'mongodb'
import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { FindOptions, MongoQuery, MongoModifier, MongoBulkWriteOperation } from '@sofie-automation/corelib/dist/mongo'
import { convertFindOptionsToNative } from '../../../collections/implementations/asyncCollection'
import { freshCollection } from '../_integrationDb'

/** A plain seed/result document. `_id` is a plain string (corelib's `ProtectedString` is identity-on-string). */
export type SeedDoc = { _id: string } & Record<string, unknown>

/**
 * What we expect from comparing the two implementations:
 *  - `match` (default): both succeed and return equal results.
 *  - `inMemoryThrows`: the mock throws (operator we deliberately don't support); real mongo may succeed.
 *  - `bothThrow`: both reject (e.g. a full-document update with no atomic operators, mixed projection).
 */
export type Expectation =
	| { status: 'match' }
	| { status: 'inMemoryThrows'; reason: string }
	| { status: 'bothThrow'; reason: string }

interface BaseCase {
	name: string
	seed: SeedDoc[]
	expectation?: Expectation
}
export interface WhereCase extends BaseCase {
	kind: 'where'
	query: MongoQuery<any>
}
export interface FindCase extends BaseCase {
	kind: 'find'
	query?: MongoQuery<any>
	options: FindOptions<any>
	/** Set when the case tests sort order, so results are compared positionally instead of sorted by `_id`. */
	ordered?: boolean
}
export interface ModifyCase extends BaseCase {
	kind: 'modify'
	selector: MongoQuery<any>
	modifier: MongoModifier<any>
	multi?: boolean
}
export interface BulkCase extends BaseCase {
	kind: 'bulk'
	ops: Array<MongoBulkWriteOperation<any>>
}
export type ConformanceCase = WhereCase | FindCase | ModifyCase | BulkCase

interface RunResult {
	docs?: SeedDoc[]
	threw?: boolean
	/** Message of the thrown error, when `threw` is true, so the expectation's `reason` can be asserted. */
	error?: string
}

function runInMemory(c: ConformanceCase): RunResult {
	const col = new InMemoryMongoCollection<any>('conformance')
	col.mockSetData(c.seed as any)
	try {
		switch (c.kind) {
			case 'where':
				return { docs: col.findFetch(c.query as any) }
			case 'find':
				return { docs: col.findFetch((c.query ?? {}) as any, c.options as any) }
			case 'modify':
				col.update(c.selector as any, c.modifier as any, { multi: c.multi })
				return { docs: col.findFetch({}) }
			case 'bulk':
				col.bulkWrite(c.ops as any)
				return { docs: col.findFetch({}) }
		}
	} catch (e) {
		return { threw: true, error: String((e as Error)?.message ?? e) }
	}
}

async function runReal(client: MongoClient, c: ConformanceCase): Promise<RunResult> {
	const col = await freshCollection<SeedDoc>(client, c.seed)
	try {
		switch (c.kind) {
			case 'where':
				return { docs: (await col.find(c.query as any).toArray()) as SeedDoc[] }
			case 'find':
				return {
					docs: (await col
						.find((c.query ?? {}) as any, convertFindOptionsToNative(c.options as any))
						.toArray()) as SeedDoc[],
				}
			case 'modify':
				if (c.multi) await col.updateMany(c.selector as any, c.modifier as any)
				else await col.updateOne(c.selector as any, c.modifier as any)
				return { docs: (await col.find({}).toArray()) as SeedDoc[] }
			case 'bulk':
				// `ordered: true` so ops apply sequentially, matching the in-memory bulkWrite's array-order semantics.
				await col.bulkWrite(c.ops as any, { ordered: true })
				return { docs: (await col.find({}).toArray()) as SeedDoc[] }
		}
	} catch (e) {
		return { threw: true, error: String((e as Error)?.message ?? e) }
	}
}

function normalize(docs: SeedDoc[], ordered: boolean): SeedDoc[] {
	const copy = [...docs]
	if (!ordered) copy.sort((a, b) => String(a._id).localeCompare(String(b._id)))
	return copy
}

function assertResult(c: ConformanceCase, inMem: RunResult, real: RunResult): void {
	const expectation = c.expectation
	const status = expectation?.status ?? 'match'
	if (status === 'inMemoryThrows') {
		// The mock rejects the (deliberately unsupported) operator, but real mongo supports it: assert the
		// mock threw AND that the real backend stayed healthy, so a case where BOTH throw can't hide here.
		expect({ name: c.name, inMemThrew: inMem.threw, realThrew: real.threw }).toEqual({
			name: c.name,
			inMemThrew: true,
			realThrew: undefined,
		})
		// The thrown error must be the specific one the case documents, not some unrelated failure.
		expect(inMem.error).toContain((expectation as { reason: string }).reason)
		return
	}
	if (status === 'bothThrow') {
		expect(inMem.threw).toBe(true)
		expect(real.threw).toBe(true)
		// Only the in-memory path's message is pinned; real mongo's wording is its own and not asserted here.
		expect(inMem.error).toContain((expectation as { reason: string }).reason)
		return
	}
	// match
	expect({ name: c.name, threw: inMem.threw }).toEqual({ name: c.name, threw: undefined })
	expect({ name: c.name, threw: real.threw }).toEqual({ name: c.name, threw: undefined })
	const ordered = c.kind === 'find' && !!c.ordered
	expect(normalize(inMem.docs!, ordered)).toEqual(normalize(real.docs!, ordered))
}

/**
 * Register a `test.each` over a table of conformance cases. `getClient` returns the shared client opened by
 * the test file's `beforeAll`.
 */
export function runConformanceTable(getClient: () => MongoClient, cases: ConformanceCase[]): void {
	// eslint-disable-next-line jest/expect-expect
	test.each(cases.map((c) => [c.name, c] as const))('%s', async (_name, c) => {
		const inMem = runInMemory(c)
		const real = await runReal(getClient(), c)
		assertResult(c, inMem, real)
	})
}
