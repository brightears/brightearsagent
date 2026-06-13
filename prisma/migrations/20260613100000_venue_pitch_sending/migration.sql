-- Phase 10.5 hardening: intermediate SENDING state on VenuePitchStatus.
-- The send is atomically CLAIMED (APPROVED -> SENDING via updateMany count===1)
-- immediately before the Gmail network call, closing the double-send / TOCTOU
-- window: a concurrent second call sees status !== APPROVED and no-ops. SENDING
-- also counts toward the daily send cap so in-flight sends can't blow the cap.
--
-- Positioned after APPROVED to mirror the schema enum order. ALTER TYPE ... ADD
-- VALUE is idempotent-guarded with IF NOT EXISTS so a re-deploy is safe.

ALTER TYPE "VenuePitchStatus" ADD VALUE IF NOT EXISTS 'SENDING' AFTER 'APPROVED';
