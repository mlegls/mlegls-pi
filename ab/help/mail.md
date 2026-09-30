ab mail <to> <text...>
ab mail --stats

Message a pi session, or a channel of sessions. Every session subscribes with wake to
  mail/<8 hex>             its mailbox: the last 8 hex of its session id
  wt/<repo>/<branch>       the worktree (or checkout) it works in
  ticket/<repo>/<slug>     the tracker issue its branch or wm handle names
All are shown in its footer (✉ mailbox, # channels); the mailbox is also in the tmux status
bar. A message starts the reader's next turn, or waits for the current one to end.

Ticket mail is shared: implement, drive, review, and consolidation worktrees for a
supervised issue join the issue's topic, while each phase has its own worktree address.
To steer one waiting worker, prefer the exact worktree address in exception mail.

The destination is a topic, an eight-hex mailbox, or a full session ID; text can come from stdin.
From a pi session the message is signed with your own mailbox, so readers can reply.
`ab mail` exits nonzero when it finds no live subscriber. For an older live session
whose subscriptions cannot be verified, it only warns; uncertainty is not proof that
no reader is listening. The message is still recorded, but it will not wake a reader
that wasn't subscribed when sent. A live snapshot cannot prove that the reader consumed it.

The worktree and ticket channels are on trial: --stats counts posts, topics and
senders per kind, to see whether they get used beside direct mail.
