import { PrompterViewContent, PrompterConfigMode } from '../PrompterView.js'
import { MouseIshController } from './mouse-ish-device.js'
import { MidiPedalController } from './midi-pedal-device.js'
import { ControllerAbstract } from './lib.js'
import { JoyConController } from './joycon-device.js'
import { KeyboardController } from './keyboard-device.js'
import { ShuttleKeyboardController } from './shuttle-keyboard-device.js'
import { ShuttleWebHidController } from './shuttle-webhid-device.js'

export class PrompterControlManager {
	private _view: PrompterViewContent
	private _controllers: Array<ControllerAbstract> = []

	constructor(view: PrompterViewContent) {
		this._view = view

		window.addEventListener('keydown', this._onKeyDown)
		window.addEventListener('keyup', this._onKeyUp)
		window.addEventListener('wheel', this._onWheel, { passive: false })
		window.addEventListener('mousedown', this._onMouseKeyDown)
		window.addEventListener('mouseup', this._onMouseKeyUp)

		if (Array.isArray(this._view.configOptions.mode)) {
			if (this._view.configOptions.mode.indexOf(PrompterConfigMode.MOUSE) > -1) {
				this._controllers.push(new MouseIshController(this._view))
			}
			if (this._view.configOptions.mode.indexOf(PrompterConfigMode.KEYBOARD) > -1) {
				this._controllers.push(new KeyboardController(this._view))
			}
			if (this._view.configOptions.mode.indexOf(PrompterConfigMode.SHUTTLEKEYBOARD) > -1) {
				this._controllers.push(new ShuttleKeyboardController(this._view))
			}
			if (this._view.configOptions.mode.indexOf(PrompterConfigMode.PEDAL) > -1) {
				this._controllers.push(new MidiPedalController(this._view))
			}
			if (this._view.configOptions.mode.indexOf(PrompterConfigMode.JOYCON) > -1) {
				this._controllers.push(new JoyConController(this._view))
			}
			if (this._view.configOptions.mode.indexOf(PrompterConfigMode.SHUTTLEWEBHID) > -1) {
				this._controllers.push(new ShuttleWebHidController(this._view))
			}
		}

		if (this._controllers.length === 0) {
			// Default behaviour:
			this._controllers.push(new MouseIshController(this._view))
			this._controllers.push(new KeyboardController(this._view))
		}
	}

	destroy(): void {
		window.removeEventListener('keydown', this._onKeyDown)
		window.removeEventListener('keyup', this._onKeyUp)
		window.removeEventListener('wheel', this._onWheel)
		window.removeEventListener('mousedown', this._onMouseKeyDown)
		window.removeEventListener('mouseup', this._onMouseKeyUp)

		this._controllers.forEach((c) => c.destroy())
		this._controllers = []
	}
	private _onKeyDown = (e: KeyboardEvent) => {
		this._controllers.forEach((c) => c.onKeyDown(e))
	}
	private _onKeyUp = (e: KeyboardEvent) => {
		this._controllers.forEach((c) => c.onKeyUp(e))
	}
	private _onMouseKeyDown = (e: MouseEvent) => {
		this._controllers.forEach((c) => c.onMouseKeyDown(e))
	}
	private _onMouseKeyUp = (e: MouseEvent) => {
		this._controllers.forEach((c) => c.onMouseKeyUp(e))
	}
	private _onWheel = (e: WheelEvent) => {
		this._controllers.forEach((c) => c.onWheel(e))
	}
}
