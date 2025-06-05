import {
	SomeBlueprintTrigger,
	IBlueprintHotkeyTrigger,
	TriggerType,
	IBlueprintDeviceTrigger,
} from '@sofie-automation/blueprints-integration'

export function isHotkeyTrigger(trigger: SomeBlueprintTrigger | undefined): trigger is IBlueprintHotkeyTrigger {
	if (!trigger) return false
	if (trigger.type === TriggerType.hotkey) return true
	return false
}

export function isDeviceTrigger(trigger: SomeBlueprintTrigger | undefined): trigger is IBlueprintDeviceTrigger {
	if (!trigger) return false
	if (trigger.type === TriggerType.device) return true
	return false
}
