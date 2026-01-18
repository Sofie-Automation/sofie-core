const { themes } = require('prism-react-renderer')
const lightCodeTheme = themes.github
const darkCodeTheme = themes.dracula

/** @type {import('@docusaurus/types').DocusaurusConfig} */
module.exports = {
	title: 'Sofie TV Automation Documentation',
	tagline:
		'Sofie is a web-based, open-source TV automation system for studios and live shows. Since September 2018, it has been used in daily live TV news productions by broadcasters such as NRK, the BBC, and TV 2 (Norway).',
	url: 'https://sofie-automation.github.io',
	baseUrl: '/sofie-core/',
	onBrokenLinks: 'warn',
	onBrokenMarkdownLinks: 'warn',
	favicon: 'img/favicon.ico',
	organizationName: 'Sofie-Automation',
	projectName: 'sofie-core',
	markdown: {
		mermaid: true,
	},
	themes: ['@docusaurus/theme-mermaid'],
	themeConfig: {
		image: 'img/pilot_fredag-05.jpg',
		colorMode: {
			defaultMode: 'light',
			disableSwitch: false,
			respectPrefersColorScheme: true,
		},
		navbar: {
			title: 'Sofie TV Automation',
			logo: {
				alt: 'Sofie Logo',
				src: 'img/sofie-logo.svg',
			},
			items: [
				{ to: '/docs/user-guide/intro', label: 'User Guide', position: 'left' },
				{ to: '/docs/for-developers/intro', label: 'For Developers', position: 'left' },
				{ to: '/releases', label: 'Releases', position: 'left' },

				{
					type: 'docsVersionDropdown',

					position: 'right',
					// Add additional dropdown items at the beginning/end of the dropdown.
					dropdownItemsBefore: [],
					// dropdownItemsAfter: [{ to: '/versions', label: 'All versions' }],
					// Do not add the link active class when browsing docs.
					dropdownActiveClassDisabled: true,
					docsPluginId: 'default',
				},
				{
					href: 'https://github.com/Sofie-Automation/sofie-core',
					label: 'GitHub',
					position: 'right',
				},
			],
		},
		footer: {
			style: 'dark',
			links: [
				{
					//title: 'Documentation',
					items: [
						{ to: '/docs/user-guide/intro', label: 'User Guide', position: 'left' },
						{ to: '/docs/for-developers/intro', label: 'For Developers', position: 'left' },
						{ to: '/releases', label: 'Releases', position: 'left' },
					],
				},
				{
					//title: 'Community',
					items: [
						{
							label: 'Sofie Slack Community',
							href: 'https://join.slack.com/t/sofietv/shared_invite/zt-2bfz8l9lw-azLeDB55cvN2wvMgqL1alA',
						},
					],
				},
				{
					//title: 'About Sofie',
					items: [{ to: '/docs/about-sofie', label: 'About Sofie', position: 'right' }],
				},
				/* 				{
					title: 'More',
					items: [
						// {
						//   label: 'Blog',
						//   to: '/blog',
						// },
						{
							label: 'GitHub',
							href: 'https://github.com/Sofie-Automation?q=sofie-&type=source&language=&sort=',
						},
					],
				},
 */
			],
			copyright: `Copyright ©${new Date().getFullYear()} Norsk rikskringkasting AS and Contributors`,
		},
		prism: {
			theme: lightCodeTheme,
			darkTheme: darkCodeTheme,
		},
		docs: {
			sidebar: {
				hideable: true,
				autoCollapseCategories: true,
			},
		},
		algolia: {
			// The application ID provided by Algolia
			appId: '0J21XARTCE',

			// Public API key: it is safe to commit it
			apiKey: '02e5ac360a8cb72fc576689375cc1e7f',

			indexName: 'sofie-core',
		},
	},
	presets: [
		[
			'@docusaurus/preset-classic',
			{
				docs: {
					sidebarPath: require.resolve('./sidebars.js'),
					editUrl: 'https://github.com/Sofie-Automation/sofie-core/edit/main/packages/documentation/',
					// default to the 'next' docs
					lastVersion: 'current',
					versions: {
						// Override the rendering of the 'next' docs to be 'latest'
						current: {
							label: 'Latest',
							banner: 'none',
						},
					},
				},
				// blog: {
				//   showReadingTime: true,
				//   // Please change this to your repo.
				//   editUrl:
				//     'https://github.com/facebook/docusaurus/edit/master/website/blog/',
				// },
				theme: {
					customCss: require.resolve('./src/css/custom.css'),
				},
			},
		],
	],
	plugins: [
		[
			'@docusaurus/plugin-content-docs',
			{
				id: 'releases',
				path: 'releases',
				routeBasePath: 'releases',
				sidebarPath: false,
				// ... other options
			},
		],
	],
}
