ab raw — exact output inside the bash tool

  CMD | ab raw          stdin, exact
  ab raw CMD ARG...     run CMD with stderr, exact; keeps its exit status

The bash tool filters output by attention to the conversation. Text between ab raw's
marks (private OSC lines, invisible in terminals) skips the filter and spends the
output budget first; the rest of the call is still filtered. ab read, grep, edit and
pull mark their own output. Outside the tool (no $AB_OUT) it is a plain passthrough.
