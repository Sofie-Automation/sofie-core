import EJSON from 'ejson'

interface PrecedenceItem {
	subscriptionHandle: string
	value: any
}

export interface ChangeCollector {
	[key: string]: any
}

/**
 * One document's view across all subscriptions on a session, ported from Meteor's `ddp-server`
 * `session_document_view.ts`. Each field keeps a precedence list of `{subscriptionHandle, value}`;
 * only the value at index 0 is visible to the client. This is what lets multiple subscriptions publish
 * the same `(collection, id)` without the client seeing duplicate `added`/conflicting fields.
 */
export class SessionDocumentView {
	/** The set of subscription handles that currently include this document. */
	readonly existsIn = new Set<string>()
	/** key -> precedence-ordered list of values from each subscription. */
	readonly dataByKey = new Map<string, PrecedenceItem[]>()

	getFields(): Record<string, any> {
		const ret: Record<string, any> = {}
		this.dataByKey.forEach((precedenceList, key) => {
			ret[key] = precedenceList[0].value
		})
		return ret
	}

	clearField(subscriptionHandle: string, key: string, changeCollector: ChangeCollector): void {
		// Publish API ignores _id if present in fields
		if (key === '_id') return

		const precedenceList = this.dataByKey.get(key)
		// It's okay to clear fields that didn't exist. No need to throw an error.
		if (!precedenceList) return

		let removedValue: any = undefined

		for (let i = 0; i < precedenceList.length; i++) {
			const precedence = precedenceList[i]
			if (precedence.subscriptionHandle === subscriptionHandle) {
				// The view's value can only change if this subscription is the one that used to have precedence.
				if (i === 0) removedValue = precedence.value
				precedenceList.splice(i, 1)
				break
			}
		}

		if (precedenceList.length === 0) {
			this.dataByKey.delete(key)
			changeCollector[key] = undefined
		} else if (removedValue !== undefined && !EJSON.equals(removedValue, precedenceList[0].value)) {
			changeCollector[key] = precedenceList[0].value
		}
	}

	changeField(
		subscriptionHandle: string,
		key: string,
		value: unknown,
		changeCollector: ChangeCollector,
		isAdd = false
	): void {
		// Publish API ignores _id if present in fields
		if (key === '_id') return

		// Don't share state with the data passed in by the user.
		value = EJSON.clone(value)

		if (!this.dataByKey.has(key)) {
			this.dataByKey.set(key, [{ subscriptionHandle, value }])
			changeCollector[key] = value
			return
		}

		const precedenceList = this.dataByKey.get(key)!
		let elt: PrecedenceItem | undefined

		if (!isAdd) {
			elt = precedenceList.find((precedence) => precedence.subscriptionHandle === subscriptionHandle)
		}

		if (elt) {
			if (elt === precedenceList[0] && !EJSON.equals(value, elt.value)) {
				// this subscription is changing the value of this field.
				changeCollector[key] = value
			}
			elt.value = value
		} else {
			// this subscription is newly caring about this field
			precedenceList.push({ subscriptionHandle, value })
		}
	}
}
