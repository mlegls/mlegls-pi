# First-use drive: waiting child in exception mail

## Setup and predictions (before interaction)

Ticket: [address-the-waiting-child-in-exception-mail](../../issues/address-the-waiting-child-in-exception-mail.md). Local CLI, checkout-owned worktree; synthetic live Pi session, no auth. The handoff promises temporary board/state with wake subscriptions and unsubscribed topics, and `bun ab/main.ts mail <topic> <text...>` as the entry point. No target URL or remote deployment. This packet will not seed the shared user's mail state deliberately.

Predictions from the ticket and CLI help (read before sending):

1. When a supervised worker stops at `needs-input` or `blocked`, the owner receives exception mail containing a specific `mail/<hex>` or `wt/<repo>/<branch>` address. Sending there should wake the waiting worker. **Pending**.
2. Sending `ab mail` to a topic with no live subscriber should give a clear warning or error, not only a success-looking message ID. A live subscribed topic should not warn; an explicitly unsubscribed topic should warn. **Pending**.
3. `ticket/<repo>/<slug>` should route to the worker waiting in each phase, or every phase worker should subscribe to its ticket. The reviewer should get a ticket-topic steer rather than the implementer alone. **Pending**.

These are predictions, not observed outcomes. Expected use: prepare isolated temporary state, send CLI messages to matching and nonmatching topics, and inspect printed output and recipient delivery; for exception mail, trigger a waiting supervised worker through the project's public interface if an authorized setup path is available.
