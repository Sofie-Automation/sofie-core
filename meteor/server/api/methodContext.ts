import { Meteor } from 'meteor/meteor'

export type MethodContext = Omit<Meteor.MethodThisType, 'userId' | 'setUserId' | 'isSimulation'>

/** Abstarct class to be used when defining Mehod-classes */
export abstract class MethodContextAPI implements MethodContext {
	// These properties are added by Meteor to the `this` context when calling methods
	public unblock(): void {
		throw new Meteor.Error(
			500,
			`This shoulc never be called, there's something wrong in with 'this' in the calling method`
		)
	}
	public connection!: Meteor.Connection | null
}
