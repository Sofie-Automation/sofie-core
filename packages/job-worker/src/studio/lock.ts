import { JobContext } from '../jobs/index.js'
import { StudioPlayoutModel } from './model/StudioPlayoutModel.js'
import { loadStudioPlayoutModel } from './model/StudioPlayoutModelImpl.js'

/**
 * Run a typical studio job
 * This means loading the studioPlayoutModel, doing some calculations and saving the result
 */
export async function runJobWithStudioPlayoutModel<TRes>(
	context: JobContext,
	fcn: (studioPlayoutModel: StudioPlayoutModel) => Promise<TRes>
): Promise<TRes> {
	const studioPlayoutModel = await loadStudioPlayoutModel(context)

	try {
		const res = await fcn(studioPlayoutModel)

		await studioPlayoutModel.saveAllToDatabase()

		return res
	} catch (err) {
		studioPlayoutModel.dispose()
		throw err
	}
}
