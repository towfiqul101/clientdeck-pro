const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const SSN4_RE = /^\d{4}$/;

export interface ParsedClientRow {
  rowNumber: number; // 1-indexed, excluding the header row
  name: string;
  email: string;
  phone: string;
  ssn_last4: string;
}

export interface ValidatedClientRow extends ParsedClientRow {
  first_name: string;
  last_name: string;
  valid: boolean;
  errors: string[];
}

/**
 * Validates parsed rows against format rules and duplicate emails — both
 * within the agency's existing clients (`existingEmails`, lowercased) and
 * within the uploaded batch itself (a later row reusing an earlier row's
 * email is also a duplicate, since the earlier one will be inserted first).
 */
export function validateImportRows(
  rows: ParsedClientRow[],
  existingEmails: Set<string>
): ValidatedClientRow[] {
  const seenInBatch = new Set<string>();

  return rows.map((row) => {
    const errors: string[] = [];
    const name = row.name.trim();
    const email = row.email.trim().toLowerCase();
    const phone = row.phone.trim();
    const ssn_last4 = row.ssn_last4.trim();

    if (!name) errors.push("missing name");
    if (email && !EMAIL_RE.test(email)) errors.push("invalid email");
    if (ssn_last4 && !SSN4_RE.test(ssn_last4)) {
      errors.push("ssn_last4 must be exactly 4 digits");
    }
    if (email) {
      if (existingEmails.has(email)) errors.push("duplicate email (already a client)");
      else if (seenInBatch.has(email)) errors.push("duplicate email (in this file)");
      seenInBatch.add(email);
    }

    const spaceIdx = name.indexOf(" ");
    const first_name = spaceIdx === -1 ? name : name.slice(0, spaceIdx);
    const last_name = spaceIdx === -1 ? "" : name.slice(spaceIdx + 1).trim();

    return {
      rowNumber: row.rowNumber,
      name,
      email,
      phone,
      ssn_last4,
      first_name,
      last_name,
      valid: errors.length === 0,
      errors,
    };
  });
}
