/* eslint-disable @typescript-eslint/no-unsafe-function-type */

interface Options {
	name: string // DDP method name
	mixins: any // Method extensions
	validate: Function // argument validation
	applyOptions: any // options passed to Meteor.apply
	run: Function // Method body
}

export class ValidatedMethodMock {
	public name: string
	public mixins: any
	public validate: Function
	public applyOptions: any
	public run: Function

	constructor(options: Options) {
		this.name = options.name
		this.mixins = options.mixins
		this.validate = options.validate
		this.applyOptions = options.applyOptions
		this.run = options.run
	}
	call(): any {
		return this.run() // ???
	}
}
export function setup(): any {
	return {
		ValidatedMethod: jest.fn((opts) => {
			return new ValidatedMethodMock(opts)
		}),
	}
}
