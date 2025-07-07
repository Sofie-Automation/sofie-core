import { PrompterViewContent } from '../PrompterView'
import { ShuttleWebHidController } from './shuttle-webhid-device'

enum ShuttleButtonTriggerMode {
	PRESSED = 'pressed',
	RELEASED = 'released',
}

export class CustomizableShuttleWebHidController extends ShuttleWebHidController {
	private actionMap: Record<number, string> = {}

	constructor(view: PrompterViewContent) {
		super(view)
		view.configOptions.shuttleWebHid_buttonMap?.forEach((entry) => {
			const substrings = entry.split(':')
			if (substrings.length !== 2) return
			this.actionMap[parseInt(substrings[0], 10)] = substrings[1]
		})
	}

	protected onButtonPressed(keyIndex: number): void {
		const actionId = this.actionMap[keyIndex]
		if (actionId === undefined) return super.onButtonPressed(keyIndex)

		this.prompterView.executeAction(`Shuttle button ${keyIndex} press`, actionId, ShuttleButtonTriggerMode.PRESSED)
	}

	protected onButtonReleased(keyIndex: number): void {
		const actionId = this.actionMap[keyIndex]
		if (actionId === undefined) return super.onButtonReleased(keyIndex)

		this.prompterView.executeAction(
			`Shuttle button ${keyIndex} release`,
			actionId,
			ShuttleButtonTriggerMode.RELEASED
		)
	}
}
