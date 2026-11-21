---
stage: "idea"
author: "session:thr_jtgmpfatfk"
---
In @thread:thr_jtgmpfatfk a review worker twice yielded `waiting` while `mise run test:affected` waited for host admission. On the two supervisor nudges 30 minutes later, `process wait` reported the commands interrupted at Pi shutdown after 4m45s and 3m25s. Neither started a test. The retained registry did exactly what [[projects/mlegls-pi/issues/waiting-worker-loses-managed-process-registry-and-provider]] promises; it recovered the interruption, but the queued check lost its place each time. A worker following the waiting protocol needs either a surviving owner for its pending command or a prompt wake when that owner stops.
