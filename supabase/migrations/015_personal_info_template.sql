-- 015_personal_info_template.sql — personal information correction letter
INSERT INTO letter_templates
  (agency_id, name, description, negative_type, letter_type, round_suggestion, prompt_template, is_system, is_active)
VALUES (
  NULL,
  'Personal Information Correction',
  'Dispute letter for incorrect personal information on a credit report',
  'personal_info_error',
  'initial_dispute',
  1,
  'Draft a formal letter to {{bureau_name}} from {{client_name}} at {{client_address}} requesting correction of inaccurate personal information on their credit report. Cite the consumer''s right under FCRA Section 611 (15 U.S.C. § 1681i) to have inaccurate information investigated and corrected. Identify the specific inaccurate personal detail (name spelling, address, or date of birth) as recorded for {{creditor_name}} where applicable, request its correction or deletion, and ask for written confirmation of the results within 30 days. Include date {{today_date}}, the bureau address {{bureau_address}}, a RE line, salutation, and a signature block for the client. Output only the letter.',
  true,
  true
);
