const { writeFileSync } = require("fs");
const { join } = require("path");

writeFileSync(
	join(__dirname, "../meteor/server/_force_restart.js"),
	Date.now().toString() + "\n",
);
console.log("Written _force_restart.js");
