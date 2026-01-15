import { ControllerAbstract } from './lib.js'
import { PrompterConfigMode, PrompterViewContent } from '../PrompterView.js'
import Spline from 'cubic-spline'
import { logger } from '../../../lib/logging.js'

/**
 * This class handles control of the prompter using an Xbox controller
 * via the HTML5 Gamepad API.
 *
 * Controls:
 * - Right Trigger (RT): Scroll forward (speed proportional to trigger pressure)
 * - Left Trigger (LT): Scroll backward (speed proportional to trigger pressure)
 * - A Button: Take (go to next part)
 * - B Button: Go to Live/On-Air
 * - X Button: Go to previous segment
 * - Y Button: Go to following segment
 * - Left Bumper (LB): Go to top
 * - Right Bumper (RB): Go to Next
 * - D-Pad Up/Down: Fine scroll control
 */
export class XboxController extends ControllerAbstract {
	private readonly prompterView: PrompterViewContent

	// Speed maps for trigger input (0-1 range)
	private readonly speedMap: number[]
	private readonly reverseSpeedMap: number[]

	// Trigger dead zones
	private readonly triggerDeadZone: number

	private readonly speedSpline: Spline | undefined
	private readonly reverseSpeedSpline: Spline | undefined

	private updateSpeedHandle: number | null = null
	private currentPosition = 0
	private lastInputValue = ''
	private lastButtonStates: { [index: number]: boolean[] } = {}

	// Track if take was recently pressed to prevent rapid-fire
	private readonly takeDebounceTime = 500 // ms
	private lastTakeTime = 0

	// Bound event handlers for cleanup
	private readonly onGamepadConnectedBound: (e: GamepadEvent) => void
	private readonly onGamepadDisconnectedBound: (e: GamepadEvent) => void

	constructor(view: PrompterViewContent) {
		super()
		this.prompterView = view

		// Assign params from URL or fall back to defaults
		this.speedMap = view.configOptions.xbox_speedMap || [2, 3, 5, 6, 8, 12, 18, 45]
		this.reverseSpeedMap = view.configOptions.xbox_reverseSpeedMap || [2, 3, 5, 6, 8, 12, 18, 45]
		this.triggerDeadZone = view.configOptions.xbox_triggerDeadZone ?? 0.1

		// Create splines for smooth speed interpolation
		// Forward speed spline (for right trigger, 0-1 range)
		this.speedSpline = new Spline(
			this.speedMap.map((_y, index, array) => (1 / (array.length - 1)) * index),
			this.speedMap
		)

		// Reverse speed spline (for left trigger, 0-1 range)
		this.reverseSpeedSpline = new Spline(
			this.reverseSpeedMap.map((_y, index, array) => (1 / (array.length - 1)) * index),
			this.reverseSpeedMap
		)

		this.onGamepadConnectedBound = this.onGamepadConnected.bind(this)
		this.onGamepadDisconnectedBound = this.onGamepadDisconnected.bind(this)

		window.addEventListener('gamepadconnected', this.onGamepadConnectedBound)
		window.addEventListener('gamepaddisconnected', this.onGamepadDisconnectedBound)

		// Start polling if a controller is already connected
		this.startPolling()
	}

	public destroy(): void {
		window.removeEventListener('gamepadconnected', this.onGamepadConnectedBound)
		window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnectedBound)

		if (this.updateSpeedHandle !== null) {
			window.cancelAnimationFrame(this.updateSpeedHandle)
			this.updateSpeedHandle = null
		}
	}

	public onKeyDown(_e: KeyboardEvent): void {
		// Nothing - Xbox controller uses gamepad API
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

	private onGamepadConnected(e: GamepadEvent): void {
		if (this.isXboxController(e.gamepad)) {
			logger.info(`Xbox controller connected: ${e.gamepad.id}`)
			this.startPolling()
		}
	}

	private onGamepadDisconnected(e: GamepadEvent): void {
		if (this.isXboxController(e.gamepad)) {
			logger.info(`Xbox controller disconnected: ${e.gamepad.id}`)
		}
	}

	private isXboxController(gamepad: Gamepad): boolean {
		// Xbox controllers typically have these vendor/product patterns
		// Also match generic "xinput" controllers and "Xbox" in the name
		const id = gamepad.id.toLowerCase()
		return (
			id.includes('xbox') ||
			id.includes('xinput') ||
			id.includes('045e') || // Microsoft vendor ID
			id.includes('microsoft') ||
			// Standard gamepad mapping with 4 axes and 17 buttons is typical for Xbox
			(gamepad.mapping === 'standard' && gamepad.axes.length >= 4 && gamepad.buttons.length >= 17)
		)
	}

	private getXboxControllers(): Gamepad[] {
		const controllers: Gamepad[] = []
		if (navigator.getGamepads) {
			const gamepads = navigator.getGamepads()
			if (gamepads) {
				for (const gamepad of gamepads) {
					if (gamepad && gamepad.connected && this.isXboxController(gamepad)) {
						controllers.push(gamepad)
					}
				}
			}
		}
		return controllers
	}

	private startPolling(): void {
		if (this.updateSpeedHandle === null) {
			this.updateScrollPosition()
		}
	}

	/**
	 * Xbox Controller Standard Mapping:
	 * Buttons:
	 *   0: A
	 *   1: B
	 *   2: X
	 *   3: Y
	 *   4: LB (Left Bumper)
	 *   5: RB (Right Bumper)
	 *   6: LT (Left Trigger) - also available as axis
	 *   7: RT (Right Trigger) - also available as axis
	 *   8: Back/View
	 *   9: Start/Menu
	 *   10: Left Stick Press
	 *   11: Right Stick Press
	 *   12: D-Pad Up
	 *   13: D-Pad Down
	 *   14: D-Pad Left
	 *   15: D-Pad Right
	 *   16: Xbox/Guide button
	 *
	 * Axes:
	 *   0: Left Stick X (-1 left, 1 right)
	 *   1: Left Stick Y (-1 up, 1 down)
	 *   2: Right Stick X (-1 left, 1 right)
	 *   3: Right Stick Y (-1 up, 1 down)
	 */

	private handleButtons(gamepad: Gamepad): void {
		const buttonHistory = this.lastButtonStates[gamepad.index]
		const currentButtons = gamepad.buttons.map((b) => b.pressed)

		// First time seeing this controller
		if (!buttonHistory) {
			this.lastButtonStates[gamepad.index] = currentButtons
			return
		}

		// Check for button state changes
		currentButtons.forEach((pressed, index) => {
			const wasPressed = buttonHistory[index]
			if (pressed && !wasPressed) {
				this.onButtonPressed(index, gamepad)
			}
		})

		this.lastButtonStates[gamepad.index] = currentButtons
	}

	private onButtonPressed(buttonIndex: number, _gamepad: Gamepad): void {
		const now = Date.now()

		switch (buttonIndex) {
			case 0: // A Button - Take
				if (now - this.lastTakeTime > this.takeDebounceTime) {
					this.lastTakeTime = now
					this.prompterView.take('Xbox Controller A Button')
				}
				break
			case 1: // B Button - Go to Live/On-Air
				this.prompterView.scrollToLive()
				break
			case 2: // X Button - Go to previous segment
				this.prompterView.scrollToPrevious()
				break
			case 3: // Y Button - Go to following segment
				this.prompterView.scrollToFollowing()
				break
			case 4: // LB - Go to top
				window.scrollTo({ top: 0, behavior: 'instant' })
				break
			case 5: // RB - Go to Next
				this.prompterView.scrollToNext()
				break
			case 12: // D-Pad Up - scroll up a bit
				window.scrollBy({ top: -100, behavior: 'smooth' })
				break
			case 13: // D-Pad Down - scroll down a bit
				window.scrollBy({ top: 100, behavior: 'smooth' })
				break
		}
	}

	private calculateSpeed(controllers: Gamepad[]): number {
		if (!this.speedSpline || !this.reverseSpeedSpline) return 0

		let speed = 0

		for (const controller of controllers) {
			// Get trigger values
			// In standard mapping, triggers are buttons 6 (LT) and 7 (RT) with value 0-1
			const leftTrigger = controller.buttons[6]?.value ?? 0
			const rightTrigger = controller.buttons[7]?.value ?? 0

			// Apply dead zone
			const effectiveLeft = leftTrigger > this.triggerDeadZone ? leftTrigger : 0
			const effectiveRight = rightTrigger > this.triggerDeadZone ? rightTrigger : 0

			// Store for debugging
			this.lastInputValue = `LT: ${effectiveLeft.toFixed(2)}, RT: ${effectiveRight.toFixed(2)}`

			// Calculate speed from triggers
			// Right trigger = forward (positive speed)
			// Left trigger = backward (negative speed)
			if (effectiveRight > 0) {
				speed += Math.round(this.speedSpline.at(effectiveRight))
			}
			if (effectiveLeft > 0) {
				speed -= Math.round(this.reverseSpeedSpline.at(effectiveLeft))
			}
		}

		return speed
	}

	private updateScrollPosition(): void {
		const controllers = this.getXboxControllers()

		if (controllers.length > 0) {
			// Handle button presses
			for (const controller of controllers) {
				this.handleButtons(controller)
			}

			// Calculate and apply scroll speed
			const speed = this.calculateSpeed(controllers)

			if (speed !== 0) {
				window.scrollBy({ top: speed, behavior: 'instant' })
			}

			const scrollPosition = window.scrollY
			if (speed !== 0 && this.currentPosition === scrollPosition) {
				// We tried to move but couldn't (reached end)
				// Could add haptic feedback here if supported
			}
			this.currentPosition = scrollPosition

			// Debug output
			this.prompterView.DEBUG_controllerState({
				source: PrompterConfigMode.XBOX,
				lastSpeed: speed,
				lastEvent: this.lastInputValue,
			})
		}

		// Continue polling
		this.updateSpeedHandle = window.requestAnimationFrame(this.updateScrollPosition.bind(this))
	}
}
