import * as React from 'react'

interface IProps {
	className?: string
	accept?: string
	onUploadContents: (contents: string, file: File) => void
	onUploadError: (err: Error) => void
	children?: React.ReactNode
	disabled?: boolean
}

export const UploadButton: React.FunctionComponent<IProps> = function (props: IProps) {
	const [timestampedFileKey, setTimestampedFileKey] = React.useState(0)

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setTimestampedFileKey(Date.now())

		const file = e.target.files?.[0]
		if (!file) return

		const reader = new FileReader()

		reader.onload = () => {
			const fileContents = reader.result as string

			try {
				props.onUploadContents(fileContents, file)
			} catch (err: any) {
				props.onUploadError(err)
			}
		}
		reader.onerror = () => {
			props.onUploadError(new Error('Error reading file'))
		}
		reader.readAsText(file)
	}
	return (
		<label className={props.className}>
			{props.children}
			<input
				key={timestampedFileKey}
				type="file"
				accept={props.accept}
				onChange={handleChange}
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
