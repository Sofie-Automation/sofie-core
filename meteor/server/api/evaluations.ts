import { EvaluationBase } from '@sofie-automation/meteor-lib/dist/collections/Evaluations'
import { getRandomId, getSofieHostUrl } from '../lib/tempLib'
import { getCurrentTime } from '../lib/lib'
import { deferAsync } from '../lib/lib'
import { logger } from '../logging'
import { Meteor } from 'meteor/meteor'
import _ from 'underscore'
import { fetchStudioLight } from '../optimizations'
import { sendSlackMessageToWebhook } from './integration/slack'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { Evaluations, RundownPlaylists } from '../collections'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { VerifiedRundownPlaylistForUserAction } from '../security/check'

export async function saveEvaluation(
	_playlist: VerifiedRundownPlaylistForUserAction,
	evaluation: EvaluationBase
): Promise<void> {
	await Evaluations.insertAsync({
		...evaluation,
		_id: getRandomId(),
		organizationId: null,
		userId: null,
		timestamp: getCurrentTime(),
	})
	logger.info({
		message: 'evaluation',
		evaluation: evaluation,
	})

	deferAsync(async () => {
		const studio = await fetchStudioLight(evaluation.studioId)
		if (!studio) throw new Meteor.Error(500, `Studio ${evaluation.studioId} not found!`)
		const studioSettings = applyAndValidateOverrides(studio.settingsWithOverrides).obj

		const webhookUrls = _.compact((studioSettings.slackEvaluationUrls || '').split(','))

		if (webhookUrls.length) {
			// Only send notes if not everything is OK
			const evaluationLevel = _.find(evaluation.answers, (_answer, key) => {
				return key === 'q0'
			})
			const evaluationMessage = _.find(evaluation.answers, (_answer, key) => {
				return key === 'q1'
			})
			const evaluationProducer = _.find(evaluation.answers, (_answer, key) => {
				return key === 'q2'
			})

			let slackMessage = 'Evaluation!'
			switch (evaluationLevel) {
				case 'nothing':
					slackMessage = ':heavy_check_mark: Hey! Fra '
					break
				case 'minor':
					slackMessage = ':grey_question: Ehm! Fra '
					break
				case 'major':
					slackMessage = ':warning: Uh-oh! Fra '
					break
			}

			// only send message for evaluations with content
			if (evaluationMessage) {
				const playlist = (await RundownPlaylists.findOneAsync(evaluation.playlistId, {
					projection: {
						_id: 1,
						name: 1,
					},
				})) as Pick<DBRundownPlaylist, '_id' | 'name'>

				const hostUrl = getSofieHostUrl()

				slackMessage +=
					'rundown ' +
					(hostUrl && playlist
						? '*<' + hostUrl + '/rundown/' + playlist._id + '|' + playlist.name + '>*'
						: playlist?.name || 'N/A') +
					(hostUrl ? ' in ' + hostUrl.replace(/http:\/\/|https:\/\//, '') : '') +
					'\n' +
					evaluationMessage +
					'\n' +
					'_' +
					evaluationProducer +
					'_'

				await Promise.all(
					webhookUrls.map(async (webhookUrl) => sendSlackMessageToWebhook(slackMessage, webhookUrl))
				)
			}
		}
	})
}
