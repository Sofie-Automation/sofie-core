declare module 'cubic-spline' {
	/**
	 * Creates a cubic spline using an algorithm based on the one described by Ivan Kuckir (@ivankutskir) here: http://blog.ivank.net/interpolation-with-cubic-splines.html
	 * 
	 * Use:
	 * ```
	 * const Spline = require('cubic-spline');
		
		const xs = [1, 2, 3, 4, 5];
		const ys = [9, 3, 6, 2, 4];
		
		// new a Spline object
		const spline = new Spline(xs, ys);
		
		// get Y at arbitrary X
		console.log(spline.at(1.4));
		
		// interpolate a line at a higher resolution
		for (let i = 0; i < 50; i++) {
		console.log(spline.at(i * 0.1));
		}
		```
	 */
	class Spline {
		/**
		 * Creates an instance of Spline.
		 * @param {number[]} domain The domain of the spline - an array of known input point of the control nodes
		 * @param {number[]} range The range of the spline - an array of known output values for the corresponding input points
		 * @memberof Spline
		 */
		constructor(domain: number[], range: number[])
		/**
		 * Calculates the value of the spline at the given input point.
		 *
		 * @param {number} input Any real number, will interpolate/extrapolate depending on if this is within the domain or not.
		 * @return {*}  {number} The interpolated/extrapolated value
		 * @memberof Spline
		 */
		public at(input: number): number
	}

	export = Spline
}
