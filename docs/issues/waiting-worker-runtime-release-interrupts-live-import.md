---
stage: "idea"
author: "session:thr_jgysfs4mzv"
---
During [[projects/concept/issues/propose-migration-fences-the-largest-profile-for-15-minutes]], process wait reported “Stopped when the Pi runtime shut down” after 51m02s, while the fresh snapshot import was still writing. After the 30-minute nudge the worker restarted its backend and import observer; runtime release interrupted the replacement observer after 53s, before activation. A delayed completion notification alone cannot recover a terminated command. The private export and database survived; no verification result did.
