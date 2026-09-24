# FactPay

Logiciel de facturation en ligne, multi-comptes. Chaque personne crée son compte, renseigne son entreprise, puis crée et envoie ses factures en francs CFA ou en euros.

## Ce que fait le logiciel

- **Comptes** : inscription, connexion, mot de passe oublié. Chaque compte ne voit que ses propres données.
- **Entreprise** : après l'inscription, on demande le nom, l'adresse, le NIF / RCCM, la banque, le Mobile Money, la devise, la TVA, etc. Tout se modifie ensuite dans Paramètres.
- **Clients** : ajout, modification, suppression (seulement s'ils n'ont pas de facture).
- **Factures** :
  - plusieurs lignes (heures, jours, forfait…) et TVA facultative ;
  - numérotation automatique sans trou (`FAC-2026-0001`), attribuée au moment de l'envoi ;
  - envoi immédiat, envoi programmé à une date, ou brouillon ;
  - PDF joint à l'e-mail.
- **Côté client** : il ouvre le lien reçu par e-mail. Il voit la facture, passe de € à F CFA avec un bouton (parité fixe 1 € = 655,957 F CFA), télécharge le PDF et signale son paiement avec une référence et un justificatif.
- **Suivi** : l'entreprise est prévenue par e-mail, consulte le justificatif et confirme le paiement. Le tableau de bord indique ce qui reste à encaisser, ce qui a été encaissé, la part mise de côté pour les impôts et le net.
- **Fiches de paie** : prochaine étape.

## Technologies

| Rôle | Outil |
|---|---|
| Application | Next.js 16 (App Router, Server Actions) |
| Base de données | Postgres chez **Neon** en ligne, **PGlite** (Postgres local, dans `.data/`) sur ton ordinateur |
| Justificatifs | **Vercel Blob** en ligne, dossier `.data/uploads` en local |
| E-mails | **SMTP** (Gmail pour démarrer ; affichés dans la console tant que `SMTP_USER` est vide) |
| Envoi programmé | **Vercel Cron**, chaque jour à 7 h (UTC, heure de Lomé), voir `vercel.json` |
| PDF | pdfkit |

## Lancer sur ton ordinateur

Il faut Node.js 20 ou plus récent.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Ouvre http://localhost:3000, puis crée un compte. Aucun compte extérieur n'est nécessaire : la base et les fichiers sont dans `.data/`. Supprime ce dossier pour repartir de zéro.

## Mise en ligne sur Vercel

### 1. Mettre le code sur GitHub
Crée un dépôt **privé** sur github.com et envoies-y le contenu de ce dossier. Les fichiers `.env.local` et `.data/` ne partent pas, c'est voulu.

### 2. Créer le projet Vercel
Sur vercel.com : **Add New → Project**, puis choisis le dépôt. Vercel reconnaît Next.js tout seul. Ne lance pas encore le déploiement, ou laisse-le échouer : la base n'existe pas encore.

### 3. Ajouter la base de données (Neon)
Dans le projet : **Storage → Create Database → Neon (Postgres)**, région **Europe (Frankfurt)** par exemple. Vercel ajoute la variable `DATABASE_URL` automatiquement. Les tables sont créées à chaque déploiement par `scripts/setup-db.js`.

### 4. Ajouter le stockage des justificatifs (Blob)
**Storage → Create → Blob**. Vercel ajoute `BLOB_READ_WRITE_TOKEN`.

### 5. Configurer les e-mails (Gmail)
1. Sur ton compte Google, active la **validation en deux étapes** (myaccount.google.com → Sécurité).
2. Crée un **mot de passe d'application** : myaccount.google.com/apppasswords. Google affiche 16 lettres.
3. Dans Vercel, **Settings → Environment Variables** :
   - `SMTP_USER` = ton adresse Gmail
   - `SMTP_PASS` = les 16 lettres, sans espaces
   - `MAIL_FROM` = `FactPay <ton-adresse@gmail.com>` (Gmail impose ta propre adresse)

Gmail limite à environ 500 e-mails par jour. Pour passer plus tard à un autre service (Resend, Brevo…), il suffit de changer `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` et `SMTP_PASS`.

### 6. Les autres variables
- `CRON_SECRET` : une longue chaîne aléatoire. Vercel l'envoie automatiquement à la tâche quotidienne.
- `APP_URL` : l'adresse publique, par exemple `https://factures.ton-domaine.com`. Facultatif si tu gardes l'adresse `…vercel.app`.

### 7. Déployer
**Deployments → Redeploy**. Ouvre ensuite l'adresse du projet et crée ton compte.

### Nom de domaine
Dans **Settings → Domains**, ajoute ton domaine (par exemple `factures.ton-domaine.com`), puis mets à jour `APP_URL`.

## Coûts

Pour démarrer, tout tient dans les offres gratuites :

| Service | Gratuit jusqu'à |
|---|---|
| Vercel Hobby | usage personnel, non commercial |
| Neon | 0,5 Go de base |
| Vercel Blob | 1 Go |
| Gmail | environ 500 e-mails par jour |

Si le logiciel est vendu ou utilisé par des entreprises, les conditions de Vercel demandent l'offre **Pro** (20 $ par mois).

## Structure

```
app/actions.js              toutes les actions (comptes, clients, factures, paiement)
app/(espace)/…              pages de l'espace connecté (tableau de bord, factures, clients, paramètres)
app/f/[token]               page publique de la facture pour le client
app/api/cron                tâche quotidienne (envois programmés, nouvel essai après échec)
lib/db.js, lib/schema.js    base de données
lib/auth.js                 mots de passe (scrypt), sessions, blocage après 5 échecs
lib/invoices.js             numérotation, envoi, paiement signalé, confirmation
lib/money.js                montants, € ↔ F CFA, TVA
lib/pdf.js                  facture PDF
components/                 formulaires et éléments d'interface
```
