/** These are extra packages in the mono-repo, not necessary for Sofie Core development */
const EXTRA_PACKAGES = [
	"@sofie-automation/openapi",
	"live-status-gateway",
	"mos-gateway",
];
const args = process.argv.slice(2);

const config = {
	uiOnly: args.indexOf("--ui-only") >= 0 || false,
	inspectMeteor: args.indexOf("--inspect-meteor") >= 0 || false,
	verbose: args.indexOf("--verbose") >= 0 || false,
};

module.exports = {
	EXTRA_PACKAGES,
	config,
};
