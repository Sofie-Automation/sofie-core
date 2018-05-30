
import * as _ from 'underscore'

import {
	IMOSConnectionStatus,
	IMOSDevice,
	IMOSListMachInfo,
	MosString128,
	MosTime,
	IMOSRunningOrder,
	IMOSRunningOrderBase,
	IMOSRunningOrderStatus,
	IMOSStoryStatus,
	IMOSItemStatus,
	IMOSStoryAction,
	IMOSROStory,
	IMOSROAction,
	IMOSItemAction,
	IMOSItem,
	IMOSROReadyToAir,
	IMOSROFullStory,
	IMOSStory,
	IMOSExternalMetaData,
	IMOSROFullStoryBodyItem
} from 'mos-connection'
import { Segment, Segments } from '../../../lib/collections/Segments'
import { SegmentLine, SegmentLines, DBSegmentLine } from '../../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems, ITimelineTrigger } from '../../../lib/collections/SegmentLineItems'
import { TriggerType } from 'superfly-timeline'
import { RundownAPI } from '../../../lib/api/rundown'
import { IOutputLayer,
	ISourceLayer
} from '../../../lib/collections/StudioInstallations'
import {
	TemplateFunction,
	TemplateSet,
	SegmentLineItemOptional,
	TemplateFunctionOptional,
	TemplateResult,
	TemplateContextInner,
	StoryWithContext
} from './templates'
import {
	TimelineObjCCGVideo,
	TimelineObjLawoSource,
	TimelineObjCCGTemplate,
	TimelineContentTypeCasparCg,
	TimelineContentTypeLawo,
	TimelineContentTypeAtem,
	TimelineObj,
	TimelineObjAbstract,
	Atem_Enums,
	TimelineObjAtemME,
	TimelineObjAtemAUX,
	TimelineObjAtemDSK,
	TimelineObjAtemSsrc
} from '../../../lib/collections/Timeline'
import { Transition, Ease, Direction } from '../../../lib/constants/casparcg'
import { Optional } from '../../../lib/lib'

import { LLayers } from './nrk-layers'

const literal = <T>(o: T) => o

export const NrkVignettTemplate = literal<TemplateFunctionOptional>(function (context, story) {
    let clip: string = ''
    let sourceDuration: number = 0
    let segmentLineduration: number = 0

    // selects correct vignett clip file and sets the assosciated hard coded durations to match
    let mosartVariant = story.getValueByPath('MosExternalMetaData.0.MosPayload.mosartVariant', 'VIGNETT2018')
    switch (mosartVariant) {
        case 'VIGNETT2018':
            // lengths and times are milliseconds
            clip = 'vignett2018-overlay'	// @todo TBD
            sourceDuration = 60	* 1000	// @todo TBD
            segmentLineduration = 4400	// @todo TBD
            break
        default:
            context.warning('Unknown mosartVariant: ' + mosartVariant)
    }

    let segmentLineItems: Array<SegmentLineItemOptional> = []
    let IDs = {
        lawo: context.getHashId('lawo'),
        vignett: context.getHashId('vignett')
    }

    let video: SegmentLineItemOptional = {
        _id: context.getHashId('vignett'),
        mosId: 'vignett',
        name: 'Vignett',
        trigger: {
            type: TriggerType.TIME_ABSOLUTE,
            value: 'now'
        },
        status: RundownAPI.LineItemStatusCode.UNKNOWN,
        sourceLayerId: 'studio0_vignett',
        outputLayerId: 'pgm0',
        expectedDuration: segmentLineduration,
        content: {
            fileName: clip,
            sourceDuration: sourceDuration,
            timelineObjects: [
                // full sound vignett
                literal<TimelineObjLawoSource>({
                    _id: IDs.lawo, deviceId: [''], siId: '', roId: '',
                    trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
                    priority: 1,
                    duration: 0,
                    LLayer: LLayers.lawo_source_effect,
                    content: {
                        type: TimelineContentTypeLawo.AUDIO_SOURCE,
                        attributes: {
                            db: 0
                        }
                    }
                }),

                // play vignett over dsk2
                literal<TimelineObjCCGVideo>({
                    _id: IDs.vignett, deviceId: [''], siId: '', roId: '',
                    trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.lawo}.start + 0` },
                    priority: 1,
                    duration: sourceDuration,
                    LLayer: LLayers.casparcg_player_vignett,
                    content: {
                        type: TimelineContentTypeCasparCg.VIDEO,
                        attributes: {
                            file: clip
                        }
                    }
                }),
                // TMP
                literal<TimelineObjAtemME>({
                    _id: '', deviceId: [''], siId: '', roId: '',
                    trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.vignett}.start + 200` }, // account for caspar output latency 4+frames
                    priority: 1,
                    duration: 0,
                    LLayer: LLayers.atem_me_program,
                    content: {
                        type: TimelineContentTypeAtem.ME,
                        attributes: {
                            input: 3,
                            transition: Atem_Enums.TransitionStyle.CUT
                        }
                    }
                })
            ]
        }
    }

    segmentLineItems.push(video)

    return literal<TemplateResult>({
        segmentLine: literal<DBSegmentLine>({
            _id: '',
            _rank: 0,
            mosId: '',
            segmentId: '',
            runningOrderId: '',
            slug: context.segmentLine._id,
            expectedDuration: segmentLineduration,
            disableOutTransition: true,
        }),
        segmentLineItems: segmentLineItems,
        segmentLineAdLibItems: null,
    })
})