# Timeline Datastore

The timeline datastore is a key-value store that can be used in conjunction with the timeline. The benefit of modifying values in the datastore is that the timings in the timeline are not modified so we can skip a lot of complicated calculations which reduces the system response time. An example usecase of the datastore feature is a fastpath for cutting cameras.

## API

In order to use the timeline datastore feature 2 API's are to be used. The timeline object has to contain a reference to a key in the datastore and the blueprints have to add a value for that key to the datastore. These references are added on the content field.

### Timeline API

```ts
/**
 * An object containing references to the datastore
 */
export interface TimelineDatastoreReferences {
	/**
	 * localPath is the path to the property in the content object to override
	 */
	[localPath: string]: {
		/** Reference to the Datastore key where to fetch the value */
		datastoreKey: string
		/**
		 * If true, the referenced value in the Datastore is only applied after the timeline-object has started (ie a later-started timeline-object will not be affected)
		 */
		overwrite: boolean
	}
}
```

### Timeline API example

```ts
const tlObj = {
	id: 'obj0',
	enable: { start: 1000 },
	layer: 'layer0',
	content: {
		deviceType: DeviceType.Atem,
		type: TimelineObjectAtem.MixEffect,

		$references: {
			'me.input': {
				datastoreKey: 'camInput',
				overwrite: true,
			},
		},

		me: {
			input: 1,
			transition: TransitionType.Cut,
		},
	},
}
```

### Blueprints API

Values can be added and removed from the datastore through the adlib actions API.

```ts
interface DatastoreActionExecutionContext {
	setTimelineDatastoreValue(key: string, value: unknown, mode: DatastorePersistenceMode): Promise<void>
	removeTimelineDatastoreValue(key: string): Promise<void>
}

enum DatastorePersistenceMode {
	Temporary = 'temporary',
	indefinite = 'indefinite',
}
```

The data persistence mode work as follows:

- Temporary: this key-value pair may be cleaned up if it is no longer referenced to from the timeline, in practice this will currently only happen during deactivation of a rundown
- This key-value pair may _not_ be automatically removed (it can still be removed by the blueprints)

The above context methods may be used from the usual adlib actions context but there is also a special path where none of the usual cached data is available, as loading the caches may take some time. The `executeDataStoreAction` method is executed just before the `executeAction` method.

### Restrictions on values

A value can be anything that can be stored in the database: usually a string or a number, but objects and arrays are allowed too. If the value is an object or array, none of its field names, at any depth, may:

- contain a `.`
- start with a `$`
- contain a null byte

`setTimelineDatastoreValue` rejects such values with an error, and nothing is stored.

```ts
await context.setTimelineDatastoreValue('camInput', 2, DatastorePersistenceMode.Temporary) // OK
await context.setTimelineDatastoreValue('url', 'http://example.com/a.b', DatastorePersistenceMode.Temporary) // OK: only field names are restricted
await context.setTimelineDatastoreValue('mix', { input: 2, transition: 'cut' }, DatastorePersistenceMode.Temporary) // OK
await context.setTimelineDatastoreValue('files', { 'clip.mp4': 1 }, DatastorePersistenceMode.Temporary) // Error
await context.setTimelineDatastoreValue('ops', { $set: 1 }, DatastorePersistenceMode.Temporary) // Error
```

The database itself accepts these field names, but the Sofie UI does not. Datastore documents are published to the UI, and the UI's client-side database refuses documents that contain them. Worse, it also drops other data that arrived in the same batch of updates, for any collection, so parts of the UI can silently go out of date until it reconnects. If you need such names, for example a map keyed by file name or IP address, use an array of entries (`[{ name: 'clip.mp4', value: 1 }]`) instead.

## Example use case: camera cutting fast path

Assuming a set of blueprints where we can cut camera's a on a vision mixer's mix effect by using adlib pieces, we want to add a fast path where the camera input is changed through the datastore first and then afterwards we add the piece for correctness.

1.  If you haven't yet, convert the current camera adlibs to adlib actions by exporting the `IBlueprintActionManifest` as part of your `getRundown` implementation and implementing an adlib action in your `executeAction` handler that adds your camera piece.
2.  Modify any camera pieces (including the one from your adlib action) to contain a reference to the datastore (See the timeline API example)
3.  Implement an `executeDataStoreAction` handler as part of your blueprints, when this handler receives the action for your camera adlib it should call the `setTimelineDatastoreValue` method with the key you used in the timeline object (In the example it's `camInput`), the new input for the vision mixer and the `DatastorePersistenceMode.Temporary` persistence mode.
