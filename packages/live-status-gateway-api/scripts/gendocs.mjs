// Render the html docs for the merged AsyncAPI schema.
// This uses the generator's API rather than its `ag` cli, which was dropped from @asyncapi/generator in v3
import AsyncApiGenerator from '@asyncapi/generator'
import * as path from 'path'

const generator = new AsyncApiGenerator('@asyncapi/html-template', path.resolve('docs'), {
	templateParams: {
		singleFile: 'true',
		outFilename: 'liveStatus.html',
	},
})

await generator.generateFromFile(path.resolve('src/generated/asyncapi.yaml'))

console.log('Generated docs/liveStatus.html')
