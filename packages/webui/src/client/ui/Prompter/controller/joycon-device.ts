import { ControllerAbstract } from './lib.js'
import { PrompterConfigMode, PrompterViewContent } from '../PrompterView.js'
import Spline from 'cubic-spline'
import { logger } from '../../../lib/logging.js'

type JoyconWithData = { index: number; timestamp: number; mode: JoyconMode; axes: readonly number[]; buttons: number[] }
type JoyconMode = 'L' | 'R' | 'LR' | null

/**
 * This class handles control of the prompter using
 */
export class JoyConController extends ControllerAbstract {
	private prompterView: PrompterViewContent

	private invertJoystick = false // change scrolling direction for joystick
	private rangeRevMin = -1 // pedal "all back" position, the max-reverse-position
	private rangeNeutralMin = -0.25 // pedal "back" position where reverse-range transitions to the neutral x
	private rangeNeutralMax = 0.25 // pedal "front" position where scrolling starts, the 0 speed origin
	private rangeFwdMax = 1 // pedal "all front" position where scrolling is maxed out
	private rightHandOffset = 1.4 // factor increased by 1.4 to account for the R joystick being less sensitive than L
	private speedMap = [1, 2, 3, 4, 5, 8, 12, 30]
	private reverseSpeedMap = [1, 2, 3, 4, 5, 8, 12, 30]
	private deadBand = 0.25

	private speedSpline: Spline | undefined
	private reverseSpeedSpline: Spline | undefined

	private updateSpeedHandle: number | null = null
	private timestampOfLastUsedJoyconInput = 0
	private currentPosition = 0
	private lastInputValue = ''
	private lastButtonInputs: { [index: number]: { mode: JoyconMode; buttons: number[] } } = {}

	constructor(view: PrompterViewContent) {
		super()
		this.prompterView = view

		// assigns params from URL or falls back to the default
		this.invertJoystick = view.configOptions.joycon_invertJoystick || this.invertJoystick
		this.rangeRevMin = view.configOptions.joycon_rangeRevMin || this.rangeRevMin
		this.rangeNeutralMin = view.configOptions.joycon_rangeNeutralMin || this.rangeNeutralMin
		this.rangeNeutralMax = view.configOptions.joycon_rangeNeutralMax || this.rangeNeutralMax
		this.rangeFwdMax = view.configOptions.joycon_rangeFwdMax || this.rangeFwdMax
		this.rightHandOffset = view.configOptions.joycon_rightHandOffset || this.rightHandOffset
		this.speedMap = view.configOptions.joycon_speedMap || this.speedMap
		this.reverseSpeedMap = view.configOptions.joycon_reverseSpeedMap || this.reverseSpeedMap
		this.deadBand = Math.min(Math.abs(this.rangeNeutralMin), Math.abs(this.rangeNeutralMax))

		// validate range settings, they need to be in sequence, or the logic will break
		if (this.rangeNeutralMin <= this.rangeRevMin) {
			logger.error(
				`Joycon: rangeNeutralMin (${this.rangeNeutralMin}) must be larger to rangeRevMin (${this.rangeRevMin}). Pedal control will not initialize.`
			)
			return
		}
		if (this.rangeNeutralMax <= this.rangeNeutralMin) {
			logger.error(
				`Joycon: rangeNeutralMax (${this.rangeNeutralMax}) must be larger to rangeNeutralMin (${this.rangeNeutralMin}). Pedal control will not initialize`
			)
			return
		}
		if (this.rangeFwdMax <= this.rangeNeutralMax) {
			logger.error(
				`Joycon: rangeFwdMax (${this.rangeFwdMax}) must be larger to rangeNeutralMax (${this.rangeNeutralMax}). Pedal control will not initialize`
			)
			return
		}

		// create splines, using the input speedMaps, for both the forward range, and the reverse range
		this.speedSpline = new Spline(
			this.speedMap.map(
				(_y, index, array) =>
					((this.rangeFwdMax - this.rangeNeutralMax) / (array.length - 1)) * index + this.rangeNeutralMax
			),
			this.speedMap
		)
		this.reverseSpeedSpline = new Spline(
			this.reverseSpeedMap
				.reverse()
				.map(
					(_y, index, array) =>
						((this.rangeNeutralMin - this.rangeRevMin) / (array.length - 1)) * index + this.rangeRevMin
				),
			this.reverseSpeedMap
		)

		window.addEventListener('gamepadconnected', this.updateScrollPosition.bind(this))
		window.addEventListener('gamepaddisconnected', this.updateScrollPosition.bind(this))
	}

	public destroy(): void {
		// Nothing
	}
	public onKeyDown(_e: KeyboardEvent): void {
		// Nothing
	}
	public onKeyUp(_e: KeyboardEvent): void {
		// Nothing
	}
	public onMouseKeyDown(_e: MouseEvent): void {
		// Nothing
	}
	public onMouseKeyUp(_e: MouseEvent): void {
		// Nothing
	}
	public onWheel(_e: WheelEvent): void {
		// Nothing
	}

	private onButtonRelease(_button: string, _mode?: JoyconMode | null) {
		// Nothing
	}
	private onButtonPressed(button: string, mode?: JoyconMode | null) {
		if (mode === 'L') {
			// Button overview JoyCon L single mode
			// Arrows: Left = '0', Down = '1', Up = '2', Right = '3'
			// Others: SL = '4', SR = '5', ZL = '6', L = '8', - = '9', Joystick = '10', Snapshot = '16'
			switch (button) {
				case '6':
					// go to air
					this.prompterView.scrollToLive()
					break
				// go to next
				case '8':
					this.prompterView.scrollToNext()
					break
				case '2':
					// go to top
					window.scrollTo({ top: 0, behavior: 'instant' })
					break
				case '3':
					// go to following
					this.prompterView.scrollToFollowing()
					break
				case '0':
					// // go to previous
					this.prompterView.scrollToPrevious()
					break
			}
		} else if (mode === 'R') {
			// Button overview JoyCon R single mode
			// "Arrows": A = '0', X = '1', B = '2', Y = '3'
			// Others: SL = '4', SR = '5', ZR = '7', R = '8', + = '9', Joystick = '10', Home = '16'
			switch (button) {
				case '7':
					// go to air
					this.prompterView.scrollToLive()
					break
				// go to next
				case '8':
					this.prompterView.scrollToNext()
					break
				case '1':
					// go to top
					window.scrollTo({ top: 0, behavior: 'instant' })
					break
				case '0':
					// go to following
					this.prompterView.scrollToFollowing()
					break
				case '3':
					// // go to previous
					this.prompterView.scrollToPrevious()
					break
			}
		} else if (mode === 'LR') {
			// Button overview JoyCon L+R paired mode
			// L JoyCon Arrows: B = '0', A = '1', Y = '2', X = '3'
			// L JoyCon Others: L = '4', ZL = '6', - = '8', Joystick = '10', Snapshot = '17', SL = '18', SR = '19'
			// R JoyCon "Arrows": B = '0', A = '1', Y = '2', X = '3'
			// R JoyCon Others: R = '5', ZR = '7', + = '9', Joystick = '11', Home = '16', SL = '20', SR = '21'
			switch (button) {
				case '6':
				case '7':
					// go to air
					this.prompterView.scrollToLive()
					break
				// go to next
				case '4':
				case '5':
					this.prompterView.scrollToNext()
					break
				case '12':
				case '3':
					// go to top
					window.scrollTo({ top: 0, behavior: 'instant' })
					break
				case '15':
				case '1':
					// go to following
					this.prompterView.scrollToFollowing()
					break
				case '14':
				case '2':
					// // go to previous
					this.prompterView.scrollToPrevious()
					break
			}
		}
	}

	private getJoycons() {
		const joyconInputs: JoyconWithData[] = []
		if (navigator.getGamepads) {
			const gamepads = navigator.getGamepads()
			if (!(gamepads && typeof gamepads === 'object' && gamepads.length)) return

			for (const o of gamepads) {
				if (
					o &&
					o.connected &&
					o.id &&
					typeof o.id === 'string' &&
					o.id.match('STANDARD GAMEPAD Vendor: 057e')
				) {
					const mode =
						o.axes.length === 4
							? 'LR' // for documentation: L+R mode is also identified as Vendor: 057e Product: 200e
							: o.id.match('Product: 2006')
								? 'L'
								: o.id.match('Product: 2007')
									? 'R'
									: null
					joyconInputs.push({
						index: o.index,
						timestamp: o.timestamp,
						mode,
						axes: o.axes,
						buttons: o.buttons.map((i) => i.value),
					})
				}
			}
		}

		return joyconInputs
	}

	private getActiveInputsOfJoycons(joycons: JoyconWithData[]): number {
		let lastSeenSpeed = 0

		for (const joycon of joycons) {
			// sort/filter by gamepad timestamp to use the most up-to-date input, in order to prevent the "stuck" dead joycon when going from pairs to singles
			if (joycon.timestamp >= this.timestampOfLastUsedJoyconInput) {
				// handle buttons at the same time as evaluating stick input
				this.handleButtons(joycon)

				// hadle speed input
				if (joycon.mode === 'L' || joycon.mode === 'R') {
					// L or R mode
					if (Math.abs(joycon.axes[0]) > this.deadBand) {
						if (joycon.mode === 'L') {
							lastSeenSpeed = joycon.axes[0] * -1 // in this mode, L is "negative"
						} else if (joycon.mode === 'R') {
							lastSeenSpeed = joycon.axes[0] * this.rightHandOffset // in this mode, R is "positive"
							// rightHandOffset allows for different rates between the two controllers
						}
						this.timestampOfLastUsedJoyconInput = joycon.timestamp
					}
				} else if (joycon.mode === 'LR') {
					// L + R mode
					// get the first one that is moving outside of the deadband, prioritizing the L controller
					if (Math.abs(joycon.axes[1]) > this.deadBand) {
						lastSeenSpeed = joycon.axes[1] * -1 // in this mode, we are "negative" on both sticks....
					} else if (Math.abs(joycon.axes[3]) > this.deadBand) {
						lastSeenSpeed = joycon.axes[3] * this.rightHandOffset * -1 // in this mode, we are "negative" on both sticks....
						// rightHandOffset allows for different rates between the two controllers
					}
					this.timestampOfLastUsedJoyconInput = joycon.timestamp
				}
			}
		}

		// it is random which controller is evaluated last and ultimately takes control
		return lastSeenSpeed
	}

	// @todo: should this be throttled??
	private handleButtons(joycon: JoyconWithData): void {
		const joyconButtonHistory = this.lastButtonInputs[joycon.index]

		// first time we see this joycon
		if (!joyconButtonHistory) {
			this.lastButtonInputs[joycon.index] = { mode: joycon.mode, buttons: joycon.buttons }
			return
		}

		// the joycon has changed
		if (joyconButtonHistory.mode !== joycon.mode) {
			delete this.lastButtonInputs[joycon.index]
			this.lastButtonInputs[joycon.index] = { mode: joycon.mode, buttons: joycon.buttons }
			return
		}

		if (joyconButtonHistory?.buttons?.length) {
			joycon.buttons.forEach((_o, i) => {
				const oldBtn = joyconButtonHistory.buttons[i]
				const newBtn = joycon.buttons[i]
				if (!oldBtn && newBtn) {
					// press
					this.onButtonPressed(i.toString(), joycon.mode)
				} else if (oldBtn && !newBtn) {
					// release
					this.onButtonRelease(i.toString(), joycon.mode)
				}
			})

			this.lastButtonInputs[joycon.index].buttons = joycon.buttons
		}
	}

	private calculateSpeed(inputs: JoyconWithData[]) {
		if (!this.reverseSpeedSpline || !this.speedSpline) return 0

		const { rangeRevMin, rangeNeutralMin, rangeNeutralMax, rangeFwdMax } = this
		let inputValue = this.getActiveInputsOfJoycons(inputs)

		// start by clamping value to the legal range
		inputValue = Math.min(Math.max(inputValue, rangeRevMin), rangeFwdMax) // clamps in between rangeRevMin and rangeFwdMax
		// stores only for debugging
		this.lastInputValue = inputValue.toFixed(2)

		if (inputValue >= rangeRevMin && inputValue <= rangeNeutralMin) {
			// 1) Use the reverse speed spline for the expected speed. The reverse speed is specified using positive values,
			//    so the result needs to be inversed
			if (this.invertJoystick) {
				return Math.round(this.reverseSpeedSpline.at(inputValue))
			} else {
				return Math.round(this.reverseSpeedSpline.at(inputValue)) * -1
			}
		} else if (inputValue >= rangeNeutralMin && inputValue <= rangeNeutralMax) {
			// 2) we're in the neutral zone
			return 0
		} else if (inputValue >= rangeNeutralMax && inputValue <= rangeFwdMax) {
			// 3) Use the speed spline to find the expected speed at this point
			if (this.invertJoystick) {
				return Math.round(this.speedSpline.at(inputValue)) * -1
			} else {
				return Math.round(this.speedSpline.at(inputValue))
			}
		} else {
			// 4) we should never be able to hit this due to validation above
			logger.error(`Joycon: Illegal input value ${inputValue}`)
			return 0
		}
	}

	private updateScrollPosition() {
		if (this.updateSpeedHandle !== null) return
		const joycons = this.getJoycons()
		if (!joycons?.length) return

		const speed = this.calculateSpeed(joycons)

		// update scroll position
		window.scrollBy({ top: speed, behavior: 'instant' })

		const scrollPosition = window.scrollY
		// check for reached end-of-scroll:
		if (this.currentPosition !== undefined && scrollPosition !== undefined) {
			if (this.currentPosition === scrollPosition) {
				// We tried to move, but haven't
				// @todo: haptic feedback
			}
		}
		this.currentPosition = scrollPosition

		// debug
		// @todo: can this be throttled?
		this.prompterView.DEBUG_controllerState({
			source: PrompterConfigMode.JOYCON,
			lastSpeed: speed,
			lastEvent: 'ControlChange: ' + this.lastInputValue,
		})

		this.updateSpeedHandle = window.requestAnimationFrame(() => {
			this.updateSpeedHandle = null
			this.updateScrollPosition()
		})
	}
}
