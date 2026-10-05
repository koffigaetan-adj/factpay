# FactPay

Logiciel de facturation en ligne, multi-comptes. Chaque personne crée son compte, renseigne son entreprise, puis crée et envoie ses factures en francs CFA ou en euros.

## Ce que fait le logiciel

- **Comptes** : inscription, connexion, mot de passe oublié. Chaque compte ne voit que ses propres données.
- **Entreprise** : après l'inscription, on demande le nom, l'adresse, le NIF / RCCM, la banque, le Mobile Money, la devise, la TVA, etc. Tout se modifie ensuite dans Paramètres.
- **Clients** : ajout, modification, suppression (seulement s'ils n'ont pas de facture).
- **Factures** :
  - plusieurs lignes (heures, jours, forfait…) et TVA facultative ;
  - numérotation automatique sans trou (`FAC-FP481-0001` : préfixe, « FP » + code du compte à partir de 481, puis compteur qui ne repart jamais à zéro), attribuée au moment de l'envoi ;
  - envoi immédiat, envoi programmé à une date, ou brouillon ;
  - PDF joint à l'e-mail.
- **Côté client** : il ouvre le lien reçu par e-mail. Il voit la facture, passe de € à F CFA avec un bouton (parité fixe 1 € = 655,957 F CFA), télécharge le PDF et signale son paiement avec une référence et un justificatif.
- **Suivi** : l'entreprise est prévenue par e-mail, consulte le justificatif et confirme le paiement. Le tableau de bord indique ce qui reste à encaisser, ce qui a été encaissé, la part mise de côté pour les impôts et le net.
- **Relances** : e-mail automatique aux clients en retard (par défaut 3 et 10 jours après l'échéance), ou à la main.
- **Annulation** : une facture envoyée non payée peut être annulée ; un avoir numéroté (`AV-FP481-0001`) est émis et envoyé au client.
- **Devis** : numérotés à part (`DEV-FP481-0001`), acceptés ou refusés en ligne par le client, transformés en facture en un clic.
- **Dupliquer** : copie d'une facture en brouillon, avec la période décalée au mois suivant.
- **Export** : fichier CSV (Excel) des factures de l'année pour le comptable.
- **Double authentification** : code par e-mail ou application (Google Authenticator, Authy…), avec 8 codes de secours.
- **Factures récurrentes** : une facture sert de modèle et repart seule chaque mois (période décalée).
- **Devis signés en ligne** : le client tape son nom et coche « Bon pour accord ».
- **WhatsApp** : bouton qui ouvre WhatsApp avec le message et le lien de la facture déjà prêts.
- **Rapports** : récapitulatif de l'année (HT, TVA, retenues, encaissé) par client et par mois, exportable.
- **Accès comptable** : lien secret en lecture seule (factures, avoirs, récapitulatif, exports), révocable.
- **Documents** : contrats, bons de commande, attestations, rattachés ou non à un client, avec échéances.
- **Application installable** sur téléphone (manifeste et icônes).
- **Conditions d'utilisation** et **confidentialité** : pages à compléter (passages entre crochets) et à faire relire.
- **Prochainement** : paiement en ligne (Mobile Money, carte) et fiches de paie.
- **Mode sombre** : suit le réglage de l'appareil.
- **Fiches de paie** : prochaine étape.

## Technologies

| Rôle | Outil |
|---|---|
| Application | Next.js 16 (App Router, Server Actions) |
| Base de données | Postgres chez **Neon** en ligne, **PGlite** (Postgres local, dans `.data/`) sur ton ordinateur |
| Justificatifs | **Vercel Blob** en ligne, dossier `.data/uploads` en local |
| E-mails | **SMTP** (Gmail pour démarrer ; affichés dans la console tant que `SMTP_USER` est vide) |
| Envoi programmé | **Vercel Cron**, chaque jour à 7 h (UTC, heure de Lomé), complété par un rattrapage à l'ouverture de l'application. Voir `vercel.json` et « Envois programmés » plus bas |
| PDF | pdfkit |

## Lancer sur ton ordinateur

Il faut Node.js 20 ou plus récent.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Pour lancer les tests automatiques (calculs, factures, devis, relances, sur une base en mémoire) : `npm test`.

Ouvre http://localhost:3000, puis crée un compte. Aucun compte extérieur n'est nécessaire : la base et les fichiers sont dans `.data/`. Supprime ce dossier pour repartir de zéro.

## Mise en ligne sur Vercel

### 1. Mettre le code sur GitHub
Crée un dépôt **privé** sur github.com et envoies-y le contenu de ce dossier. Les fichiers `.env.local` et `.data/` ne partent pas, c'est voulu.

### 2. Créer le projet Vercel
Sur vercel.com : **Add New → Project**, puis choisis le dépôt. Vercel reconnaît Next.js tout seul. Ne lance pas encore le déploiement, ou laisse-le échouer : la base n'existe pas encore.

### 3. Ajouter la base de données (Neon)
Dans le projet : **Storage → Create Database → Neon (Postgres)**, région **Europe (Frankfurt)** par exemple. Vercel ajoute la variable `DATABASE_URL` automatiquement. Les tables sont créées à chaque déploiement par `scripts/setup-db.js`.

### 4. Ajouter le stockage des fichiers (Blob)
**Storage → Create → Blob**, accès **Private**, puis **Connect Project**. Vercel ajoute `BLOB_STORE_ID` : les justificatifs et les logos y sont rangés, et seul le logiciel peut les lire.

### 5. Configurer les e-mails (Gmail)
1. Sur ton compte Google, active la **validation en deux étapes** (myaccount.google.com → Sécurité).
2. Crée un **mot de passe d'application** : myaccount.google.com/apppasswords. Google affiche 16 lettres.
3. Dans Vercel, **Settings → Environment Variables** :
   - `SMTP_USER` = ton adresse Gmail
   - `SMTP_PASS` = les 16 lettres, sans espaces
   - `MAIL_FROM` = `FactPay <ton-adresse@gmail.com>` (Gmail impose ta propre adresse)

Gmail limite à environ 500 e-mails par jour. Pour passer plus tard à un autre service (Resend, Brevo…), il suffit de changer `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` et `SMTP_PASS`.

### 6. Les autres variables
- `CRON_SECRET` : une longue chaîne aléatoire, **à définir dans Vercel** (le fichier `.env.local` n'est pas déployé). Vercel l'envoie automatiquement à la tâche quotidienne ; sans elle, `/api/cron` répond `401` et rien ne part.
- `AUTH_SECRET` : une autre longue chaîne aléatoire, qui chiffre les secrets de la double authentification. À ne plus changer une fois en ligne.
- `APP_URL` : l'adresse publique, par exemple `https://factures.ton-domaine.com`. Facultatif si tu gardes l'adresse `…vercel.app`.

### 7. Déployer
**Deployments → Redeploy**. Ouvre ensuite l'adresse du projet et crée ton compte.

### Envoyer les e-mails depuis ton nom de domaine
Gmail convient pour démarrer (environ 500 e-mails par jour), mais un expéditeur sur ton propre domaine arrive plus souvent en boîte de réception et fait plus professionnel. Le code n'a pas à changer : FactPay envoie par SMTP.
1. Crée un compte chez un service d'envoi, par exemple **Brevo** (gratuit jusqu'à 300 e-mails par jour) ou **Resend**.
2. Ajoute ton domaine et les enregistrements DNS qu'il indique (SPF, DKIM) chez ton registraire.
3. Dans Vercel, remplace les variables : `SMTP_HOST` et `SMTP_PORT` (fournis par le service), `SMTP_USER` et `SMTP_PASS` (identifiants SMTP du service), `MAIL_FROM` = `FactPay <factures@ton-domaine.com>`.
4. Redéploie.

### Sauvegardes et incidents
- **Base de données** : Neon garde un historique qui permet de revenir à un instant passé (« restore » ou création d'une branche à une date donnée, depuis la console Neon ; la durée dépend de l'offre). Pense aussi à exporter tes factures chaque année (Factures → Exporter).
- **Erreurs en ligne** : elles apparaissent dans Vercel → Logs. Les pages d'erreur affichent une référence à rapprocher des journaux. Pour être alerté automatiquement, un service comme Sentry peut être ajouté plus tard.

### Nom de domaine
Dans **Settings → Domains**, ajoute ton domaine (par exemple `factures.ton-domaine.com`), puis mets à jour `APP_URL`.

### Envois programmés

Une facture programmée part quand son heure arrive. Le chemin suivi est toujours le même :

- **À l'ouverture de l'application** : l'espace connecté déclenche un passage qui envoie ce qui vient d'échoir pour cette entreprise (au plus une fois par minute). C'est ce qui fait partir une facture prévue le jour même.
- **Une fois par jour à 7 h UTC** : la tâche `/api/cron` rattrape tout ce qui reste, y compris les envois échoués, les factures récurrentes et les relances. Sur l'offre gratuite de Vercel les tâches ne se déclenchent qu'une fois par jour, c'est pourquoi le rattrapage à l'ouverture existe.

Chaque facture est **réservée** (`invoices.sending_at`) avant l'envoi, pour que la navigation et la tâche quotidienne ne partent pas la même facture en double. Une réservation abandonnée depuis plus de dix minutes est récupérée au passage suivant.

Trois réglages à vérifier en ligne, dans cet ordre :

| Symptôme | Cause | Vérification |
|---|---|---|
| Rien ne part, jamais | `CRON_SECRET` absent de Vercel | `GET /api/cron` avec l'en-tête `Authorization: Bearer <CRON_SECRET>` : `401` = à corriger dans les variables du projet |
| Les factures passent pour envoyées, le client ne reçoit rien | `SMTP_USER` / `SMTP_PASS` absents | un bandeau rouge le signale en haut de l'espace connecté ; la réponse de `/api/cron` contient `avertissement` |
| Tout part tard, ou par lots | la tâche a été interrompue en cours de route | les factures réservées repartent au passage suivant ; `/api/cron` renvoie le compte des envois réussis et échoués |

Le plus simple, pour vérifier d'un coup : ouvrir `/api/cron` dans le navigateur et lire la réponse.

| Réponse de `/api/cron` | Signification |
|---|---|
| `500` + `CRON_SECRET absent des variables du projet Vercel` | la variable n'existe pas dans le projet : le cron ne peut rien faire |
| `401 Non autorisé` | la variable existe, mais tu es allé la chercher sans l'en-tête : c'est normal, ça ne dit rien sur le cron |
| JSON avec `sent`, `failed`… | le cron fonctionne ; ouvre-le avec l'en-tête pour déclencher un vrai passage |

Pour déclencher un passage à la main (utile pour vider une facture qui vient d'échoir) :

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://ton-domaine/api/cron
```

Puis, dans **Vercel → Logs**, filtre sur `/api/cron` : chaque passage quotidien y laisse une ligne. Si tu n'en vois aucune, la tâche ne se déclenche pas.

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
