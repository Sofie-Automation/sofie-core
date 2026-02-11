import { useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import Form from 'react-bootstrap/esm/Form'
import Collapse from 'react-bootstrap/esm/Collapse'

import './PrompterConfigForm.scss'

interface PrompterConfigState {
	// Display options
	mirror: boolean | null
	mirrorv: boolean | null
	fontsize: number | null
	margin: number | null
	marker: string | null
	showmarker: boolean | null
	showscroll: boolean | null
	followtake: boolean | null
	showoverunder: boolean | null
	debug: boolean | null

	// Mode selections
	mode_mouse: boolean
	mode_keyboard: boolean
	mode_shuttlekeyboard: boolean
	mode_shuttlewebhid: boolean
	mode_pedal: boolean
	mode_joycon: boolean
	mode_xbox: boolean

	// Mouse options
	controlmode: string | null

	// Shuttle keyboard options
	shuttle_speedMap: string | null

	// Pedal options
	pedal_speedMap: string | null
	pedal_reverseSpeedMap: string | null
	pedal_rangeRevMin: number | null
	pedal_rangeNeutralMin: number | null
	pedal_rangeNeutralMax: number | null
	pedal_rangeFwdMax: number | null

	// Joy-Con options
	joycon_speedMap: string | null
	joycon_reverseSpeedMap: string | null
	joycon_rangeRevMin: number | null
	joycon_rangeNeutralMin: number | null
	joycon_rangeNeutralMax: number | null
	joycon_rangeFwdMax: number | null
	joycon_rightHandOffset: number | null
	joycon_invertJoystick: boolean | null

	// Xbox options
	xbox_speedMap: string | null
	xbox_reverseSpeedMap: string | null
	xbox_triggerDeadZone: number | null
}

const initialState: PrompterConfigState = {
	mirror: null,
	mirrorv: null,
	fontsize: null,
	margin: null,
	marker: null,
	showmarker: null,
	showscroll: null,
	followtake: null,
	showoverunder: null,
	debug: null,

	mode_mouse: false,
	mode_keyboard: false,
	mode_shuttlekeyboard: false,
	mode_shuttlewebhid: false,
	mode_pedal: false,
	mode_joycon: false,
	mode_xbox: false,

	controlmode: null,

	shuttle_speedMap: null,

	pedal_speedMap: null,
	pedal_reverseSpeedMap: null,
	pedal_rangeRevMin: null,
	pedal_rangeNeutralMin: null,
	pedal_rangeNeutralMax: null,
	pedal_rangeFwdMax: null,

	joycon_speedMap: null,
	joycon_reverseSpeedMap: null,
	joycon_rangeRevMin: null,
	joycon_rangeNeutralMin: null,
	joycon_rangeNeutralMax: null,
	joycon_rangeFwdMax: null,
	joycon_rightHandOffset: null,
	joycon_invertJoystick: null,

	xbox_speedMap: null,
	xbox_reverseSpeedMap: null,
	xbox_triggerDeadZone: null,
}

/** Helper to add a parameter to URLSearchParams if the value is not null */
function addParam(params: URLSearchParams, key: string, value: string | number | boolean | null): void {
	if (value === null) return
	if (typeof value === 'boolean') {
		params.set(key, value ? '1' : '0')
	} else {
		params.set(key, String(value))
	}
}

/**
 * Safe integer parser that returns null for empty or non-numeric input
 */
function parseIntOrNull(value: string): number | null {
	if (!value) return null
	const n = Number.parseInt(value, 10)
	return Number.isNaN(n) ? null : n
}

/**
 * Safe float parser that returns null for empty or non-numeric input
 */
function parseFloatOrNull(value: string): number | null {
	if (!value) return null
	const n = Number.parseFloat(value)
	return Number.isNaN(n) ? null : n
}

/** Build mode string from mode selections */
function buildModeString(config: PrompterConfigState): string {
	const modes: string[] = []
	if (config.mode_mouse) modes.push('mouse')
	if (config.mode_keyboard) modes.push('keyboard')
	if (config.mode_shuttlekeyboard) modes.push('shuttlekeyboard')
	if (config.mode_shuttlewebhid) modes.push('shuttlewebhid')
	if (config.mode_pedal) modes.push('pedal')
	if (config.mode_joycon) modes.push('joycon')
	if (config.mode_xbox) modes.push('xbox')
	return modes.join(',')
}

/** Add display option parameters */
function addDisplayParams(params: URLSearchParams, config: PrompterConfigState): void {
	addParam(params, 'mirror', config.mirror)
	addParam(params, 'mirrorv', config.mirrorv)
	addParam(params, 'fontsize', config.fontsize)
	addParam(params, 'margin', config.margin)
	addParam(params, 'marker', config.marker)
	addParam(params, 'showmarker', config.showmarker)
	addParam(params, 'showscroll', config.showscroll)
	addParam(params, 'followtake', config.followtake)
	addParam(params, 'showoverunder', config.showoverunder)
	addParam(params, 'debug', config.debug)
}

/** Add controller-specific parameters */
function addControllerParams(params: URLSearchParams, config: PrompterConfigState): void {
	// Mouse
	if (config.mode_mouse) {
		addParam(params, 'controlmode', config.controlmode)
	}
	// Shuttle keyboard
	if (config.mode_shuttlekeyboard) {
		addParam(params, 'shuttle_speedMap', config.shuttle_speedMap)
	}
	// Pedal
	if (config.mode_pedal) {
		addParam(params, 'pedal_speedMap', config.pedal_speedMap)
		addParam(params, 'pedal_reverseSpeedMap', config.pedal_reverseSpeedMap)
		addParam(params, 'pedal_rangeRevMin', config.pedal_rangeRevMin)
		addParam(params, 'pedal_rangeNeutralMin', config.pedal_rangeNeutralMin)
		addParam(params, 'pedal_rangeNeutralMax', config.pedal_rangeNeutralMax)
		addParam(params, 'pedal_rangeFwdMax', config.pedal_rangeFwdMax)
	}
	// Joy-Con
	if (config.mode_joycon) {
		addParam(params, 'joycon_speedMap', config.joycon_speedMap)
		addParam(params, 'joycon_reverseSpeedMap', config.joycon_reverseSpeedMap)
		addParam(params, 'joycon_rangeRevMin', config.joycon_rangeRevMin)
		addParam(params, 'joycon_rangeNeutralMin', config.joycon_rangeNeutralMin)
		addParam(params, 'joycon_rangeNeutralMax', config.joycon_rangeNeutralMax)
		addParam(params, 'joycon_rangeFwdMax', config.joycon_rangeFwdMax)
		addParam(params, 'joycon_rightHandOffset', config.joycon_rightHandOffset)
		addParam(params, 'joycon_invertJoystick', config.joycon_invertJoystick)
	}
	// Xbox
	if (config.mode_xbox) {
		addParam(params, 'xbox_speedMap', config.xbox_speedMap)
		addParam(params, 'xbox_reverseSpeedMap', config.xbox_reverseSpeedMap)
		addParam(params, 'xbox_triggerDeadZone', config.xbox_triggerDeadZone)
	}
}

/** Generate the complete prompter URL */
function generatePrompterUrl(studioId: StudioId, config: PrompterConfigState): string {
	const params = new URLSearchParams()

	const modeString = buildModeString(config)
	if (modeString) params.set('mode', modeString)

	addDisplayParams(params, config)
	addControllerParams(params, config)

	const queryString = params.toString()
	return `/prompter/${studioId}${queryString ? '?' + queryString : ''}`
}

export function PrompterConfigForm({ studioId }: Readonly<{ studioId: StudioId }>): JSX.Element {
	const { t } = useTranslation()
	const [config, setConfig] = useState<PrompterConfigState>(initialState)
	const [showDisplayOptions, setShowDisplayOptions] = useState(false)

	const updateConfig = useCallback(<K extends keyof PrompterConfigState>(key: K, value: PrompterConfigState[K]) => {
		setConfig((prev) => ({ ...prev, [key]: value }))
	}, [])

	const generatedUrl = useMemo(() => generatePrompterUrl(studioId, config), [config, studioId])

	return (
		<div className="prompter-config-form">
			{/* Display Options Section */}
			<div className="mb-3">
				<Form.Check
					type="checkbox"
					id="show-display-options"
					label={t('Configure display options')}
					checked={showDisplayOptions}
					onChange={(e) => setShowDisplayOptions(e.target.checked)}
				/>
				<Collapse in={showDisplayOptions}>
					<div className="nested-section">
						<div className="row">
							<div className="col-md-6">
								<Form.Group className="mb-2">
									<Form.Check
										type="checkbox"
										id="mirror"
										label={t('Mirror horizontally')}
										checked={config.mirror === true}
										onChange={(e) => updateConfig('mirror', e.target.checked ? true : null)}
									/>
								</Form.Group>
								<Form.Group className="mb-2">
									<Form.Check
										type="checkbox"
										id="mirrorv"
										label={t('Mirror vertically')}
										checked={config.mirrorv === true}
										onChange={(e) => updateConfig('mirrorv', e.target.checked ? true : null)}
									/>
								</Form.Group>
								<Form.Group className="mb-2">
									<Form.Label>{t('Font size')}</Form.Label>
									<Form.Control
										type="number"
										size="sm"
										placeholder="14"
										value={config.fontsize ?? ''}
										onChange={(e) => updateConfig('fontsize', parseIntOrNull(e.target.value))}
									/>
									<Form.Text className="text-muted">{t('14 = 7 lines, 20 = 5 lines')}</Form.Text>
								</Form.Group>
								<Form.Group className="mb-2">
									<Form.Label>{t('Margin (%)')}</Form.Label>
									<Form.Control
										type="number"
										size="sm"
										placeholder="0"
										value={config.margin ?? ''}
										onChange={(e) => updateConfig('margin', parseIntOrNull(e.target.value))}
									/>
								</Form.Group>
							</div>
							<div className="col-md-6">
								<Form.Group className="mb-2">
									<Form.Label>{t('Read marker position')}</Form.Label>
									<Form.Select
										size="sm"
										value={config.marker ?? ''}
										onChange={(e) => updateConfig('marker', e.target.value || null)}
									>
										<option value="">{t('Default (hide)')}</option>
										<option value="center">{t('Center')}</option>
										<option value="top">{t('Top')}</option>
										<option value="bottom">{t('Bottom')}</option>
										<option value="hide">{t('Hide')}</option>
									</Form.Select>
								</Form.Group>
								<Form.Group className="mb-2">
									<Form.Check
										type="checkbox"
										id="showscroll"
										label={t('Hide scrollbar')}
										checked={config.showscroll === false}
										onChange={(e) => updateConfig('showscroll', e.target.checked ? false : null)}
									/>
								</Form.Group>
								<Form.Group className="mb-2">
									<Form.Check
										type="checkbox"
										id="followtake"
										label={t('Disable follow take')}
										checked={config.followtake === false}
										onChange={(e) => updateConfig('followtake', e.target.checked ? false : null)}
									/>
								</Form.Group>
								<Form.Group className="mb-2">
									<Form.Check
										type="checkbox"
										id="showoverunder"
										label={t('Hide over/under timer')}
										checked={config.showoverunder === false}
										onChange={(e) => updateConfig('showoverunder', e.target.checked ? false : null)}
									/>
								</Form.Group>
								<Form.Group className="mb-2">
									<Form.Check
										type="checkbox"
										id="debug"
										label={t('Debug mode')}
										checked={config.debug === true}
										onChange={(e) => updateConfig('debug', e.target.checked ? true : null)}
									/>
								</Form.Group>
							</div>
						</div>
					</div>
				</Collapse>
			</div>

			{/* Control Modes Section */}
			<div className="mb-3">
				<strong>{t('Control modes')}:</strong>
				<Form.Text className="d-block text-muted mb-2">
					{t('Select one or more control modes. Leave all unchecked for default (mouse + keyboard).')}
				</Form.Text>

				{/* Mouse Mode */}
				<Form.Group className="mb-2">
					<Form.Check
						type="checkbox"
						id="mode-mouse"
						label={t('Mouse')}
						checked={config.mode_mouse}
						onChange={(e) => updateConfig('mode_mouse', e.target.checked)}
					/>
					<Collapse in={config.mode_mouse}>
						<div className="nested-section">
							<Form.Group>
								<Form.Label>{t('Control mode')}</Form.Label>
								<Form.Select
									size="sm"
									value={config.controlmode ?? ''}
									onChange={(e) => updateConfig('controlmode', e.target.value || null)}
								>
									<option value="">{t('Default')}</option>
									<option value="normal">{t('Normal scrolling')}</option>
									<option value="speed">{t('Speed control')}</option>
									<option value="smoothscroll">{t('Smooth scrolling')}</option>
								</Form.Select>
							</Form.Group>
						</div>
					</Collapse>
				</Form.Group>

				{/* Keyboard Mode */}
				<Form.Group className="mb-2">
					<Form.Check
						type="checkbox"
						id="mode-keyboard"
						label={t('Keyboard')}
						checked={config.mode_keyboard}
						onChange={(e) => updateConfig('mode_keyboard', e.target.checked)}
					/>
				</Form.Group>

				{/* Shuttle Keyboard Mode */}
				<Form.Group className="mb-2">
					<Form.Check
						type="checkbox"
						id="mode-shuttlekeyboard"
						label={t('Shuttle Keyboard (Contour ShuttleXpress / X-keys)')}
						checked={config.mode_shuttlekeyboard}
						onChange={(e) => updateConfig('mode_shuttlekeyboard', e.target.checked)}
					/>
					<Collapse in={config.mode_shuttlekeyboard}>
						<div className="nested-section">
							<Form.Group>
								<Form.Label>{t('Speed map')}</Form.Label>
								<Form.Control
									type="text"
									size="sm"
									placeholder="0,1,2,3,5,7,9,30"
									value={config.shuttle_speedMap ?? ''}
									onChange={(e) => updateConfig('shuttle_speedMap', e.target.value || null)}
								/>
								<Form.Text className="text-muted">{t('Comma-separated speeds in px/frame')}</Form.Text>
							</Form.Group>
						</div>
					</Collapse>
				</Form.Group>

				{/* Shuttle WebHID Mode */}
				<Form.Group className="mb-2">
					<Form.Check
						type="checkbox"
						id="mode-shuttlewebhid"
						label={t('Shuttle WebHID (Contour ShuttleXpress via browser)')}
						checked={config.mode_shuttlewebhid}
						onChange={(e) => updateConfig('mode_shuttlewebhid', e.target.checked)}
					/>
				</Form.Group>

				{/* Pedal Mode */}
				<Form.Group className="mb-2">
					<Form.Check
						type="checkbox"
						id="mode-pedal"
						label={t('MIDI Pedal')}
						checked={config.mode_pedal}
						onChange={(e) => updateConfig('mode_pedal', e.target.checked)}
					/>
					<Collapse in={config.mode_pedal}>
						<div className="nested-section">
							<div className="row">
								<div className="col-md-6">
									<Form.Group className="mb-2">
										<Form.Label>{t('Speed map')}</Form.Label>
										<Form.Control
											type="text"
											size="sm"
											placeholder="1,2,3,4,5,7,9,12,17,19,30"
											value={config.pedal_speedMap ?? ''}
											onChange={(e) => updateConfig('pedal_speedMap', e.target.value || null)}
										/>
									</Form.Group>
									<Form.Group className="mb-2">
										<Form.Label>{t('Reverse speed map')}</Form.Label>
										<Form.Control
											type="text"
											size="sm"
											placeholder="10,30,50"
											value={config.pedal_reverseSpeedMap ?? ''}
											onChange={(e) => updateConfig('pedal_reverseSpeedMap', e.target.value || null)}
										/>
									</Form.Group>
								</div>
								<div className="col-md-6">
									<Form.Group className="mb-2">
										<Form.Label>{t('Range: Reverse min')}</Form.Label>
										<Form.Control
											type="number"
											size="sm"
											placeholder="0"
											value={config.pedal_rangeRevMin ?? ''}
											onChange={(e) => updateConfig('pedal_rangeRevMin', parseIntOrNull(e.target.value))}
										/>
									</Form.Group>
									<Form.Group className="mb-2">
										<Form.Label>{t('Range: Neutral min')}</Form.Label>
										<Form.Control
											type="number"
											size="sm"
											placeholder="35"
											value={config.pedal_rangeNeutralMin ?? ''}
											onChange={(e) => updateConfig('pedal_rangeNeutralMin', parseIntOrNull(e.target.value))}
										/>
									</Form.Group>
									<Form.Group className="mb-2">
										<Form.Label>{t('Range: Neutral max')}</Form.Label>
										<Form.Control
											type="number"
											size="sm"
											placeholder="80"
											value={config.pedal_rangeNeutralMax ?? ''}
											onChange={(e) => updateConfig('pedal_rangeNeutralMax', parseIntOrNull(e.target.value))}
										/>
									</Form.Group>
									<Form.Group className="mb-2">
										<Form.Label>{t('Range: Forward max')}</Form.Label>
										<Form.Control
											type="number"
											size="sm"
											placeholder="127"
											value={config.pedal_rangeFwdMax ?? ''}
											onChange={(e) => updateConfig('pedal_rangeFwdMax', parseIntOrNull(e.target.value))}
										/>
									</Form.Group>
								</div>
							</div>
						</div>
					</Collapse>
				</Form.Group>

				{/* Joy-Con Mode */}
				<Form.Group className="mb-2">
					<Form.Check
						type="checkbox"
						id="mode-joycon"
						label={t('Nintendo Joy-Con')}
						checked={config.mode_joycon}
						onChange={(e) => updateConfig('mode_joycon', e.target.checked)}
					/>
					<Collapse in={config.mode_joycon}>
						<div className="nested-section">
							<div className="row">
								<div className="col-md-6">
									<Form.Group className="mb-2">
										<Form.Label>{t('Speed map')}</Form.Label>
										<Form.Control
											type="text"
											size="sm"
											placeholder="1,2,3,4,5,8,12,30"
											value={config.joycon_speedMap ?? ''}
											onChange={(e) => updateConfig('joycon_speedMap', e.target.value || null)}
										/>
									</Form.Group>
									<Form.Group className="mb-2">
										<Form.Label>{t('Reverse speed map')}</Form.Label>
										<Form.Control
											type="text"
											size="sm"
											placeholder="1,2,3,4,5,8,12,30"
											value={config.joycon_reverseSpeedMap ?? ''}
											onChange={(e) => updateConfig('joycon_reverseSpeedMap', e.target.value || null)}
										/>
									</Form.Group>
									<Form.Group className="mb-2">
										<Form.Label>{t('Right hand offset')}</Form.Label>
										<Form.Control
											type="number"
											step="0.1"
											size="sm"
											placeholder="1.4"
											value={config.joycon_rightHandOffset ?? ''}
											onChange={(e) => updateConfig('joycon_rightHandOffset', parseFloatOrNull(e.target.value))}
										/>
									</Form.Group>
									<Form.Group className="mb-2">
										<Form.Check
											type="checkbox"
											id="joycon-invert"
											label={t('Invert joystick')}
											checked={config.joycon_invertJoystick === true}
											onChange={(e) => updateConfig('joycon_invertJoystick', e.target.checked ? true : null)}
										/>
									</Form.Group>
								</div>
								<div className="col-md-6">
									<Form.Group className="mb-2">
										<Form.Label>{t('Range: Reverse min')}</Form.Label>
										<Form.Control
											type="number"
											step="0.1"
											size="sm"
											placeholder="-1"
											value={config.joycon_rangeRevMin ?? ''}
											onChange={(e) => updateConfig('joycon_rangeRevMin', parseFloatOrNull(e.target.value))}
										/>
									</Form.Group>
									<Form.Group className="mb-2">
										<Form.Label>{t('Range: Neutral min')}</Form.Label>
										<Form.Control
											type="number"
											step="0.01"
											size="sm"
											placeholder="-0.25"
											value={config.joycon_rangeNeutralMin ?? ''}
											onChange={(e) => updateConfig('joycon_rangeNeutralMin', parseFloatOrNull(e.target.value))}
										/>
									</Form.Group>
									<Form.Group className="mb-2">
										<Form.Label>{t('Range: Neutral max')}</Form.Label>
										<Form.Control
											type="number"
											step="0.01"
											size="sm"
											placeholder="0.25"
											value={config.joycon_rangeNeutralMax ?? ''}
											onChange={(e) => updateConfig('joycon_rangeNeutralMax', parseFloatOrNull(e.target.value))}
										/>
									</Form.Group>
									<Form.Group className="mb-2">
										<Form.Label>{t('Range: Forward max')}</Form.Label>
										<Form.Control
											type="number"
											step="0.1"
											size="sm"
											placeholder="1"
											value={config.joycon_rangeFwdMax ?? ''}
											onChange={(e) => updateConfig('joycon_rangeFwdMax', parseFloatOrNull(e.target.value))}
										/>
									</Form.Group>
								</div>
							</div>
						</div>
					</Collapse>
				</Form.Group>

				{/* Xbox Mode */}
				<Form.Group className="mb-2">
					<Form.Check
						type="checkbox"
						id="mode-xbox"
						label={t('Xbox Controller')}
						checked={config.mode_xbox}
						onChange={(e) => updateConfig('mode_xbox', e.target.checked)}
					/>
					<Collapse in={config.mode_xbox}>
						<div className="nested-section">
							<Form.Group className="mb-2">
								<Form.Label>{t('Speed map (forward, right trigger)')}</Form.Label>
								<Form.Control
									type="text"
									size="sm"
									placeholder="2,3,5,6,8,12,18,45"
									value={config.xbox_speedMap ?? ''}
									onChange={(e) => updateConfig('xbox_speedMap', e.target.value || null)}
								/>
								<Form.Text className="text-muted">{t('Comma-separated speeds in px/frame')}</Form.Text>
							</Form.Group>
							<Form.Group className="mb-2">
								<Form.Label>{t('Reverse speed map (left trigger)')}</Form.Label>
								<Form.Control
									type="text"
									size="sm"
									placeholder="2,3,5,6,8,12,18,45"
									value={config.xbox_reverseSpeedMap ?? ''}
									onChange={(e) => updateConfig('xbox_reverseSpeedMap', e.target.value || null)}
								/>
							</Form.Group>
							<Form.Group className="mb-2">
								<Form.Label>{t('Trigger dead zone')}</Form.Label>
								<Form.Control
									type="number"
									step="0.01"
									size="sm"
									placeholder="0.1"
									value={config.xbox_triggerDeadZone ?? ''}
									onChange={(e) => updateConfig('xbox_triggerDeadZone', parseFloatOrNull(e.target.value))}
								/>
								<Form.Text className="text-muted">{t('Value between 0 and 1')}</Form.Text>
							</Form.Group>
							<div className="info-box">
								<small>
									<strong>{t('Button mapping')}:</strong>
									<br />A = {t('Take')}, B = {t('Go to Live')}, X = {t('Previous')}, Y = {t('Following')}
									<br />
									LB = {t('Top')}, RB = {t('Next')}, D-Pad = {t('Fine scroll')}
								</small>
							</div>
						</div>
					</Collapse>
				</Form.Group>
			</div>

			{/* Generated URL and Open Button */}
			<div className="nested-section mt-4">
				<Form.Group className="mb-2">
					<Form.Label>
						<strong>{t('Generated URL')}:</strong>
					</Form.Label>
					<Form.Control type="text" size="sm" readOnly value={generatedUrl} onClick={(e) => e.currentTarget.select()} />
				</Form.Group>
				<Link to={generatedUrl} className="btn btn-primary">
					{t('Open Prompter')}
				</Link>
			</div>
		</div>
	)
}
