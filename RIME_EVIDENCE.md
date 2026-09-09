# Rime evidence

No Rime evidence has been collected yet.

This document will contain only measurements and acceptance-test results
produced by the working application. It must not be populated with placeholder
latency values or simulated success states.

## Acceptance test

1. Start request A with a delayed tool.
2. Interrupt request A while it is processing or speaking.
3. Start request B.
4. Confirm request A audio is cancelled and late results are rejected.
5. Confirm only request B produces Rime audio.