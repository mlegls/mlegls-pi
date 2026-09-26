ab mail <mailbox> <text...>

Message a pi session. Every session subscribes with wake to its mailbox, board
topic mail/<last 8 hex of its session id>, shown in its footer (✉) and in the tmux
status bar; the message starts its next turn, or waits for the current one to end.
<mailbox> is mail/xxxxxxxx, the bare 8 hex, or a full session id. Text on stdin
when not given. From a pi session the message is signed with your own mailbox, so
the reader can reply with ab mail.
