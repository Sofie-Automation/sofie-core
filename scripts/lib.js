const args = process.argv.slice(2);

// Check for --help
if (args.indexOf("--help") >= 0 || args.indexOf("-h") >= 0) {
	console.log(`
Sofie Core Development Mode

Usage: yarn dev [options]
       yarn start [options]

Note: 'yarn start' runs install + build + dev, while 'yarn dev' just runs dev mode.
      All options work with both commands.

Options:
  --help, -h           Show this help message
  --ui-only            Only watch and build UI packages (skip job-worker, gateways)
  --inspect-meteor     Run Meteor with Node.js inspector enabled
  --verbose            Enable verbose logging
  --db=<name>          Use a named database directory (e.g., --db=demo)
                       Creates meteor/.meteor/local/db.<name> and switches to it with a symlink
                       Original database is backed up to db.default on first use
                       Run without --db to use the currently active database
  --db-list            List all available database directories and show which is active

Examples:
  yarn start                  # Install, build, then run in dev mode
  yarn dev                    # Run in normal dev mode (requires prior build)
  yarn dev --db-list          # List all available databases
  yarn dev --db=testing       # Use a separate database for testing
  yarn dev --db=demo          # Switch to demo database
  yarn dev --ui-only          # Only watch UI, skip backend packages
  yarn dev --inspect-meteor   # Debug Meteor with inspector
  yarn start --db=demo        # Install, build, and run with demo database
`);
	process.exit(0);
}

// Parse --db=name option
const dbArg = args.find(arg => arg.startsWith('--db='));
const dbName = dbArg ? dbArg.split('=')[1] : null;

const config = {
	uiOnly: args.indexOf("--ui-only") >= 0 || false,
	inspectMeteor: args.indexOf("--inspect-meteor") >= 0 || false,
	verbose: args.indexOf("--verbose") >= 0 || false,
	dbName: dbName,
	dbList: args.indexOf("--db-list") >= 0 || false,
};

module.exports = {
	config,
};
