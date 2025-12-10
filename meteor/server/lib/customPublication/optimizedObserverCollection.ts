import { ReadonlyDeep } from 'type-fest'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { CustomPublishCollection } from './customPublishCollection'
import { SetupObserversResult, TriggerUpdate, setUpOptimizedObserverInner } from './optimizedObserverBase'
import { CustomPublish } from './publish'

/**
 * This is an optimization to enable multiple listeners that observes (and manipulates) the same data, to only use one observer and manipulator,
 * then receive the result for each listener.
 * This version allows the observer code to maintain a in memory 'collection' of documents that it can mutate.
 *
 * @param identifier identifier, shared between the listeners that use the same observer.
 * @param setupObservers Set up the observers. This is run just 1 times for N listeners, on initialization.
 * @param manipulateData Manipulate the data. This is run 1 times for N listeners, per data update. (and on initialization). Return false if nothing has changed
 * @param receiver The CustomPublish for the subscriber that wants to create (or be added to) the observer
 * @param lazynessDuration (Optional) How long to wait after a change before issueing an update. Default to 3 ms
 */
export async function setUpCollectionOptimizedObserver<
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
		collection: CustomPublishCollection<PublicationDoc>,
		newProps: ReadonlyDeep<Partial<UpdateProps> | undefined>
	) => Promise<void>,
	receiver: CustomPublish<PublicationDoc>,
	lazynessDuration = 3 // ms
): Promise<void> {
	const collection = new CustomPublishCollection<PublicationDoc>(identifier)
	return setUpOptimizedObserverInner<PublicationDoc, Args, State, UpdateProps>(
		`pub_collection_${identifier}`,
		args0,
		setupObservers,
		async (args, state, newProps) => {
			await manipulateData(args, state, collection, newProps)
			return collection.commitChanges()
		},
		receiver,
		lazynessDuration
	)
}
