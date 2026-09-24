// Tables de la base. Chaque instruction est rejouable sans risque (IF NOT EXISTS).
export const schema = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false
  )`,
  `CREATE TABLE IF NOT EXISTS login_failures (
    email TEXT NOT NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS login_failures_email ON login_failures (email, at)`,
  `CREATE TABLE IF NOT EXISTS companies (
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
  )`,
  `CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS clients_company ON clients (company_id)`,
  `CREATE TABLE IF NOT EXISTS invoices (
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
  )`,
  `CREATE INDEX IF NOT EXISTS invoices_company ON invoices (company_id, status)`,
  `CREATE TABLE IF NOT EXISTS invoice_lines (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity DOUBLE PRECISION NOT NULL,
    unit TEXT NOT NULL DEFAULT '',
    unit_price DOUBLE PRECISION NOT NULL,
    amount DOUBLE PRECISION NOT NULL
  )`,

  // Prénom, nom et confirmation de l'adresse e-mail.
  // Les comptes créés avant cet ajout sont considérés comme confirmés (valeur par défaut now(), retirée ensuite).
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ DEFAULT now()`,
  `ALTER TABLE users ALTER COLUMN email_verified_at DROP DEFAULT`,
  `CREATE TABLE IF NOT EXISTS email_verifications (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
  )`,

  // Seconde devise (avec son taux) et retenue déduite par le client
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS alt_currency TEXT`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS alt_rate DOUBLE PRECISION`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS withholding_label TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS withholding_rate DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS withholding_amount DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_due DOUBLE PRECISION`,
  `UPDATE invoices SET amount_due = total WHERE amount_due IS NULL`,

  // Période travaillée (JSON), base de la retenue (hors primes), type de ligne, reçu de paiement envoyé
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS period TEXT`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS withholding_base DOUBLE PRECISION`,
  `UPDATE invoices SET withholding_base = subtotal WHERE withholding_base IS NULL`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS receipt_sent_at TIMESTAMPTZ`,
  `ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'service'`,

  // Logo de l'entreprise (image PNG ou JPEG), affiché sur les factures et les e-mails
  `ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_key TEXT`,
  `ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_mime TEXT`,
  `ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_updated_at TIMESTAMPTZ`,

  // Pays de l'entreprise (indicatif des numéros), comptes Mobile Money (JSON) et alias SPI de la BCEAO
  `ALTER TABLE companies ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'TG'`,
  `ALTER TABLE companies ADD COLUMN IF NOT EXISTS mobile_accounts TEXT NOT NULL DEFAULT '[]'`,
  `ALTER TABLE companies ADD COLUMN IF NOT EXISTS spi_alias TEXT NOT NULL DEFAULT ''`,

  // Annulation d'une facture envoyée (elle garde son numéro) et messages du client depuis sa page
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancel_reason TEXT NOT NULL DEFAULT ''`,
  `CREATE TABLE IF NOT EXISTS invoice_messages (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS invoice_messages_invoice ON invoice_messages (invoice_id, created_at)`,

  // Moyen de paiement noté quand l'entreprise marque elle-même la facture payée
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT ''`,
];
