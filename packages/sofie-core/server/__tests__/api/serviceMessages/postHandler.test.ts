import { postHandler } from '../../../api/serviceMessages/postHandler'
import { Criticality, ExternalServiceMessage } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import * as serviceMessagesApi from '../../../api/serviceMessages/serviceMessagesApi'
import { SupressLogMessages } from '../../../../__mocks__/suppressLogging'
import { createMockContext } from '@shopify/jest-koa-mocks'

jest.mock('../../../api/serviceMessages/serviceMessagesApi', () => {
	return {
		__esModule: true,
		writeMessage: jest.fn(() => ({ systemError: false })),
	}
})

const validInput: ExternalServiceMessage = {
	id: '294a7079efdce49fb553e52d9e352e24',
	criticality: Criticality.CRITICAL,
	message: 'Something is wrong that should have been right',
	sender: 'ola',
	timestamp: new Date(),
}

declare global {
	namespace jest {
		interface Matchers<R> {
			toBeHttpOkStatusCode(): R
		}
	}
}

expect.extend({
	toBeHttpOkStatusCode(value): jest.CustomMatcherResult {
		const allowed = [200, 201, 204]
		if (allowed.indexOf(value) > -1) {
			return {
				message: () => `expected ${value} to not be one of ${allowed.join(',')}`,
				pass: true,
			}
		}

		return {
			message: () => `expected ${value} to be one of ${allowed.join(',')}`,
			pass: false,
		}
	},
})

describe('ServiceMessages API POST endpoint', () => {
	const mockedWriteMessage: jest.Mock<typeof serviceMessagesApi.writeMessage> = serviceMessagesApi.writeMessage as any

	describe('input validation', () => {
		it('should accept valid input', async () => {
			const ctx = createMockContext({})
			ctx.request.body = JSON.parse(JSON.stringify(validInput))
			await postHandler(ctx)

			expect(ctx.response.status).toBeHttpOkStatusCode()
			expect(ctx.body).toBeTruthy()
		})

		describe('id field', () => {
			// id: string
			it('should reject when value is missing', async () => {
				const invalidInput = { ...validInput }
				// @ts-expect-error
				delete invalidInput.id

				const ctx = createMockContext({})
				ctx.request.body = JSON.parse(JSON.stringify(invalidInput))
				await postHandler(ctx)

				expect(ctx.response.status).toEqual(400)
				expect(ctx.body).toBeTruthy()
			})

			it('should reject empty string', async () => {
				const invalidInput = { ...validInput }
				invalidInput.id = ''

				const ctx = createMockContext({})
				ctx.request.body = JSON.parse(JSON.stringify(invalidInput))
				await postHandler(ctx)

				expect(ctx.response.status).toEqual(400)
				expect(ctx.body).toBeTruthy()
			})

			it('should reject blank string', async () => {
				const invalidInput = { ...validInput }
				invalidInput.id = ' \t'

				const ctx = createMockContext({})
				ctx.request.body = JSON.parse(JSON.stringify(invalidInput))
				await postHandler(ctx)

				expect(ctx.response.status).toEqual(400)
				expect(ctx.body).toBeTruthy()
			})
		})

		describe('criticality field', () => {
			// criticality: Criticality
			it('should reject when value is missing', async () => {
				const invalidInput = { ...validInput }
				// @ts-expect-error
				delete invalidInput.criticality

				const ctx = createMockContext({})
				ctx.request.body = JSON.parse(JSON.stringify(invalidInput))
				await postHandler(ctx)

				expect(ctx.response.status).toEqual(400)
				expect(ctx.body).toBeTruthy()
			})

			it('should reject non numeric value', async () => {
				const invalidInput: any = { ...validInput }
				invalidInput.criticality = 'lol'

				const ctx = createMockContext({})
				ctx.request.body = JSON.parse(JSON.stringify(invalidInput))
				await postHandler(ctx)

				expect(ctx.response.status).toEqual(400)
				expect(ctx.body).toBeTruthy()
			})

			it('should reject negative number', async () => {
				const invalidInput: any = { ...validInput }
				invalidInput.criticality = -1

				const ctx = createMockContext({})
				ctx.request.body = JSON.parse(JSON.stringify(invalidInput))
				await postHandler(ctx)

				expect(ctx.response.status).toEqual(400)
				expect(ctx.body).toBeTruthy()
			})

			it('should reject non-criticality positive number', async () => {
				const tooHigh =
					Object.values<Criticality>(Criticality as any)
						.filter((value) => typeof value === 'number')
						.sort((a, b) => b - a)[0] + 1
				const invalidInput: any = { ...validInput }
				invalidInput.criticality = tooHigh

				const ctx = createMockContext({})
				ctx.request.body = JSON.parse(JSON.stringify(invalidInput))
				await postHandler(ctx)

				expect(ctx.response.status).toEqual(400)
				expect(ctx.body).toBeTruthy()
			})

			it('should accept a valid value as a string', async () => {
				const alsoValid: any = { ...validInput }
				alsoValid.criticality = `${validInput.criticality}`

				const ctx = createMockContext({})
				ctx.request.body = JSON.parse(JSON.stringify(alsoValid))
				await postHandler(ctx)

				expect(ctx.response.status).toBeHttpOkStatusCode()
				expect(ctx.body).toBeTruthy()
			})

			it('should reject empty string value', async () => {
				const invalidInput: any = { ...validInput }
				invalidInput.criticality = ''

				const ctx = createMockContext({})
				ctx.request.body = JSON.parse(JSON.stringify(invalidInput))
				await postHandler(ctx)

				expect(ctx.response.status).toEqual(400)
				expect(ctx.body).toBeTruthy()
			})
		})

		describe('message field', () => {
			// message: string
			it('should reject when value is missing', async () => {
				const invalidInput = { ...validInput }
				// @ts-expect-error
				delete invalidInput.message

				const ctx = createMockContext({})
				ctx.request.body = JSON.parse(JSON.stringify(invalidInput))
				await postHandler(ctx)

				expect(ctx.response.status).toEqual(400)
				expect(ctx.body).toBeTruthy()
			})

			it('should reject empty string', async () => {
				const invalidInput = { ...validInput }
				invalidInput.message = ''

				const ctx = createMockContext({})
				ctx.request.body = JSON.parse(JSON.stringify(invalidInput))
				await postHandler(ctx)

				expect(ctx.response.status).toEqual(400)
				expect(ctx.body).toBeTruthy()
			})

			it('should reject blank string', async () => {
				const invalidInput = { ...validInput }
				invalidInput.message = ' \t'

				const ctx = createMockContext({})
				ctx.request.body = JSON.parse(JSON.stringify(invalidInput))
				await postHandler(ctx)

				expect(ctx.response.status).toEqual(400)
				expect(ctx.body).toBeTruthy()
			})
		})

		describe('sender field', () => {
			// sender?: string
			it('should accept missing value', async () => {
				const alsoValid = { ...validInput }
				delete alsoValid.sender

				const ctx = createMockContext({})
				ctx.request.body = JSON.parse(JSON.stringify(alsoValid))
				await postHandler(ctx)

				expect(ctx.response.status).toBeHttpOkStatusCode()
				expect(ctx.body).toBeTruthy()
			})

			it('should accept empty value', async () => {
				const alsoValid = { ...validInput }
				alsoValid.sender = ''

				const ctx = createMockContext({})
				ctx.request.body = JSON.parse(JSON.stringify(alsoValid))
				await postHandler(ctx)

				expect(ctx.response.status).toBeHttpOkStatusCode()
				expect(ctx.body).toBeTruthy()
			})
		})

		describe('timestamp field', () => {
			// timestamp: Date
			it('should reject when value is missing', async () => {
				const invalidInput = { ...validInput }
				// @ts-expect-error
				delete invalidInput.timestamp

				const ctx = createMockContext({})
				ctx.request.body = JSON.parse(JSON.stringify(invalidInput))
				await postHandler(ctx)

				expect(ctx.response.status).toEqual(400)
				expect(ctx.body).toBeTruthy()
			})

			it('should reject non date value', async () => {
				const invalidInput = { ...validInput } as any
				invalidInput.timestamp = 'this is not a date'

				const ctx = createMockContext({})
				ctx.request.body = JSON.parse(JSON.stringify(invalidInput))
				await postHandler(ctx)

				expect(ctx.response.status).toEqual(400)
				expect(ctx.body).toBeTruthy()
			})
		})
	})

	describe('data storage', () => {
		it('should call API writeMessage with the given id', async () => {
			const expected = validInput.id

			const ctx = createMockContext({})
			ctx.request.body = JSON.parse(JSON.stringify(validInput))
			await postHandler(ctx)

			expect(mockedWriteMessage.mock.calls[0][0]).toHaveProperty('id', expected)
		})

		it('should call API writeMessage with the given criticality', async () => {
			const expected = Number(validInput.criticality)

			const ctx = createMockContext({})
			ctx.request.body = JSON.parse(JSON.stringify(validInput))
			await postHandler(ctx)

			expect(mockedWriteMessage.mock.calls[0][0]).toHaveProperty('criticality', expected)
		})

		it('should call API writeMessage with the given criticality when criticality is a string', async () => {
			const expected = Number(validInput.criticality)
			const alsoValid: any = { ...validInput }
			alsoValid.criticality = `${validInput.criticality}`

			const ctx = createMockContext({})
			ctx.request.body = JSON.parse(JSON.stringify(alsoValid))
			await postHandler(ctx)

			expect(mockedWriteMessage.mock.calls[0][0]).toHaveProperty('criticality', expected)
		})

		it('should call API writeMessage with the given message', async () => {
			const expected = validInput.message

			const ctx = createMockContext({})
			ctx.request.body = JSON.parse(JSON.stringify(validInput))
			await postHandler(ctx)

			expect(mockedWriteMessage.mock.calls[0][0]).toHaveProperty('message', expected)
		})
		it('should call API writeMessage with the given sender', async () => {
			const expected = validInput.sender

			const ctx = createMockContext({})
			ctx.request.body = JSON.parse(JSON.stringify(validInput))
			await postHandler(ctx)

			expect(mockedWriteMessage.mock.calls[0][0]).toHaveProperty('sender', expected)
		})

		it('should call API writeMessage with the given timestamp', async () => {
			const expected = new Date(validInput.timestamp).getTime()

			const ctx = createMockContext({})
			ctx.request.body = JSON.parse(JSON.stringify(validInput))
			await postHandler(ctx)

			expect(mockedWriteMessage.mock.calls[0][0]).toHaveProperty('timestamp', expected)
		})
	})

	describe('http response', () => {
		it('should reply 201 Created for new messages', async () => {
			const spy = jest.spyOn(serviceMessagesApi, 'writeMessage').mockImplementation(async () => ({
				isUpdate: false,
			}))

			const ctx = createMockContext({})
			ctx.request.body = JSON.parse(JSON.stringify(validInput))
			await postHandler(ctx)

			expect(ctx.response.status).toBe(201)
			spy.mockRestore()
		})

		it('should put the new message in the response body', async () => {
			const spy = jest.spyOn(serviceMessagesApi, 'writeMessage').mockImplementation(async () => ({
				isUpdate: false,
			}))

			const ctx = createMockContext({})
			ctx.request.body = JSON.parse(JSON.stringify(validInput))
			await postHandler(ctx)

			const writtenMessage = mockedWriteMessage.mock.calls[0][0]
			const expected = JSON.stringify(writtenMessage)

			/* this isn't really perfect, as it would be perfectly fine for the
			 * implementing unit to write the body with response#write.
			 * But, I'm not implementing a full mock of ServerResponse at this stage :S
			 */
			expect(ctx.body).toBe(expected)
			spy.mockRestore()
		})

		it('should reply 200 OK for updated messages', async () => {
			const spy = jest.spyOn(serviceMessagesApi, 'writeMessage').mockImplementation(async () => ({
				isUpdate: true,
			}))

			const ctx = createMockContext({})
			ctx.request.body = JSON.parse(JSON.stringify(validInput))
			await postHandler(ctx)

			expect(ctx.response.status).toBe(200)
			spy.mockRestore()
		})
		it('should put the updated message in the response body', async () => {
			const spy = jest.spyOn(serviceMessagesApi, 'writeMessage').mockImplementation(async () => ({
				isUpdate: true,
			}))

			const ctx = createMockContext({})
			ctx.request.body = JSON.parse(JSON.stringify(validInput))
			await postHandler(ctx)

			const writtenMessage = mockedWriteMessage.mock.calls[0][0]
			const expected = JSON.stringify(writtenMessage)

			/* this isn't really perfect, as it would be perfectly fine for the
			 * implementing unit to write the body with response#write.
			 * But, I'm not implementing a full mock of ServerResponse at this stage :S
			 */
			// expect(mockResponseEnd.mock.calls[0][0]).toEqual(expected)
			expect(ctx.body).toBe(expected)
			spy.mockRestore()
		})

		it('should reply 500 when message cant be stored', async () => {
			const spy = jest.spyOn(serviceMessagesApi, 'writeMessage').mockImplementation(async () => {
				throw new Error('lol')
			})

			SupressLogMessages.suppressLogMessage(/Unable to store message/i)
			const ctx = createMockContext({})
			ctx.request.body = JSON.parse(JSON.stringify(validInput))
			await postHandler(ctx)

			expect(ctx.response.status).toBe(500)
			spy.mockRestore()
		})
	})
})
