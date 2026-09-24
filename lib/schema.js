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

  // Coordonnées du client et de l'entreprise figées au moment de l'émission (une facture émise ne change plus)
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_snapshot TEXT`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS company_snapshot TEXT`,
  `UPDATE invoices i SET client_snapshot = json_build_object('name', c.name, 'address', c.address, 'phone', c.phone)::text
    FROM clients c WHERE c.id = i.client_id AND i.number IS NOT NULL AND i.client_snapshot IS NULL`,
  `UPDATE invoices i SET company_snapshot = json_build_object('name', co.name, 'address', co.address, 'phone', co.phone,
    'email', co.email, 'legal_ids', co.legal_ids)::text
    FROM companies co WHERE co.id = i.company_id AND i.number IS NOT NULL AND i.company_snapshot IS NULL`,

  // Numérotation des avoirs et des devis (une suite par entreprise, par type et par année)
  `CREATE TABLE IF NOT EXISTS sequences (
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    year INTEGER NOT NULL,
    value INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (company_id, kind, year)
  )`,

  // Avoir émis à l'annulation d'une facture
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS credit_number TEXT`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS credit_date TEXT`,

  // Relances automatiques des factures en retard
  `ALTER TABLE companies ADD COLUMN IF NOT EXISTS reminders_enabled BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE companies ADD COLUMN IF NOT EXISTS reminder_days TEXT NOT NULL DEFAULT '3,10'`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reminders_sent INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ`,

  // Devis : même table que les factures, type « devis », avec leur propre suite de numéros
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS doc_type TEXT NOT NULL DEFAULT 'facture'`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS refused_at TIMESTAMPTZ`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS converted_invoice_id INTEGER`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source_quote_id INTEGER`,
  `ALTER TABLE companies ADD COLUMN IF NOT EXISTS quote_prefix TEXT NOT NULL DEFAULT 'DEV'`,
  `ALTER TABLE companies ADD COLUMN IF NOT EXISTS quote_validity INTEGER NOT NULL DEFAULT 30`,
  `CREATE INDEX IF NOT EXISTS invoices_doc_type ON invoices (company_id, doc_type)`,

  // Changement d'adresse e-mail : la nouvelle adresse attend sa confirmation
  `ALTER TABLE email_verifications ADD COLUMN IF NOT EXISTS new_email TEXT`,

  // Double authentification : méthode ('' = désactivée, 'email' ou 'totp'), secret de l'application (chiffré),
  // dernier code utilisé (anti-rejeu), codes de secours hachés, et vérifications en attente à la connexion
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS twofa_method TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_pending TEXT`,
  // Application d'authentification choisie (google, microsoft, authy, autre) : pour afficher son logo
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_app TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_last_step BIGINT NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes TEXT NOT NULL DEFAULT '[]'`,
  `CREATE TABLE IF NOT EXISTS login_challenges (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
  )`,

  // Documents rangés par l'entreprise : contrats, bons de commande, attestations, papiers administratifs…
  `CREATE TABLE IF NOT EXISTS documents (
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
  )`,
  `CREATE INDEX IF NOT EXISTS documents_company ON documents (company_id, category)`,

  // Photo de profil (facultative ; sans photo, une icône de profil s'affiche)
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_key TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_mime TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ`,

  // Acceptation des conditions d'utilisation à l'inscription
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ`,

  // Factures récurrentes : la facture sert de modèle, recopiée et envoyée chaque mois
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS repeat_active BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS repeat_day INTEGER`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS repeat_next TEXT`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS repeat_count INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS repeat_source_id INTEGER`,

  // Devis signé en ligne : nom tapé par le client
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS accepted_by TEXT`,

  // Accès comptable en lecture seule : lien secret (haché pour la recherche, chiffré pour le réafficher)
  `ALTER TABLE companies ADD COLUMN IF NOT EXISTS accountant_token_hash TEXT`,
  `ALTER TABLE companies ADD COLUMN IF NOT EXISTS accountant_token_enc TEXT`,
  `ALTER TABLE companies ADD COLUMN IF NOT EXISTS accountant_since TIMESTAMPTZ`,

  // Code de vérification imprimé (avec un QR code) sur chaque document émis : authenticité et statut réel
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS verify_code TEXT`,
  `UPDATE invoices SET verify_code = upper(substr(md5(random()::text || id::text || clock_timestamp()::text), 1, 12))
    WHERE number IS NOT NULL AND verify_code IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS invoices_verify_code ON invoices (verify_code)`,

  // Code de compte dans les numéros (FAC-FP481-0001) : 481 pour le premier compte, puis 482, 483…
  `CREATE SEQUENCE IF NOT EXISTS company_fp_code START WITH 481`,
  `ALTER TABLE companies ADD COLUMN IF NOT EXISTS fp_code INTEGER`,
  `UPDATE companies c SET fp_code = x.code
    FROM (SELECT id, nextval('company_fp_code') AS code FROM (SELECT id FROM companies WHERE fp_code IS NULL ORDER BY id) o) x
    WHERE c.id = x.id`,
  `ALTER TABLE companies ALTER COLUMN fp_code SET DEFAULT nextval('company_fp_code')`,
  `CREATE UNIQUE INDEX IF NOT EXISTS companies_fp_code ON companies (fp_code)`,

  // Limites de tentatives (connexion par IP, mot de passe oublié, inscription, re-saisie du mot de
  // passe) : un panier (bucket) et une clé (e-mail, IP ou identifiant de compte) par coup compté
  `CREATE TABLE IF NOT EXISTS rate_limits (
    bucket TEXT NOT NULL,
    key TEXT NOT NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS rate_limits_bucket_key ON rate_limits (bucket, key, at)`,

  // Intitulé du compte bancaire, exactement comme sur le RIB (le nom que la banque du client doit saisir)
  `ALTER TABLE companies ADD COLUMN IF NOT EXISTS account_holder TEXT NOT NULL DEFAULT ''`,

  // Envoi programmé à une heure précise : send_on garde l'instant exact (UTC), send_tz le fuseau choisi
  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS send_tz TEXT NOT NULL DEFAULT ''`,
];
