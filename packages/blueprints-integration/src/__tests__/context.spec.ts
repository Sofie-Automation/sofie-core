import { isCommonContext, isUserNotesContext } from '../context/index.js'

describe('Context', () => {
	const validCommonContext = {
		getHashId: () => 'fake',
		unhashId: () => 'more fake',
		logDebug: () => undefined,
		logInfo: () => undefined,
		logWarning: () => undefined,
		logError: () => undefined,
	}
	describe('ICommonContext predicate function', () => {
		it('should return false for undefined', () => {
			expect(isCommonContext(undefined)).toBe(false)
		})

		it('should return false for null', () => {
			expect(isCommonContext(null)).toBe(false)
		})

		it('should return false for literal value', () => {
			expect(isCommonContext('hehe')).toBe(false)
		})

		it('should return false for an object where getHashId is missing', () => {
			const invalid = Object.assign({}, validCommonContext, { getHashId: undefined })

			expect(isCommonContext(invalid)).toBe(false)
		})

		it('should return false for an object where getHashId is not a function', () => {
			const invalid = Object.assign({}, validCommonContext, { getHashId: { hehe: 'lol' } })

			expect(isCommonContext(invalid)).toBe(false)
		})

		it('should return false for an object where unhashId is missing', () => {
			const invalid = Object.assign({}, validCommonContext, { unhashId: undefined })

			expect(isCommonContext(invalid)).toBe(false)
		})

		it('should return false for an object where unhashId is not a function', () => {
			const invalid = Object.assign({}, validCommonContext, { unhashId: { hehe: 'lol' } })

			expect(isCommonContext(invalid)).toBe(false)
		})

		it('should return false for an object where logDebug is missing', () => {
			const invalid = Object.assign({}, validCommonContext, { logDebug: undefined })

			expect(isCommonContext(invalid)).toBe(false)
		})

		it('should return false for an object where logDebug is not a function', () => {
			const invalid = Object.assign({}, validCommonContext, { logDebug: { hehe: 'lol' } })

			expect(isCommonContext(invalid)).toBe(false)
		})

		it('should return false for an object where logInfo is missing', () => {
			const invalid = Object.assign({}, validCommonContext, { logInfo: undefined })

			expect(isCommonContext(invalid)).toBe(false)
		})

		it('should return false for an object where logInfo is not a function', () => {
			const invalid = Object.assign({}, validCommonContext, { logInfo: { hehe: 'lol' } })

			expect(isCommonContext(invalid)).toBe(false)
		})

		it('should return false for an object where logWarning is missing', () => {
			const invalid = Object.assign({}, validCommonContext, { logWarning: undefined })

			expect(isCommonContext(invalid)).toBe(false)
		})

		it('should return false for an object where logWarning is not a function', () => {
			const invalid = Object.assign({}, validCommonContext, { logWarning: { hehe: 'lol' } })

			expect(isCommonContext(invalid)).toBe(false)
		})

		it('should return false for an object where logError is missing', () => {
			const invalid = Object.assign({}, validCommonContext, { logError: undefined })

			expect(isCommonContext(invalid)).toBe(false)
		})

		it('should return false for an object where logError is not a function', () => {
			const invalid = Object.assign({}, validCommonContext, { logError: { hehe: 'lol' } })

			expect(isCommonContext(invalid)).toBe(false)
		})

		it('should return true for a valid context', () => {
			expect(isCommonContext(validCommonContext)).toBe(true)
		})
	})

	describe('IUserNotesContext predicate function', () => {
		const userNotesContextMethods = {
			notifyUserError: () => undefined,
			notifyUserWarning: () => undefined,
			notifyUserInfo: () => undefined,
		}
		const validUserNotesContext = Object.assign({}, validCommonContext, userNotesContextMethods)

		it('should return false for undefined', () => {
			expect(isUserNotesContext(undefined)).toBe(false)
		})

		it('should return false for null', () => {
			expect(isUserNotesContext(null)).toBe(false)
		})

		it('should return false for literal value', () => {
			expect(isUserNotesContext('hehe')).toBe(false)
		})

		it('should return false when object is not a Common Context implementation', () => {
			expect(isUserNotesContext(Object.assign({}, userNotesContextMethods))).toBe(false)
		})

		it('should return false for an object where notifyUserError is missing', () => {
			const invalid = Object.assign({}, validUserNotesContext, { notifyUserError: undefined })

			expect(isUserNotesContext(invalid)).toBe(false)
		})

		it('should return false for an object where notifyUserError is not a function', () => {
			const invalid = Object.assign({}, validUserNotesContext, { notifyUserError: { hehe: 'lol' } })

			expect(isUserNotesContext(invalid)).toBe(false)
		})

		it('should return false for an object where notifyUserWarning is missing', () => {
			const invalid = Object.assign({}, validUserNotesContext, { notifyUserWarning: undefined })

			expect(isUserNotesContext(invalid)).toBe(false)
		})

		it('should return false for an object where notifyUserWarning is not a function', () => {
			const invalid = Object.assign({}, validUserNotesContext, { notifyUserWarning: { hehe: 'lol' } })

			expect(isUserNotesContext(invalid)).toBe(false)
		})

		it('should return false for an object where notifyUserInfo is missing', () => {
			const invalid = Object.assign({}, validUserNotesContext, { notifyUserInfo: undefined })

			expect(isUserNotesContext(invalid)).toBe(false)
		})

		it('should return false for an object where notifyUserInfo is not a function', () => {
			const invalid = Object.assign({}, validUserNotesContext, { notifyUserInfo: { hehe: 'lol' } })

			expect(isUserNotesContext(invalid)).toBe(false)
		})

		it('should return true for a valid context', () => {
			expect(isUserNotesContext(validUserNotesContext)).toBe(true)
		})
	})
})
