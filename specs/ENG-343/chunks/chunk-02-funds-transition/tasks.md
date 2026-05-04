# Chunk: chunk-02-funds-transition

- [x] T-020: Replace `confirmFundsReceipt` with provider/manual evidence resolution, validation, durable recording, compatible replay handling, and safe exception recording.
- [x] T-021: Add manual FairLend staff admin funds confirmation mutation that validates authority, actor, timestamp, evidence note, attachments, and emits governed `FUNDS_RECEIVED`.
- [x] T-022: Preserve or extend transfer pipeline leg 2 provider path so `FUNDS_RECEIVED` can be tied to pipeline id, leg 2 transfer id, provider code, and same-deal evidence.
- [x] T-023: Reject or exception missing, mismatched, incompatible duplicate, cancelled, failed, and non-funding evidence paths without direct status patches.
