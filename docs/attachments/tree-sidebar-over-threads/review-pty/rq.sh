#!/bin/sh
# usage: rq.sh 'python code'
rm -f /tmp/rq-out
printf '%s' "$1" > /tmp/rq-cmd
for i in $(seq 1 200); do [ -f /tmp/rq-out ] && break; sleep 0.2; done
sleep 0.1; cat /tmp/rq-out
