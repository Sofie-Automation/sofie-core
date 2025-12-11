import { formatDateTime } from '../time.js'

test('formatDateTime', () => {
	expect(formatDateTime(1556194064374)).toMatch(/2019-04-\d{2} \d{2}:\d{2}:\d{2}/)
})

// eslint-disable-next-line jest/no-commented-out-tests
// test('formatDateTime2', () => {
// 	if (process.platform === 'win32') {
// 		// Due to a bug in how timezones are handled in Windows & Node, we just have to skip these tests when running tests locally..
// 		// eslint-disable-next-line jest/no-conditional-expect
// 		expect(0).toEqual(0)
// 		return
// 	}

// 	expect(new Date().getTimezoneOffset()).toBe(0) // Timezone is UTC

// 	expect(formatDateTime(1578295344070)).toBe('2020-01-06 07:22:24')
// 	expect(formatDateTime(1578389166594)).toBe('2020-01-07 09:26:06')
// 	expect(formatDateTime(2579299201000)).toBe('2051-09-26 00:00:01')
// 	expect(formatDateTime(2579299200000)).toBe('2051-09-26 00:00:00')
// 	expect(formatDateTime(2579299344070)).toBe('2051-09-26 00:02:24')
// })
