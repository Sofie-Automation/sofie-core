import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { BrowserRouter } from 'react-router-dom'
import { ClockViewIndex } from '../ClockViewIndex'
import { MultiviewScreen } from '../MultiviewScreen'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'

jest.mock('react-bootstrap/esm/Container', () => ({
	__esModule: true,
	default: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}))

jest.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (str: string, options?: Record<string, any>) => {
			if (options?.studioId) {
				return str.replace('{{studioId}}', options.studioId)
			}
			return str
		},
		i18n: {
			changeLanguage: () => Promise.resolve(),
		},
	}),
}))

describe('ClockViewIndex', () => {
	it('renders with studio ID', () => {
		const studioId = protectString('studio0')
		const { container } = render(
			<BrowserRouter>
				<ClockViewIndex studioId={studioId} />
			</BrowserRouter>
		)

		expect(container).toMatchSnapshot()
	})
})

describe('MultiviewScreen', () => {
	it('renders with studio ID', () => {
		const studioId = protectString('studio0')
		const { container } = render(<MultiviewScreen studioId={studioId} />)

		expect(container).toMatchSnapshot()
	})
})
