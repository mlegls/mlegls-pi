ab mail <to> <text...>
ab mail --stats

Message a pi session, or a channel of sessions. Every session subscribes with wake to
  mail/<8 hex>             its mailbox: the last 8 hex of its session id
  wt/<repo>/<branch>       the worktree (or checkout) it works in
  ticket/<repo>/<slug>     the tracker issue its branch or wm handle names
All are shown in its footer (✉ mailbox, # channels); the mailbox is also in the tmux status
bar. A message starts the reader's next turn, or waits for the current one to end.

The destination is a topic, an eight-hex mailbox, or a full session ID; text can come from stdin.
From a pi session the message is signed with your own mailbox, so readers can reply.
`ab mail` warns when it finds no live subscriber, or cannot verify subscriptions for
an older live session. The message is still recorded; it will not wake a reader that
wasn't subscribed when it was sent.

The worktree and ticket channels are on trial: --stats counts posts, topics and
senders per kind, to see whether they get used beside direct mail.
