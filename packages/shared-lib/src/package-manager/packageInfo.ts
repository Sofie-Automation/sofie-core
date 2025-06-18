// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace PackageInfo {
	export enum Type {
		SCAN = 'scan',
		DEEPSCAN = 'deepScan',
		JSON = 'json',
		OTHER = 'other',
	}

	export type Any = FFProbeScan | FFProbeDeepScan | JSONDocument | FFOther
	export interface Base {
		type: Type
		payload: any
	}

	export interface FFProbeScan extends Base {
		type: Type.SCAN
		payload: FFProbeInfo
	}
	export interface FFProbeDeepScan extends Base {
		type: Type.DEEPSCAN
		payload: FFProbeDeepScanInfo
	}

	export interface JSONDocument extends Base {
		type: Type.JSON
		payload: unknown
	}

	export interface FFOther extends Base {
		// placeholder
		type: Type.OTHER
		payload: unknown
	}

	export interface FFProbeInfo {
		/** Path to the file */
		filePath?: string
		streams?: FFProbeScanStream[]
		format?: FFProbeScanFormat
	}
	export interface FFProbeScanStream {
		index?: number
		codec_type?: string // Example: 'video', 'audio'

		// video
		/** In pixels */
		width?: number // Example: 1920
		height?: number // Example: 1080
		sample_aspect_ratio?: string // Example: '1:1'
		display_aspect_ratio?: string // Example: '16:9'
		pix_fmt?: string // Example: 'yuv420p'
		bits_per_raw_sample?: string // Example: '8'
		field_order?: FieldOrder

		// audio
		sample_fmt?: string
		sample_rate?: string
		channels?: number
		channel_layout?: string
		bits_per_sample?: number

		codec_name?: string // Example: 'h264'
		codec_long_name?: string // Example: 'H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10'
		profile?: string // Example: 'Main'
		codec_time_base?: string // Example: '1/50'
		codec_tag_string?: string // Example: 'avc1'
		codec_tag?: string // Example: '0x31637661'
		coded_width?: number // Example: 1920
		coded_height?: number // Example: 1088
		has_b_frames?: number // Example: 2
		level?: number // Example: 40
		color_range?: string // Example: 'tv'
		color_space?: string // Example: 'bt709'
		color_transfer?: string // Example: 'bt709'
		color_primaries?: string // Example: 'bt709'
		chroma_location?: string // Example: 'left'
		refs?: number // Example: 1
		is_avc?: string // Example: 'true'
		nal_length_size?: string // Example: '4'
		r_frame_rate?: string // Example: '25/1'
		avg_frame_rate?: string // Example: '25/1'
		time_base?: string // Example: '1/90000'
		start_pts?: number // Example: 0
		start_time?: string // Example: '0.000000'
		duration_ts?: number // Example: 964800
		duration?: string // Example: '10.720000'
		bit_rate?: string // Example: '4806776'
		nb_frames?: string // Example: '268'
		disposition?: any // lookup this?
		tags?: any // lookup this?
		max_bit_rate?: string // ?
	}
	export interface FFProbeScanFormat {
		/** Example: 'C:\\media\\AMB.mp4' */
		filename?: string
		/** Number of media streams, Example: 1 */
		nb_streams?: number
		/** Number of programmes, Example: 0 */
		nb_programs?: number
		/** Format name, Example: 'mov,mp4,m4a,3gp,3g2,mj2' */
		format_name?: string
		/** Long format name, Example: 'QuickTime / MOV' */
		format_long_name?: string
		/** Start timecode, in seconds, Example: '0.000000' */
		start_time?: string
		/** Duration, in seconds, Example: '10.720000' */
		duration?: string
		/** File size, in bytes, Example: '6445960' */
		size?: string
		/** Bitrate, in bytes/second, Example: '4810417' */
		bit_rate?: string
		/** Max Bitrate, in bytes/second, Example: 4810417 */
		max_bit_rate?: number
		/** FFProbe probe score, Example: 100 */
		probe_score?: number
		tags?: {
			/** Example: 'mp42' */
			major_brand?: string
			/** Example: '0' */
			minor_version?: string
			/** Example: 'mp42isomavc1' */
			compatible_brands?: string
			/** Example: '2012-10-23T08:11:18.000000Z' */
			creation_time?: string
			/** Example: 'HandBrake 0.9.8 2012071800' */
			encoder?: string
		}
	}

	export interface FFProbeDeepScanInfo {
		field_order?: FieldOrder
		/** Timestamps (in seconds) for when scene-changes are detected */
		scenes?: number[]
		/** Periods of freeze-frames */
		freezes?: Anomaly[]
		/** Periods of black-frames */
		blacks?: Anomaly[]
	}
	export enum FieldOrder {
		Unknown = 'unknown',
		Progressive = 'progressive',
		TFF = 'tff',
		BFF = 'bff',
	}
	export interface Anomaly {
		/** Timestamp, in seconds */
		start: number
		/** Duration, in seconds */
		duration: number
		/** Timestamp, in seconds */
		end: number
	}
}
