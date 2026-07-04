-- ============================================
-- ClientDeck Pro — Additional System Letter Templates
-- 609 / 611 / 623 statutory dispute letters
-- agency_id is NULL = system-wide templates (available to every agency)
-- ============================================

INSERT INTO letter_templates (agency_id, name, description, negative_type, letter_type, round_suggestion, prompt_template, is_system) VALUES

-- 609 Letter (requests original credit application)
(NULL, '609 Letter - Original Application Request',
'FCRA Section 609 request for original credit application documents',
NULL, 'initial_dispute', 1,
'Draft a formal FCRA Section 609 letter to {{bureau_name}} from {{client_name}} ({{client_address}}).

ITEM: {{creditor_name}}, {{negative_type}}, Balance: {{balance}}

Under FCRA Section 609(a)(1), the credit bureau must provide the consumer with all information in their file, including the original source documents. Write a letter:
1. Citing Section 609(a)(1) specifically
2. Requesting all original documentation related to this account including the original credit application, any agreements, and any documentation used to verify this account
3. Stating the bureau has 30 days to provide the documents
4. Noting that failure to provide documentation means the account cannot be verified and must be deleted under Section 611
5. Requesting written confirmation of compliance
6. Format for certified mail

Date: {{today_date}}', true),

-- 611 Letter (reinvestigation demand)
(NULL, '611 Letter - Reinvestigation Demand',
'FCRA Section 611 formal reinvestigation demand with specific inaccuracy claims',
NULL, 'method_of_verification', 2,
'Draft a formal FCRA Section 611 reinvestigation demand letter to {{bureau_name}} from {{client_name}} ({{client_address}}).

ITEM: {{creditor_name}}, {{account_type}}, {{negative_type}}, Balance: {{balance}}
Previous result: {{previous_result}}

Under FCRA Section 611, consumers have the right to dispute inaccurate information and require reinvestigation. Write a letter:
1. Referencing the previous dispute and inadequate investigation
2. Citing Section 611(a)(1) — obligation to conduct a reasonable reinvestigation
3. Citing Section 611(a)(6)(B) — right to receive results of reinvestigation
4. Citing Section 611(a)(7) — right to know the method of verification
5. Specifically stating what is inaccurate about this entry
6. Demanding a new, thorough reinvestigation (not a rubber-stamp verification)
7. Requesting deletion if the item cannot be fully verified with original documentation
8. Setting a 30-day deadline
9. Format for certified mail

Date: {{today_date}}', true),

-- 623 Letter (to furnisher directly)
(NULL, '623 Letter - Furnisher Direct Dispute',
'FCRA Section 623 dispute sent directly to the original creditor/furnisher',
NULL, 'escalation', 2,
'Draft a formal FCRA Section 623 letter to {{creditor_name}} (the FURNISHER, not the bureau) from {{client_name}} ({{client_address}}).

This letter goes to the CREDITOR/FURNISHER directly, not the bureau.
ACCOUNT: {{account_type}}, {{negative_type}}, Balance: {{balance}}, Account #XXXX{{account_last4}}

Under FCRA Section 623, furnishers (creditors, collectors) have legal obligations regarding the accuracy of information they report. Write a letter:
1. Citing Section 623(a)(8)(D) — consumer right to dispute directly with furnisher
2. Stating the specific inaccuracy in what they are reporting
3. Noting the furnisher must investigate and correct/delete inaccurate information
4. Citing the furnisher''s obligation to notify bureaus of any corrections under 623(b)(1)(D)
5. Setting a 30-day response deadline
6. Warning that continued reporting of inaccurate information violates the FCRA
7. Requesting written confirmation of any corrections made to the credit bureaus
8. Format for certified mail

Date: {{today_date}}', true);
