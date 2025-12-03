import { omit } from '@sofie-automation/corelib/dist/lib'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { Mongo } from 'meteor/mongo'
import { ObserveChangesCallbacks } from '@sofie-automation/meteor-lib/dist/collections/lib'
import { MongoModifier, MongoQuery } from '@sofie-automation/corelib/dist/mongo'

type Reaction = () => void

export class ReactiveCacheCollection<Document extends { _id: ProtectedString<any> }> {
	/**
	 * The collection still works in sync mode when operating on `null` in Meteor 3.0
	 * It may break in a later update, but this is fine for now.
	 */
	readonly #collection: Mongo.Collection<Document>

	constructor(
		public collectionName: string,
		private reaction?: Reaction
	) {
		this.#collection = new Mongo.Collection<Document>(null)
	}

	find(
		selector: Document['_id'] | Mongo.Selector<Document>,
		options?: Mongo.Options<Document>
	): Mongo.Cursor<Document, Document> {
		return this.#collection.find(selector as any, options)
	}

	findOne(
		selector: Document['_id'] | Mongo.Selector<Document>,
		options?: Omit<Mongo.Options<Document>, 'limit'>
	): Document | undefined {
		return this.#collection.findOne(selector as any, options)
	}

	insert(doc: Mongo.OptionalId<Document>): string {
		const id = this.#collection.insert(doc)
		this.runReaction()
		return id
	}

	remove(selector: Document['_id'] | MongoQuery<Document>): number {
		const num = this.#collection.remove(selector as any)
		if (num > 0) {
			this.runReaction()
		}
		return num
	}

	update(
		selector: Document['_id'] | MongoQuery<Document>,
		modifier: MongoModifier<Document>,
		options?: {
			multi?: boolean
			upsert?: boolean
			arrayFilters?: { [identifier: string]: any }[]
		}
	): number {
		const num = this.#collection.update(selector as any, modifier as any, options)
		if (num > 0) {
			this.runReaction()
		}
		return num
	}

	upsert(
		selector: Document['_id'] | Mongo.Selector<Document>,
		modifier: Mongo.Modifier<Document>,
		options?: { multi?: boolean }
	): { numberAffected?: number; insertedId?: string } {
		const res = this.#collection.upsert(selector as any, modifier as any, options)
		if (res.numberAffected || res.insertedId) {
			this.runReaction()
		}
		return res
	}

	async findOneAsync(
		selector: Document['_id'] | Mongo.Selector<Document>,
		options?: Omit<Mongo.Options<Document>, 'limit'>
	): Promise<Document | undefined> {
		return this.#collection.findOne(selector as any, options)
	}

	async insertAsync(doc: Mongo.OptionalId<Document>): Promise<string> {
		const id = await this.#collection.insertAsync(doc)
		this.runReaction()
		return id
	}

	async removeAsync(selector: Document['_id'] | MongoQuery<Document>): Promise<number> {
		const num = await this.#collection.removeAsync(selector as any)
		if (num > 0) {
			this.runReaction()
		}
		return num
	}

	async updateAsync(
		selector: Document['_id'] | MongoQuery<Document>,
		modifier: MongoModifier<Document>,
		options?: {
			multi?: boolean
			upsert?: boolean
			arrayFilters?: { [identifier: string]: any }[]
		}
	): Promise<number> {
		const num = await this.#collection.updateAsync(selector as any, modifier as any, options)
		if (num > 0) {
			this.runReaction()
		}
		return num
	}

	async upsertAsync(
		selector: Document['_id'] | Mongo.Selector<Document>,
		modifier: Mongo.Modifier<Document>,
		options?: { multi?: boolean }
	): Promise<{ numberAffected?: number; insertedId?: string }> {
		const res = await this.#collection.upsertAsync(selector as any, modifier as any, options)
		if (res.numberAffected || res.insertedId) {
			this.runReaction()
		}
		return res
	}

	link(cb?: () => void): ObserveChangesCallbacks<Document> {
		return {
			added: (id: Document['_id'], fields: Partial<Document>) => {
				this.upsert(id, { $set: omit(fields, '_id') as any })
				cb?.()
			},
			changed: (id: Document['_id'], fields: Partial<Document>) => {
				const unset: Partial<Record<keyof Document, 1>> = {}
				for (const [key, value] of Object.entries<unknown>(fields)) {
					if (value !== undefined) continue
					unset[key as keyof Document] = 1
				}
				this.upsert(id, { $set: omit(fields, '_id') as any, $unset: unset as any })
				cb?.()
			},
			removed: (id: Document['_id']) => {
				this.remove(id)
				cb?.()
			},
		}
	}

	private runReaction() {
		this.reaction?.()
	}
}
