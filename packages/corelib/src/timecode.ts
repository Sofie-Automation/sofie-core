const zeroPad = function (number: number) {
	const pad = number < 10 ? '0' : ''
	return pad + Math.floor(number)
}

export interface TimecodeInitArgs {
	framerate?: string
	timecode?: string | number | Date
	drop_frame?: boolean
}

/**
 * This is a JavaScript module for manipulating SMPTE timecodes.
 * Based upon timecode from npm, but ported to typescript to resolve build issues due to older syntax
 *
 * https://github.com/reidransom/timecode.js
 * The MIT License (MIT) Copyright (c) 2016 Reid Ransom
 */
export class Timecode {
	#framerate: string
	#int_framerate: number
	#drop_frame: boolean
	#hours: number
	#minutes: number
	#seconds: number
	#frames: number
	#frame_count: number

	get hours(): number {
		return this.#hours
	}
	get minutes(): number {
		return this.#minutes
	}
	get seconds(): number {
		return this.#seconds
	}
	get frames(): number {
		return this.#frames
	}
	get frame_count(): number {
		return this.#frame_count
	}

	private constructor(args?: TimecodeInitArgs) {
		this.#framerate = args?.framerate ?? '29.97'
		this.#int_framerate = this.#getIntFramerate()
		this.#drop_frame = !!args?.drop_frame
		this.#hours = 0
		this.#minutes = 0
		this.#seconds = 0
		this.#frames = 0
		this.#frame_count = 0
		this.set(args?.timecode ?? 0)
	}

	static init(args?: TimecodeInitArgs): Timecode {
		// Future: drop this static init
		return new Timecode(args)
	}

	set(timecode: string | number | Date): void {
		if (typeof timecode === 'string') {
			this.#partsFromString(timecode)
			this.#timecodeToFrameNumber()
			this.#frameNumberToTimecode()
		} else if (typeof timecode === 'number') {
			this.#frame_count = timecode
			this.#frameNumberToTimecode()
		} else if (timecode instanceof Date) {
			this.#frame_count = this.#dateToFrameNumber(timecode)
			this.#frameNumberToTimecode()
		} else {
			// throw an error
		}
	}

	add(...offsets: (string | number | Date | Timecode)[]): void {
		/*
		// This takes one or more Timecode objects as arguments
		// If this has been initialized, add to this, otherwise just add timecodes given.
		var timecodes = [];
		if (this.frame_count) {
			timecodes.push(this);
		}
		*/
		this.#calculate('+', offsets)
	}
	subtract(...offsets: (string | number | Date | Timecode)[]): void {
		this.#calculate('-', offsets)
	}

	toString(): string {
		const delim = this.#drop_frame ? ';' : ':'
		return (
			zeroPad(this.hours) +
			':' +
			zeroPad(this.minutes) +
			':' +
			zeroPad(this.seconds) +
			delim +
			zeroPad(this.frames)
		)
	}

	#calculate(sign: string, timecodes: (string | number | Date | Timecode)[]) {
		// all timecodes are calculated in place
		for (const timecode of timecodes) {
			let parsedTimecode: Timecode

			// if a string, number or Date is given, convert it to a timecode
			if (typeof timecode === 'string' || typeof timecode === 'number' || timecode instanceof Date) {
				parsedTimecode = Timecode.init({
					framerate: this.#framerate,
					timecode: timecode,
					drop_frame: this.#drop_frame,
				})
			} else if (timecode instanceof Timecode) {
				parsedTimecode = timecode
			} else {
				throw new Error('Expected timecode to be a string, number, Date or Timecode object.')
			}

			// make sure this is a valid timecode
			if (parsedTimecode.frame_count) {
				if (parsedTimecode.#framerate != this.#framerate) {
					throw new Error('Timecode framerates must match to do calculations.')
				}
				let frame_count: number
				if (sign === '-') {
					frame_count = parsedTimecode.frame_count * -1
				} else if (sign === '+') {
					frame_count = parsedTimecode.frame_count
				} else {
					throw new Error('Expected sign to be + or -.')
				}
				this.#frame_count = this.frame_count + frame_count
				this.#frameNumberToTimecode()
			}
		}
	}

	#getIntFramerate() {
		if (this.#framerate === 'ms') {
			return 1000
		} else {
			return Math.round(Number(this.#framerate))
		}
	}
	#partsFromString(timecode: string) {
		// Parses timecode strings non-drop 'hh:mm:ss:ff', drop 'hh:mm:ss;ff', or milliseconds 'hh:mm:ss:fff'
		if (timecode.length === 11) {
			this.#frames = Number(timecode.slice(9, 11))
		} else if (timecode.length === 12 && this.#framerate === 'ms') {
			this.#frames = Number(timecode.slice(9, 12))
		} else {
			throw new Error('Timecode string parsing error. ' + timecode)
		}
		this.#hours = Number(timecode.slice(0, 2))
		this.#minutes = Number(timecode.slice(3, 5))
		this.#seconds = Number(timecode.slice(6, 8))
	}
	#frameNumberToTimecode() {
		// Converts frame_count to timecode
		let frame_count = this.#frame_count
		if (this.#drop_frame) {
			const parts = this.#frameNumberToDropFrameTimecode(frame_count)
			this.#hours = parts[0]
			this.#minutes = parts[1]
			this.#seconds = parts[2]
			this.#frames = parts[3]
		} else {
			this.#hours = frame_count / (3600 * this.#int_framerate)
			if (this.#hours > 23) {
				this.#hours = this.#hours % 24
				frame_count = frame_count - 23 * 3600 * this.#int_framerate
			}
			this.#minutes = (frame_count % (3600 * this.#int_framerate)) / (60 * this.#int_framerate)
			this.#seconds =
				((frame_count % (3600 * this.#int_framerate)) % (60 * this.#int_framerate)) / this.#int_framerate
			this.#frames =
				((frame_count % (3600 * this.#int_framerate)) % (60 * this.#int_framerate)) % this.#int_framerate
			this.#hours = Math.floor(this.#hours)
			this.#minutes = Math.floor(this.#minutes)
			this.#seconds = Math.floor(this.#seconds)
			this.#frames = Math.floor(this.#frames)
		}
	}
	#timecodeToFrameNumber() {
		// converts the current timecode to frame_count.
		if (this.#drop_frame) {
			this.#frame_count = this.#dropFrameTimecodeToFrameNumber([
				this.#hours,
				this.#minutes,
				this.#seconds,
				this.#frames,
			])
		} else {
			this.#frame_count =
				(this.#hours * 3600 + this.#minutes * 60 + this.#seconds) * this.#int_framerate + this.#frames
		}
	}
	#frameNumberToDropFrameTimecode(frame_number: number) {
		const framerate = Number(this.#framerate)
		const drop_frames = Math.round(framerate * 0.066666)
		const frames_per_hour = Math.round(framerate * 60 * 60)
		const frames_per_24_hours = frames_per_hour * 24
		const frames_per_10_minutes = Math.round(framerate * 60 * 10)
		const frames_per_minute = Math.round(framerate * 60)
		// Roll over clock if greater than 24 hours
		frame_number = frame_number % frames_per_24_hours
		// If time is negative, count back from 24 hours
		if (frame_number < 0) {
			frame_number = frames_per_24_hours + frame_number
		}
		const d = Math.floor(frame_number / frames_per_10_minutes)
		const m = frame_number % frames_per_10_minutes
		if (m > drop_frames) {
			frame_number =
				frame_number + drop_frames * 9 * d + drop_frames * Math.floor((m - drop_frames) / frames_per_minute)
		} else {
			frame_number = frame_number + drop_frames * 9 * d
		}
		return [
			Math.floor(Math.floor(Math.floor(frame_number / this.#int_framerate) / 60) / 60),
			Math.floor(Math.floor(frame_number / this.#int_framerate) / 60) % 60,
			Math.floor(frame_number / this.#int_framerate) % 60,
			frame_number % this.#int_framerate,
		]
	}
	#dropFrameTimecodeToFrameNumber(timecode_as_list: number[]) {
		const hours = timecode_as_list[0]
		const minutes = timecode_as_list[1]
		const seconds = timecode_as_list[2]
		const frames = timecode_as_list[3]
		const drop_frames = Math.round(Number(this.#framerate) * 0.066666)
		const hour_frames = this.#int_framerate * 60 * 60
		const minute_frames = this.#int_framerate * 60
		const total_minutes = hours * 60 + minutes
		const frame_number =
			hour_frames * hours +
			minute_frames * minutes +
			this.#int_framerate * seconds +
			frames -
			drop_frames * (total_minutes - Math.floor(total_minutes / 10))
		return frame_number
	}

	/**
	 * Converts the hour, minute, second, millisecond part of Date() object to the number of
	 * frames using the current framerate
	 */
	#dateToFrameNumber(dt: Date): number {
		const midnight = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 0, 0, 0)
		return Math.floor(((dt.getTime() - midnight.getTime()) / 1000) * Number(this.#framerate))
	}
}
