ab mail <to> <text...>
ab mail --stats

Message a pi session, or a channel of sessions. Every session subscribes with wake to
  mail/<8 hex>             its mailbox: the last 8 hex of its session id
  wt/<repo>/<branch>       the worktree (or checkout) it works in
  ticket/<repo>/<slug>     the tracker issue its branch or wm handle names
all shown in its footer (✉ mailbox, # channels); the mailbox is also in the tmux status
bar. A message starts the reader's next turn, or waits for the current one to end.
<to> is a topic, a bare 8 hex, or a full session id; text on stdin when not given.
From a pi session the message is signed with your own mailbox, so readers can reply.

The worktree and ticket channels are on trial: --stats counts posts, topics and
senders per kind, to see whether they get used beside direct mail.
