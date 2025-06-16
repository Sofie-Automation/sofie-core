import { createHmac, randomBytes } from 'crypto'
import { Time } from '@sofie-automation/blueprints-integration'
import { getHash } from '@sofie-automation/corelib/dist/hash'
import { getCurrentTime } from '../lib/lib'
import { SINGLE_USE_TOKEN_SALT } from '@sofie-automation/meteor-lib/dist/api/userActions'
import { isInTestWrite } from '../security/securityVerify'

// The following code is taken from an NPM pacakage called "@sunknudsen/totp", but copied here, instead
// of used as a dependency so that it's not vulnerable to a supply chain attack

const VALIDITY_PERIOD = 30 // seconds

export function generateToken(secret: string = TOKEN_SECRET, timestamp = getCurrentTime()): string {
	const message = Buffer.from(
		`0000000000000000${Math.floor(Math.round(timestamp / 1000) / VALIDITY_PERIOD).toString(16)}`.slice(-16),
		'hex'
	)
	const key = Buffer.from(base32ToHex(secret.toUpperCase()), 'hex')
	const hmac = createHmac('sha1', key)
	hmac.setEncoding('hex')
	hmac.update(message)
	hmac.end()
	const data = hmac.read()
	return (parseInt(data.substr(parseInt(data.slice(-1), 16) * 2, 8), 16) & 2147483647).toString().slice(-6)
}

export function verifyHashedToken(token: string, secret: string = TOKEN_SECRET, timestamp = getCurrentTime()): boolean {
	// this is needed, so that verifyAllMethods() in securityVerify.ts can run on startup
	if (isInTestWrite()) {
		return true
	}

	// the token has already been used
	if (usedTokensShortTermMemory.has(token)) {
		return false
	}

	let valid = false
	if (token === getHash(SINGLE_USE_TOKEN_SALT + generateToken(secret, timestamp))) {
		valid = true
	}
	// accept a token generated before this validity period
	if (
		!valid &&
		token === getHash(SINGLE_USE_TOKEN_SALT + generateToken(secret, timestamp - 1000 * VALIDITY_PERIOD))
	) {
		valid = true
	}
	if (valid) {
		usedTokensShortTermMemory.set(token, timestamp)
		// we can forget that the token has been used after the validity window has passed, because it will be invalid anyway
		setTimeout(
			() => {
				usedTokensShortTermMemory.delete(token)
			},
			3 * 1000 * VALIDITY_PERIOD
		)
	}
	return valid
}

/**
 * A store to quickly reject valid tokens that have already been used, without verifying their validity
 */
const usedTokensShortTermMemory = new Map<string, Time>()

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

const TOKEN_SECRET_LENGTH = 64

/**
 * An automatically generated secret, regenerated on every restart, so that tokens can't be re-used between restarts.
 *
 * TODO: For horizontal scaling of Core, this would have to be stored in the database or provided as an environment
 * variable
 */
const TOKEN_SECRET = randomBytes(TOKEN_SECRET_LENGTH)
	.map((value) => CHARSET.charCodeAt(Math.floor((value * CHARSET.length) / 256)))
	.toString()

function base32ToHex(base32: string): string {
	let bits = ''
	let hex = ''
	for (let index = 0; index < base32.length; index++) {
		const value = CHARSET.indexOf(base32.charAt(index))
		bits += `00000${value.toString(2)}`.slice(-5)
	}
	for (let index = 0; index < bits.length - 3; index += 4) {
		const chunk = bits.substring(index, index + 4)
		hex = hex + parseInt(chunk, 2).toString(16)
	}
	return hex
}

/**
MIT License

Copyright (c) 2022 - present Sun Knudsen and contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
