import * as React from 'react'

interface IProps {
	className?: string
	accept?: string
	onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
	children?: React.ReactNode
	disabled?: boolean
}

export const UploadButton: React.FunctionComponent<IProps> = function (props: IProps) {
	return (
		<label className={props.className}>
			{props.children}
			<input
				type="file"
				accept={props.accept}
				onChange={props.onChange}
				style={{
					visibility: 'hidden',
					width: 0,
					height: 0,
					display: 'inline',
					position: 'absolute',
				}}
				disabled={props.disabled}
			/>
		</label>
	)
}
