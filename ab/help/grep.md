ab grep PATTERN [PATH...] [-i] [-F] [-g GLOB] [-m LIMIT] [-C N]

JavaScript regex over ignore-aware files (default .). Output rows carry anchors, so
grep → edit needs no read. -F literal, -i ignore case, -g glob filter, -m maximum
matching lines (prints [incomplete] when more exist), -C context lines.
Exit 1 when nothing matches. For plain searching without anchors, use rg.
