-- 014_personal_info_types.sql — new negative types + agency settings defaults
ALTER TABLE negative_items DROP CONSTRAINT IF EXISTS negative_items_negative_type_check;
ALTER TABLE negative_items ADD CONSTRAINT negative_items_negative_type_check
  CHECK (negative_type IN (
    'late_payment', 'collection', 'charge_off', 'repossession',
    'bankruptcy', 'foreclosure', 'tax_lien', 'judgment',
    'inquiry', 'identity_theft', 'personal_info_error', 'duplicate_account', 'other'
  ));

UPDATE agencies SET settings = settings || '{
  "auto_create_rounds": false,
  "auto_round_delay_days": 5,
  "google_review_link": "",
  "referral_bonus": "$50",
  "referral_link": ""
}'::jsonb WHERE settings IS NOT NULL;
