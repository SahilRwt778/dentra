-- Up Migration
CREATE TABLE dentist_payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dentist_id uuid NOT NULL REFERENCES dentists(user_id) ON DELETE CASCADE,
  bank_account_holder text NOT NULL,
  bank_account_no text NOT NULL,
  bank_ifsc varchar(11) NOT NULL,
  pan varchar(10) NOT NULL,
  gstin varchar(15),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  CONSTRAINT payout_request_review_state CHECK (
    (status = 'pending' AND reviewed_at IS NULL AND reviewed_by IS NULL AND rejection_reason IS NULL) OR
    (status = 'approved' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL AND rejection_reason IS NULL) OR
    (status = 'rejected' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL AND rejection_reason IS NOT NULL AND length(trim(rejection_reason)) > 0)
  )
);
CREATE UNIQUE INDEX dentist_payout_one_pending_idx ON dentist_payout_requests (dentist_id) WHERE status = 'pending';
CREATE INDEX dentist_payout_history_idx ON dentist_payout_requests (dentist_id, submitted_at DESC, id DESC);
CREATE INDEX dentist_payout_queue_idx ON dentist_payout_requests (status, submitted_at, id);

-- Down Migration
DO $$ BEGIN
  RAISE EXCEPTION 'Payout review records require an explicit archival plan before rollback.';
END $$;
