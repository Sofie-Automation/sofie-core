// @todo: remove this and do a PR to https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/winston
// because there's an error in the typings logging.debug() takes any, not only string
export interface LoggerInstanceFixed {
	// for cli and npm levels
	error: LeveledLogMethodFixed
	warn: LeveledLogMethodFixed
	// help: LeveledLogMethodFixed
	data: LeveledLogMethodFixed
	info: LeveledLogMethodFixed
	debug: LeveledLogMethodFixed
	prompt: LeveledLogMethodFixed
	http: LeveledLogMethodFixed
	verbose: LeveledLogMethodFixed
	input: LeveledLogMethodFixed
	silly: LeveledLogMethodFixed

	// for syslog levels only
	emerg: LeveledLogMethodFixed
	alert: LeveledLogMethodFixed
	crit: LeveledLogMethodFixed
	warning: LeveledLogMethodFixed
	notice: LeveledLogMethodFixed
	log: LeveledLogMethodFixed
}
interface LogMeta {
	[key: string]: any
}
type Winston_LogCallback = (error?: any, level?: string, msg?: string, meta?: any) => void
export interface LeveledLogMethodFixed {
	(msg: any, callback: Winston_LogCallback): LoggerInstanceFixed
	(msg: any, meta: LogMeta, callback: Winston_LogCallback): LoggerInstanceFixed
	(msg: any, ...meta: LogMeta[]): LoggerInstanceFixed
}
