ab job start <type> <json>

Start a restartable job by loading lib/jobs/<type>.ts. The module exports
run({id, input, state, save, log, signal}); state is restored and run() is
called again after a daemon restart. Job names are simple lowercase module names.

  ab job start tick '{"intervalMs":1000}'
