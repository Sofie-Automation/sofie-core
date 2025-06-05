export namespace hotkeyHelper {
	export function shortcutLabel(hotkey: string, isMacLike = false): string {
		if (isMacLike) {
			hotkey = hotkey.replace(/Accel/, '\u2318')
		} else {
			hotkey = hotkey.replace(/Accel/, 'Ctrl')
		}

		// capitalize first letter of each combo key
		hotkey = hotkey
			.replace(/(\w)\w*/gi, (substring: string) => {
				return substring.substr(0, 1).toUpperCase() + substring.substr(1)
			})
			.replace(/(\s*,\s*)/g, ', ')
			.replace(/(?<!\+)\+/g, '+\u200b')

		return hotkey
	}
}
