import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'
import { clone, ProtectedString } from '../tempLib'
import { SetupObserversResult, TriggerUpdate, setUpOptimizedObserverInner } from './optimizedObserverBase'
import { CustomPublish, CustomPublishChanges } from './publish'
import { diffObject } from './lib'

/**
 * This is an optimization to enable multiple listeners that observes (and manipulates) the same data, to only use one observer and manipulator,
 * then receive the result for each listener.
 * This version allows the observer code to return an array of each call to manipulateData, and allow deep equality checking to be performed to check for changes.
 *
 * @param identifier identifier, shared between the listeners that use the same observer.
 * @param setupObservers Set up the observers. This is run just 1 times for N listeners, on initialization.
 * @param manipulateData Manipulate the data. This is run 1 times for N listeners, per data update. (and on initialization). Return null if nothing has changed
 * @param receiver The CustomPublish for the subscriber that wants to create (or be added to) the observer
 * @param lazynessDuration (Optional) How long to wait after a change before issueing an update. Default to 3 ms
 */
export async function setUpOptimizedObserverArray<
	PublicationDoc extends { _id: ProtectedString<any> },
	Args,
	State extends Record<string, any>,
	UpdateProps extends Record<string, any>,
>(
	identifier: string,
	args0: ReadonlyDeep<Args>,
	setupObservers: (
		args: ReadonlyDeep<Args>,
		/** Trigger an update by mutating the context of manipulateData */
		triggerUpdate: TriggerUpdate<UpdateProps>
	) => Promise<SetupObserversResult>,
	manipulateData: (
		args: ReadonlyDeep<Args>,
		state: Partial<State>,
		newProps: ReadonlyDeep<Partial<UpdateProps> | undefined>
	) => Promise<PublicationDoc[] | null>,
	receiver: CustomPublish<PublicationDoc>,
	lazynessDuration = 3 // ms
): Promise<void> {
	const converter = new OptimisedObserverGenericArray<PublicationDoc>()
	return setUpOptimizedObserverInner<PublicationDoc, Args, State, UpdateProps>(
		`pub_array_${identifier}`,
		args0,
		setupObservers,
		async (args, state, newProps) => {
			const newDocs = await manipulateData(args, state, newProps)
			if (newDocs) {
				// observer gave updated docs
				const changes = converter.updatedDocs(newDocs)
				return [newDocs, changes]
			} else {
				// observer reports that nothing changed
				const changes: CustomPublishChanges<PublicationDoc> = {
					added: [],
					changed: [],
					removed: [],
				}
				return [converter.getDocs(), changes]
			}
		},
		receiver,
		lazynessDuration
	)
}

class OptimisedObserverGenericArray<DBObj extends { _id: ProtectedString<any> }> {
	readonly #docs = new Map<DBObj['_id'], DBObj>()

	getDocs(): DBObj[] {
		return Array.from(this.#docs.values())
	}

	updatedDocs(newDocs: DBObj[]): CustomPublishChanges<DBObj> {
		const changes: CustomPublishChanges<DBObj> = {
			added: [],
			changed: [],
			removed: [],
		}

		const newIds = new Set<DBObj['_id']>()
		// figure out which documents have changed

		const oldIds = Array.from(this.#docs.keys())

		for (const newDoc0 of newDocs) {
			const id = newDoc0._id
			if (newIds.has(id)) {
				throw new Meteor.Error(`Error in custom publication: _id "${id}" is not unique!`)
			}
			newIds.add(id)

			const oldDoc = this.#docs.get(id)
			if (!oldDoc) {
				const newDoc = clone(newDoc0)

				// added
				this.#docs.set(id, newDoc)
				changes.added.push(newDoc)
			} else {
				// Do a shallow diff, to figure out the minimal change
				const partial = diffObject(oldDoc, newDoc0)

				if (partial) {
					// changed

					changes.changed.push({
						...partial,
						_id: id,
					})

					this.#docs.set(id, clone(newDoc0))
				}
			}
		}

		for (const id of oldIds) {
			if (!newIds.has(id)) {
				// Removed
				this.#docs.delete(id)
				changes.removed.push(id)
			}
		}

		return changes
	}
}
