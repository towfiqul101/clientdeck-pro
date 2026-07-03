-- ============================================
-- ClientDeck Pro — System Letter Templates
-- These are the default AI prompts for letter generation
-- agency_id is NULL = system-wide templates
-- ============================================

INSERT INTO letter_templates (agency_id, name, description, negative_type, letter_type, round_suggestion, prompt_template, is_system) VALUES

-- ROUND 1: Initial Disputes
(NULL, 'Collection - Initial Dispute', 'First-round dispute for collection accounts', 'collection', 'initial_dispute', 1,
'You are drafting a professional dispute letter to {{bureau_name}} on behalf of {{client_name}} (address: {{client_address}}).

ITEM TO DISPUTE:
- Creditor: {{creditor_name}}
- Account Type: Collection
- Balance: {{balance}}
- Date of First Delinquency: {{date_of_first_delinquency}}
- Account Number (last 4): {{account_last4}}

INSTRUCTIONS:
Write a formal dispute letter requesting investigation and removal of this collection account. The letter should:
1. Identify the client with full name and address
2. Reference the specific account by creditor name and partial account number
3. State that the client disputes the accuracy of this item under Section 611 of the Fair Credit Reporting Act (15 U.S.C. § 1681i)
4. Request that the bureau verify this account with the furnisher and provide documentation
5. Remind the bureau of their 30-day obligation to investigate under FCRA
6. Request deletion if the item cannot be verified
7. Request a corrected copy of the credit report after investigation
8. Be firm and professional — not threatening or aggressive
9. Format for certified mail with return receipt requested

Include today''s date: {{today_date}}
Include a line for the client''s signature.
Do NOT include any disclaimer or [REVIEW REQUIRED] tags in the letter body itself.', true),

(NULL, 'Late Payment - Initial Dispute', 'First-round dispute for late payment entries', 'late_payment', 'initial_dispute', 1,
'You are drafting a professional dispute letter to {{bureau_name}} on behalf of {{client_name}} (address: {{client_address}}).

ITEM TO DISPUTE:
- Creditor: {{creditor_name}}
- Account Type: {{account_type}}
- Negative Mark: Late Payment(s)
- Account Number (last 4): {{account_last4}}

INSTRUCTIONS:
Write a formal dispute letter requesting investigation of reported late payments. The letter should:
1. Identify the client with full name and address
2. Reference the specific account
3. State the client disputes the accuracy of the reported late payment(s) under FCRA Section 611
4. Note that the client believes the payment history is being reported inaccurately
5. Request verification from the original creditor including payment records
6. Remind the bureau of the 30-day investigation requirement
7. Request correction or deletion if unverifiable
8. Request updated credit report
9. Format for certified mail

Include today''s date: {{today_date}}
Include a signature line.', true),

(NULL, 'Charge-Off - Initial Dispute', 'First-round dispute for charge-off accounts', 'charge_off', 'initial_dispute', 1,
'You are drafting a professional dispute letter to {{bureau_name}} on behalf of {{client_name}} (address: {{client_address}}).

ITEM TO DISPUTE:
- Creditor: {{creditor_name}}
- Account Type: {{account_type}}
- Negative Mark: Charge-Off
- Balance: {{balance}}
- Date of First Delinquency: {{date_of_first_delinquency}}
- Account Number (last 4): {{account_last4}}

INSTRUCTIONS:
Write a formal dispute letter for a charge-off account. The letter should:
1. Identify the client
2. Reference the specific charged-off account
3. Dispute the accuracy under FCRA Section 611
4. Request full verification including original signed agreement and payment history
5. Note that if the account has been sold or transferred, the current reporter may not have adequate documentation
6. Cite the 30-day investigation requirement
7. Request deletion if verification cannot be provided
8. Request updated credit report
9. Format for certified mail

Include today''s date: {{today_date}}', true),

(NULL, 'Inquiry Removal', 'Request removal of unauthorized hard inquiries', 'inquiry', 'initial_dispute', 1,
'You are drafting a professional letter to {{bureau_name}} on behalf of {{client_name}} (address: {{client_address}}).

ITEM TO DISPUTE:
- Company that pulled credit: {{creditor_name}}
- Type: Hard Inquiry

INSTRUCTIONS:
Write a formal letter requesting removal of an unauthorized hard inquiry. The letter should:
1. Identify the client
2. State that the client did not authorize {{creditor_name}} to access their credit file
3. Reference FCRA Section 604 which limits permissible purposes for pulling credit
4. State this inquiry was made without written authorization
5. Request immediate removal of this unauthorized inquiry
6. Note that unauthorized access is a violation of FCRA Section 616 and 617
7. Request written confirmation of removal
8. Format for certified mail

Include today''s date: {{today_date}}', true),

-- ROUND 2: Method of Verification / Escalation
(NULL, 'Collection - Method of Verification', 'Second-round MOV request after initial dispute', 'collection', 'method_of_verification', 2,
'You are drafting a Method of Verification (MOV) letter to {{bureau_name}} on behalf of {{client_name}} (address: {{client_address}}).

CONTEXT:
The client previously disputed this item in Round 1. The bureau responded that the item was "verified." The client is now requesting the METHOD used to verify.

ITEM:
- Creditor: {{creditor_name}}
- Account Type: Collection
- Balance: {{balance}}
- Previous dispute result: {{previous_result}}
- Account Number (last 4): {{account_last4}}

INSTRUCTIONS:
Write a formal Method of Verification letter. The letter should:
1. Reference the previous dispute and the bureau''s response
2. State that under FCRA Section 611(a)(7), the bureau is required to provide the METHOD of verification upon request
3. Request specific details: who verified the account, what documents were reviewed, when verification occurred
4. State that a generic "verified" response does not satisfy the bureau''s obligations
5. Request the name, address, and phone number of the person who verified the information
6. State that if the method cannot be provided, the item must be deleted
7. Set a 15-day deadline for response
8. Note that failure to comply may result in a complaint to the CFPB and FTC
9. Format for certified mail

Include today''s date: {{today_date}}', true),

(NULL, 'Late Payment - Goodwill Letter', 'Goodwill letter to original creditor for late payment removal', 'late_payment', 'goodwill', 2,
'You are drafting a Goodwill letter to {{creditor_name}} (the original creditor, NOT the bureau) on behalf of {{client_name}} (address: {{client_address}}).

CONTEXT:
This is not a dispute. This is a polite request asking the creditor to remove late payment reporting as a gesture of goodwill.

ITEM:
- Creditor: {{creditor_name}}
- Account Type: {{account_type}}
- Account Number (last 4): {{account_last4}}

INSTRUCTIONS:
Write a warm, professional goodwill letter. The letter should:
1. Be respectful and appreciative of the business relationship
2. Acknowledge that the late payment(s) did occur
3. Briefly explain mitigating circumstances (use placeholder: [CLIENT TO ADD PERSONAL CIRCUMSTANCES])
4. Emphasize the client''s otherwise positive payment history and loyalty
5. Politely request removal of the late payment notation as a goodwill adjustment
6. Note that the account is current and in good standing
7. Express continued loyalty to the creditor
8. NOT cite laws or make threats — this is a goodwill request
9. Format as a standard business letter

Include today''s date: {{today_date}}', true),

-- ROUND 3: Escalation
(NULL, 'Collection - Escalation with CFPB Warning', 'Third-round escalation with regulatory complaint warning', 'collection', 'escalation', 3,
'You are drafting an escalation letter to {{bureau_name}} on behalf of {{client_name}} (address: {{client_address}}).

CONTEXT:
This item has been disputed twice. Round 1 resulted in "verified." Round 2 (Method of Verification request) was either ignored or responded to inadequately. This is the final escalation before regulatory action.

ITEM:
- Creditor: {{creditor_name}}
- Account Type: Collection
- Balance: {{balance}}
- Round 1 result: {{previous_result}}
- Account Number (last 4): {{account_last4}}

INSTRUCTIONS:
Write a firm escalation letter. The letter should:
1. Reference both previous disputes by date
2. State that the bureau has failed to conduct a reasonable investigation as required by FCRA Section 611
3. State that the "verification" provided was inadequate and did not include the method of verification as required by Section 611(a)(7)
4. Cite FCRA Section 616 (civil liability for willful noncompliance) and Section 617 (negligent noncompliance)
5. State that if this item is not corrected or removed within 15 days, the client intends to file formal complaints with the Consumer Financial Protection Bureau (CFPB) and the Federal Trade Commission (FTC)
6. Mention that the client reserves the right to seek legal counsel
7. Demand deletion of the unverifiable item
8. Be firm and direct but not threatening or abusive
9. Format for certified mail

Include today''s date: {{today_date}}', true),

-- SPECIAL: Debt Validation
(NULL, 'Debt Validation Letter', 'Letter to collection agency requesting debt validation', 'collection', 'debt_validation', 2,
'You are drafting a Debt Validation letter to {{creditor_name}} (the collection agency, NOT the bureau) on behalf of {{client_name}} (address: {{client_address}}).

ITEM:
- Collection Agency: {{creditor_name}}
- Balance Claimed: {{balance}}
- Account Number (last 4): {{account_last4}}

INSTRUCTIONS:
Write a formal debt validation request under the Fair Debt Collection Practices Act (FDCPA). The letter should:
1. State that the client disputes this alleged debt and requests validation under FDCPA Section 809(b)
2. Request the following documentation:
   a. Proof that the collection agency is licensed to collect in the client''s state
   b. The original signed contract or agreement between the client and the original creditor
   c. Complete payment history from the original creditor
   d. Documentation showing the chain of assignment or sale of this debt
   e. The amount of the debt and how it was calculated including all fees and interest
3. State that all collection activity must cease until proper validation is provided (FDCPA Section 809(b))
4. Warn that continued collection without validation is a violation of the FDCPA
5. State that any negative reporting to credit bureaus during the validation period is also a violation
6. Request response within 30 days
7. Format for certified mail

Include today''s date: {{today_date}}', true),

-- SPECIAL: Identity Theft
(NULL, 'Identity Theft Dispute', 'Dispute for accounts opened through identity theft', 'identity_theft', 'identity_theft', 1,
'You are drafting an identity theft dispute letter to {{bureau_name}} on behalf of {{client_name}} (address: {{client_address}}).

ITEM:
- Creditor: {{creditor_name}}
- Account Type: {{account_type}}
- Balance: {{balance}}
- Account Number (last 4): {{account_last4}}

INSTRUCTIONS:
Write a formal identity theft dispute letter. The letter should:
1. State that the client is a victim of identity theft
2. Identify the specific fraudulent account
3. State that this account was opened without the client''s knowledge or consent
4. Reference FCRA Section 605B which requires blocking of information resulting from identity theft
5. State that the client has filed (or will file) an identity theft report with the FTC
6. Request immediate blocking and removal of this fraudulent account
7. Request that the bureau notify the furnisher of the dispute
8. State that under FCRA Section 605B, the bureau must block the information within 4 business days of receiving an identity theft report
9. Note that a copy of the FTC Identity Theft Report is enclosed (or will be provided)
10. Request a corrected credit report
11. Format for certified mail

Include today''s date: {{today_date}}', true);
