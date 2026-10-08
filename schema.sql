-- Schéma FactPay — à exécuter sur la base Postgres (Neon).
--
-- Généré par « npm run db:sql » depuis lib/schema.js. Ne pas modifier à la main.
--
-- Toutes les instructions sont idempotentes (IF NOT EXISTS) : ce fichier peut être rejoué
-- sans risque sur une base déjà à jour, et sur une base existante il ajoute ce qui manque
-- sans rien détruire. Les données existantes ne sont jamais supprimées.
--
-- Colonne ajoutée sans valeur par défaut : sans DEFAULT, PostgreSQL refuse l'ALTER TABLE si la
-- table contient déjà des lignes (une colonne NOT NULL doit être renseignée). Si vous obtenez
-- « column contains null values », exécutez d'abord le UPDATE indiqué dans le message, ou la
-- version « SET NOT NULL » de la ligne concernée.

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
  );

CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false
  );

CREATE TABLE IF NOT EXISTS login_failures (
    email TEXT NOT NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

CREATE INDEX IF NOT EXISTS login_failures_email ON login_failures (email, at);

CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    legal_ids TEXT NOT NULL DEFAULT '',
    bank_name TEXT NOT NULL DEFAULT '',
    iban TEXT NOT NULL DEFAULT '',
    bic TEXT NOT NULL DEFAULT '',
    mobile_money TEXT NOT NULL DEFAULT '',
    currency TEXT NOT NULL DEFAULT 'XOF',
    show_alt_currency BOOLEAN NOT NULL DEFAULT true,
    payment_terms INTEGER NOT NULL DEFAULT 14,
    default_vat_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
    tax_reserve_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
    invoice_prefix TEXT NOT NULL DEFAULT 'FAC',
    invoice_seq INTEGER NOT NULL DEFAULT 0,
    invoice_seq_year INTEGER NOT NULL DEFAULT 0,
    footer_note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

CREATE INDEX IF NOT EXISTS clients_company ON clients (company_id);

CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    number TEXT,
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'brouillon',
    title TEXT NOT NULL DEFAULT '',
    issue_date TEXT,
    due_date TEXT,
    send_on TEXT,
    currency TEXT NOT NULL,
    vat_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
    subtotal DOUBLE PRECISION NOT NULL DEFAULT 0,
    vat_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    total DOUBLE PRECISION NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    sent_at TIMESTAMPTZ,
    send_error TEXT,
    payment_ref TEXT,
    proof_key TEXT,
    proof_name TEXT,
    proof_mime TEXT,
    paid_declared_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, number)
  );

CREATE INDEX IF NOT EXISTS invoices_company ON invoices (company_id, status);

CREATE TABLE IF NOT EXISTS invoice_lines (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity DOUBLE PRECISION NOT NULL,
    unit TEXT NOT NULL DEFAULT '',
    unit_price DOUBLE PRECISION NOT NULL,
    amount DOUBLE PRECISION NOT NULL
  );

ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE users ALTER COLUMN email_verified_at DROP DEFAULT;

CREATE TABLE IF NOT EXISTS email_verifications (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
  );

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS alt_currency TEXT;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS alt_rate DOUBLE PRECISION;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS withholding_label TEXT NOT NULL DEFAULT '';

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS withholding_rate DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS withholding_amount DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_due DOUBLE PRECISION;

UPDATE invoices SET amount_due = total WHERE amount_due IS NULL;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS period TEXT;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS withholding_base DOUBLE PRECISION;

UPDATE invoices SET withholding_base = subtotal WHERE withholding_base IS NULL;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receipt_sent_at TIMESTAMPTZ;

ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'service';

ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_key TEXT;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_mime TEXT;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_updated_at TIMESTAMPTZ;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'TG';

ALTER TABLE companies ADD COLUMN IF NOT EXISTS mobile_accounts TEXT NOT NULL DEFAULT '[]';

ALTER TABLE companies ADD COLUMN IF NOT EXISTS spi_alias TEXT NOT NULL DEFAULT '';

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancel_reason TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS invoice_messages (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

CREATE INDEX IF NOT EXISTS invoice_messages_invoice ON invoice_messages (invoice_id, created_at);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT '';

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_snapshot TEXT;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS company_snapshot TEXT;

UPDATE invoices i SET client_snapshot = json_build_object('name', c.name, 'address', c.address, 'phone', c.phone)::text
    FROM clients c WHERE c.id = i.client_id AND i.number IS NOT NULL AND i.client_snapshot IS NULL;

UPDATE invoices i SET company_snapshot = json_build_object('name', co.name, 'address', co.address, 'phone', co.phone,
    'email', co.email, 'legal_ids', co.legal_ids)::text
    FROM companies co WHERE co.id = i.company_id AND i.number IS NOT NULL AND i.company_snapshot IS NULL;

CREATE TABLE IF NOT EXISTS sequences (
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    year INTEGER NOT NULL,
    value INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (company_id, kind, year)
  );

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS credit_number TEXT;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS credit_date TEXT;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS reminders_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS reminder_days TEXT NOT NULL DEFAULT '3,10';

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reminders_sent INTEGER NOT NULL DEFAULT 0;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS doc_type TEXT NOT NULL DEFAULT 'facture';

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS refused_at TIMESTAMPTZ;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS converted_invoice_id INTEGER;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source_quote_id INTEGER;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS quote_prefix TEXT NOT NULL DEFAULT 'DEV';

ALTER TABLE companies ADD COLUMN IF NOT EXISTS quote_validity INTEGER NOT NULL DEFAULT 30;

CREATE INDEX IF NOT EXISTS invoices_doc_type ON invoices (company_id, doc_type);

ALTER TABLE email_verifications ADD COLUMN IF NOT EXISTS new_email TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS twofa_method TEXT NOT NULL DEFAULT '';

ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_pending TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_app TEXT NOT NULL DEFAULT '';

ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_last_step BIGINT NOT NULL DEFAULT 0;

ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes TEXT NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS login_challenges (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
  );

CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'autre',
    file_key TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_mime TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    doc_date TEXT,
    expires_on TEXT,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

CREATE INDEX IF NOT EXISTS documents_company ON documents (company_id, category);

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_key TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_mime TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ;

ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS repeat_active BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS repeat_day INTEGER;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS repeat_next TEXT;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS repeat_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS repeat_source_id INTEGER;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS accepted_by TEXT;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS accountant_token_hash TEXT;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS accountant_token_enc TEXT;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS accountant_since TIMESTAMPTZ;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS verify_code TEXT;

UPDATE invoices SET verify_code = upper(substr(md5(random()::text || id::text || clock_timestamp()::text), 1, 12))
    WHERE number IS NOT NULL AND verify_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_verify_code ON invoices (verify_code);

CREATE SEQUENCE IF NOT EXISTS company_fp_code START WITH 481;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS fp_code INTEGER;

UPDATE companies c SET fp_code = x.code
    FROM (SELECT id, nextval('company_fp_code') AS code FROM (SELECT id FROM companies WHERE fp_code IS NULL ORDER BY id) o) x
    WHERE c.id = x.id;

ALTER TABLE companies ALTER COLUMN fp_code SET DEFAULT nextval('company_fp_code');

CREATE UNIQUE INDEX IF NOT EXISTS companies_fp_code ON companies (fp_code);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sending_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS invoices_sending ON invoices (status, sending_at);

CREATE TABLE IF NOT EXISTS rate_limits (
    bucket TEXT NOT NULL,
    key TEXT NOT NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

CREATE INDEX IF NOT EXISTS rate_limits_bucket_key ON rate_limits (bucket, key, at);

ALTER TABLE companies ADD COLUMN IF NOT EXISTS account_holder TEXT NOT NULL DEFAULT '';

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS send_tz TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

CREATE INDEX IF NOT EXISTS push_subscriptions_user ON push_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '/',
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

CREATE INDEX IF NOT EXISTS notifications_user ON notifications (user_id, created_at DESC);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_methods TEXT;

CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    job_title TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL DEFAULT '',
    contract_type TEXT NOT NULL DEFAULT 'CDI',
    category TEXT NOT NULL DEFAULT '',
    hire_date TEXT NOT NULL DEFAULT '',
    end_date TEXT NOT NULL DEFAULT '',
    cnss_number TEXT NOT NULL DEFAULT '',
    id_card_number TEXT NOT NULL DEFAULT '',
    base_salary DOUBLE PRECISION NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'tmoney',
    payment_details TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'actif',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

CREATE INDEX IF NOT EXISTS employees_company_idx ON employees (company_id);

CREATE TABLE IF NOT EXISTS payslips (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    number TEXT NOT NULL,
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    issue_date TEXT NOT NULL DEFAULT '',
    payment_date TEXT NOT NULL DEFAULT '',
    currency TEXT NOT NULL DEFAULT 'XOF',
    base_salary DOUBLE PRECISION NOT NULL DEFAULT 0,
    seniority_bonus DOUBLE PRECISION NOT NULL DEFAULT 0,
    transport_allowance DOUBLE PRECISION NOT NULL DEFAULT 0,
    function_allowance DOUBLE PRECISION NOT NULL DEFAULT 0,
    other_allowances DOUBLE PRECISION NOT NULL DEFAULT 0,
    overtime_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    gross_salary DOUBLE PRECISION NOT NULL DEFAULT 0,
    cnss_employee_rate DOUBLE PRECISION NOT NULL DEFAULT 4.0,
    cnss_employee_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    tax_salary_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    salary_advances DOUBLE PRECISION NOT NULL DEFAULT 0,
    other_deductions DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_deductions DOUBLE PRECISION NOT NULL DEFAULT 0,
    net_salary DOUBLE PRECISION NOT NULL DEFAULT 0,
    cnss_employer_rate DOUBLE PRECISION NOT NULL DEFAULT 17.5,
    cnss_employer_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_employer_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'brouillon',
    payment_method TEXT NOT NULL DEFAULT '',
    payment_reference TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

CREATE INDEX IF NOT EXISTS payslips_company_idx ON payslips (company_id);

CREATE INDEX IF NOT EXISTS payslips_employee_idx ON payslips (employee_id);

CREATE INDEX IF NOT EXISTS payslips_period_idx ON payslips (company_id, period_year, period_month);

CREATE TABLE IF NOT EXISTS payslip_lines (
    id SERIAL PRIMARY KEY,
    payslip_id INTEGER NOT NULL REFERENCES payslips(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    kind TEXT NOT NULL DEFAULT 'ajout',
    label TEXT NOT NULL DEFAULT '',
    amount DOUBLE PRECISION NOT NULL DEFAULT 0
  );

CREATE INDEX IF NOT EXISTS payslip_lines_payslip_idx ON payslip_lines (payslip_id, position);

CREATE INDEX IF NOT EXISTS payslip_lines_company_idx ON payslip_lines (company_id);

ALTER TABLE employees ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';

ALTER TABLE employees ADD COLUMN IF NOT EXISTS leave_balance DOUBLE PRECISION DEFAULT 0.0;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS portal_token TEXT UNIQUE;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS portal_token_created_at TIMESTAMPTZ;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS portal_token_expires_at TIMESTAMPTZ;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS portal_last_seen_at TIMESTAMPTZ;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS portal_confirmed_at TIMESTAMPTZ;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS portal_password_hash TEXT;

UPDATE employees SET portal_token_expires_at = now() + interval '90 days'
     WHERE portal_token IS NOT NULL AND portal_token_expires_at IS NULL;

UPDATE employees SET portal_token_created_at = now()
     WHERE portal_token IS NOT NULL AND portal_token_created_at IS NULL;

CREATE TABLE IF NOT EXISTS portal_access_log (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip TEXT NOT NULL DEFAULT ''
  );

CREATE INDEX IF NOT EXISTS portal_access_log_employee ON portal_access_log (employee_id, seen_at DESC);

CREATE TABLE IF NOT EXISTS leave_requests (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    days_count DOUBLE PRECISION NOT NULL DEFAULT 1,
    reason TEXT NOT NULL DEFAULT '',
    document_url TEXT DEFAULT '',
    document_name TEXT NOT NULL DEFAULT '',
    document_mime TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'en_attente',
    reviewed_at TIMESTAMPTZ,
    review_note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

CREATE INDEX IF NOT EXISTS leave_requests_company ON leave_requests (company_id, status);

CREATE INDEX IF NOT EXISTS leave_requests_employee ON leave_requests (employee_id);

ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS document_name TEXT NOT NULL DEFAULT '';

ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS document_mime TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS salary_advances (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    amount DOUBLE PRECISION NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'en_attente',
    payment_method TEXT NOT NULL DEFAULT 'tmoney',
    payment_reference TEXT NOT NULL DEFAULT '',
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

CREATE INDEX IF NOT EXISTS salary_advances_company ON salary_advances (company_id, status);

CREATE INDEX IF NOT EXISTS salary_advances_employee ON salary_advances (employee_id);

CREATE TABLE IF NOT EXISTS expense_reports (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    category TEXT NOT NULL DEFAULT 'transport',
    expense_date TEXT NOT NULL DEFAULT '',
    receipt_url TEXT DEFAULT '',
    receipt_name TEXT NOT NULL DEFAULT '',
    receipt_mime TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'en_attente',
    payment_reference TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

CREATE INDEX IF NOT EXISTS expense_reports_company ON expense_reports (company_id, status);

CREATE INDEX IF NOT EXISTS expense_reports_employee ON expense_reports (employee_id);

ALTER TABLE expense_reports ADD COLUMN IF NOT EXISTS receipt_name TEXT NOT NULL DEFAULT '';

ALTER TABLE expense_reports ADD COLUMN IF NOT EXISTS receipt_mime TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS company_announcements (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    pinned BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

CREATE INDEX IF NOT EXISTS company_announcements_company ON company_announcements (company_id, created_at DESC);

ALTER TABLE employees ADD COLUMN IF NOT EXISTS cnss_number TEXT NOT NULL DEFAULT '';

ALTER TABLE employees ADD COLUMN IF NOT EXISTS id_card_number TEXT NOT NULL DEFAULT '';

ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_title TEXT NOT NULL DEFAULT '';

ALTER TABLE employees ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT '';

ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_type TEXT NOT NULL DEFAULT 'CDI';

ALTER TABLE employees ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';

ALTER TABLE employees ADD COLUMN IF NOT EXISTS hire_date TEXT NOT NULL DEFAULT '';

ALTER TABLE employees ADD COLUMN IF NOT EXISTS end_date TEXT NOT NULL DEFAULT '';

ALTER TABLE employees ADD COLUMN IF NOT EXISTS base_salary DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'tmoney';

ALTER TABLE employees ADD COLUMN IF NOT EXISTS payment_details TEXT NOT NULL DEFAULT '';

ALTER TABLE employees ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'actif';

ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';

ALTER TABLE employees ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';

ALTER TABLE payslips ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'XOF';

ALTER TABLE payslips ADD COLUMN IF NOT EXISTS seniority_bonus DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE payslips ADD COLUMN IF NOT EXISTS transport_allowance DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE payslips ADD COLUMN IF NOT EXISTS function_allowance DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE payslips ADD COLUMN IF NOT EXISTS other_allowances DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE payslips ADD COLUMN IF NOT EXISTS overtime_amount DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE payslips ADD COLUMN IF NOT EXISTS gross_salary DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE payslips ADD COLUMN IF NOT EXISTS cnss_employee_rate DOUBLE PRECISION NOT NULL DEFAULT 4.0;

ALTER TABLE payslips ADD COLUMN IF NOT EXISTS cnss_employee_amount DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE payslips ADD COLUMN IF NOT EXISTS tax_salary_amount DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE payslips ADD COLUMN IF NOT EXISTS salary_advances DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE payslips ADD COLUMN IF NOT EXISTS other_deductions DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE payslips ADD COLUMN IF NOT EXISTS total_deductions DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE payslips ADD COLUMN IF NOT EXISTS net_salary DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE payslips ADD COLUMN IF NOT EXISTS cnss_employer_rate DOUBLE PRECISION NOT NULL DEFAULT 17.5;

ALTER TABLE payslips ADD COLUMN IF NOT EXISTS cnss_employer_amount DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE payslips ADD COLUMN IF NOT EXISTS total_employer_cost DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE payslips ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT '';

ALTER TABLE payslips ADD COLUMN IF NOT EXISTS payment_reference TEXT NOT NULL DEFAULT '';

ALTER TABLE payslips ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
-- Vérification : liste les tables réellement présentes dans la base.
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
