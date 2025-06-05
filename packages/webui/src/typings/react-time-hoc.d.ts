declare module 'react-timer-hoc' {
	function timer(timer: number): <T>(component: T) => T
	export default timer
}
