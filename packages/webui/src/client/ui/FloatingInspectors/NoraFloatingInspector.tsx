import { JSONBlobParse, NoraContent, NoraPayload } from '@sofie-automation/blueprints-integration'
import React, { useEffect, useImperativeHandle } from 'react'
import _ from 'underscore'
import { getNoraContentSteps } from '../SegmentContainer/PieceMultistepChevron'
import Escape from './../../lib/Escape'

interface IPropsHeader {
	noraContent: NoraContent | undefined
	style: React.CSSProperties | undefined
}

interface IStateHeader extends IPropsHeader {
	show: boolean
}

export const NoraFloatingInspector = React.forwardRef<HTMLDivElement, IPropsHeader>(function NoraFloatinInspector(
	props: IPropsHeader,
	ref
) {
	useImperativeHandle(
		ref,
		() => {
			return NoraPreviewRenderer._singletonRef.rootElement as HTMLDivElement
		},
		[]
	)

	useEffect(() => {
		if (props.noraContent) {
			NoraPreviewRenderer.show()
		}

		return () => {
			NoraPreviewRenderer.hide()
		}
	}, [])

	useEffect(() => {
		if (props.noraContent) {
			NoraPreviewRenderer.update(props.noraContent, props.style)
		}
	}, [props.noraContent, props.style])

	return null
})

export class NoraPreviewRenderer extends React.Component<{}, IStateHeader> {
	static _singletonRef: NoraPreviewRenderer

	iframeElement: HTMLIFrameElement | null = null
	rootElement: HTMLDivElement | null = null

	static update(noraContent: NoraContent, style: React.CSSProperties | undefined): void {
		NoraPreviewRenderer._singletonRef._update(noraContent, style)
	}

	static show(): void {
		NoraPreviewRenderer._singletonRef._show()
	}

	static hide(): void {
		NoraPreviewRenderer._singletonRef._hide()
	}

	constructor(props: {}) {
		super(props)

		this.state = {
			show: false,
			noraContent: undefined,
			style: {},
		}
		NoraPreviewRenderer._singletonRef = this
	}

	componentDidMount(): void {
		window.addEventListener('message', this._onNoraMessage)
	}

	componentWillUnmount(): void {
		window.removeEventListener('message', this._onNoraMessage)
	}

	shouldComponentUpdate(_nextProps: {}, nextState: IStateHeader, _nextContext: unknown): boolean {
		return !_.isEqual(nextState, this.state)
	}

	private postNoraEvent(contentWindow: Window, noraContent: NoraContent) {
		try {
			const payload = JSONBlobParse<NoraPayload>(noraContent.previewPayload)

			contentWindow.postMessage(
				{
					event: 'nora',
					contentToShow: {
						manifest: payload.manifest,
						template: {
							event: 'preview',
							name: payload.template.name,
							channel: 'gfx1',
							layer: payload.template.layer,
							system: 'html',
						},
						content: {
							...payload.content,
							_valid: false,
						},
						timing: {
							duration: '00:05',
							in: 'auto',
							out: 'auto',
							timeIn: '00:00',
						},
						step: payload.step,
					},
				},
				'*'
			)
		} catch (e) {
			console.error(`Error in NoraPreviewRenderer.postNoraEvent: ${e}`, e)
		}
	}

	private _show() {
		this.setState({
			show: true,
		})
	}

	private _update(noraContent: NoraContent, style: React.CSSProperties | undefined) {
		const stateUpdate: Partial<IStateHeader> = {}

		if (JSON.stringify(this.state.noraContent) !== JSON.stringify(noraContent)) {
			if (this.iframeElement?.contentWindow) {
				this.postNoraEvent(this.iframeElement.contentWindow, noraContent)
			}

			stateUpdate.noraContent = noraContent
		}

		if (JSON.stringify(this.state.style) !== JSON.stringify(style)) {
			stateUpdate.style = style
		}

		this.setState(stateUpdate as Pick<IStateHeader, 'noraContent'>)
	}

	private _hide() {
		this.setState({
			show: false,
		})
	}

	private _setIFrameElement = (e: HTMLIFrameElement | null) => {
		if (!e) return
		this.iframeElement = e
	}

	private _onNoraMessage = (msg: MessageEvent): void => {
		if (!this.state.noraContent) return

		const rendererUrl = new URL(this.state.noraContent.previewRenderer)
		if (rendererUrl.origin !== msg.origin) return

		if (msg.source !== this.iframeElement?.contentWindow) return
		if (msg.data.event === 'nora-render') {
			if (msg.data.data.loaded) {
				// Nora has loaded, dispatch the initial content

				// Future: this may want to be done via `onload` on the iframe in the future to allow for non-nora renderers to work

				if (this.iframeElement?.contentWindow) {
					this.postNoraEvent(this.iframeElement.contentWindow, this.state.noraContent)
				}
			}
		}
	}

	private _setRootElement = (e: HTMLDivElement | null) => {
		this.rootElement = e
	}

	private getElStyle(dimensions: { width: number; height: number } | undefined) {
		const style: Record<string, any> = { ...this.state.style }
		style.visibility = this.state.show ? 'visible' : 'hidden'

		if (dimensions) {
			style['--preview-render-width'] = dimensions.width
			style['--preview-render-height'] = dimensions.height
		}

		return style
	}

	render(): JSX.Element {
		const hasStepChevron = getNoraContentSteps(this.state.noraContent)

		const rendererUrl = this.state.noraContent?.previewRenderer
		const dimensions = this.state.noraContent?.previewRendererDimensions

		return (
			<Escape to="document">
				<div
					className="segment-timeline__mini-inspector segment-timeline__mini-inspector--graphics segment-timeline__mini-inspector--graphics--preview"
					style={this.getElStyle(dimensions)}
					ref={this._setRootElement}
				>
					<div className="preview">
						<img src="/images/previewBG.jpg" alt="" />
						{rendererUrl && (
							<iframe
								key={rendererUrl} // Use the url as the key, so that the old renderer unloads immediately when changing url
								sandbox="allow-scripts allow-same-origin"
								src={rendererUrl}
								ref={this._setIFrameElement}
							></iframe>
						)}
					</div>
					{hasStepChevron ? (
						<div className="segment-timeline__mini-inspector--graphics--preview__step-chevron">
							{hasStepChevron.currentStep}
							{typeof hasStepChevron.allSteps === 'number' && hasStepChevron.allSteps > 0 ? (
								<span className="segment-timeline__mini-inspector--graphics--preview__step-chevron__total">
									/{hasStepChevron.allSteps}
								</span>
							) : null}
						</div>
					) : null}
				</div>
			</Escape>
		)
	}
}
