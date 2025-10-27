## Architecture

The basic architecture of the job-worker is the main thread operates as a conductor of multiple child threads.
The intention here is to avoid the main thread blocking, at all times so that we can keep timeout duration short and not risk long operations accidentally timing out.

It is written so that by default it will run workers for every studio in an installation, or it can be told to run for only certain studios. This allows for better scaling and distributing work across more processes if an installation is handling enough studios to justify it.

### Threads

Each studio has 3 threads:

- Studio/playout thread. This is responsible for all of the user or playout driven operations
- Ingest thread. This is responsible for generating the parts and pieces from ingest data
- Events thread. This is used for some low priority events from the other threads.

Each of the threads is able to queue work for the other threads or itself, but is unable to wait for that to complete, to ensure we don't deadlock.

In future, it is likely that there will be multiple ingest threads per studio. This will allow us to better avoid ingest updates for the on-air rundown being blocked in a queue behind updates for tomorrows rundown.

There are also some locks used to synchronise writes to the RundownPlaylist collection

### Locks

It is possible for both the playout and ingest threads to lock a RudownPlaylist.

This is necessary as they both need to take ownership of a playlist at points. The playout thread locks the active playlist for the duration of its operation. The ingest thread locks the playlist for the 'commit' phase of its operation.

The locks are coordinated by the main thread over IPC. This keeps the implementation simple as we do not need the locks to be distributed, as we know all the threads for a studio will be in the one process.

### Meteor

Meteor is able to push work into each of the queues. It is also able to wait for the job to complete, so that it can report back to the user or originating process.

### Authorization

The workers assume that if a task is on a queue, then it has already been validated for if the user/device is authorized to run that job.

This keeps it simpler, with the worker needing no knowledge of users, sessions or authentication.

Meteor or any other api providing work must verify user authorization before queueing the work.

### Errors

As a lot of the jobs are triggered by a user action, the jobs support a new UserError type. This is keyed to be translatable, and wraps an inner Error object for logging. The UserError ITranslatableMessage can be bubbled straight into the ui and should map neatly into the existing translations bundles being generated.
