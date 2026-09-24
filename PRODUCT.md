# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Freelances et indépendants (développeurs, consultants, créatifs), surtout au Togo et en Afrique de l'Ouest, qui facturent des clients locaux ou à l'étranger. Ils veulent envoyer une facture propre vite, être payés, et savoir ce qui leur reste une fois les impôts mis de côté.

## Product Purpose
FactPay crée, envoie et suit les factures. Le client reçoit un e-mail avec le PDF et un lien ; il voit le montant dans sa devise, paie par virement ou Mobile Money et envoie son justificatif. Le freelance confirme le paiement et voit son net sur le tableau de bord. Fiches de paie : prochaine étape (pas encore disponible).

## Positioning
Pensé pour l'Afrique de l'Ouest francophone : francs CFA sans centimes, parité fixe € ↔ F CFA automatique, Mobile Money (Flooz, T-Money) à côté du virement, retenue à la source déduite du net à payer, NIF / RCCM sur la facture, et un lien où le client signale lui-même son paiement avec un justificatif.

## Operating Context
Interface en français, tutoiement pour le freelance, vouvoiement dans ce que reçoit son client. Hébergé sur Vercel ; e-mails via Gmail (SMTP). Envoi programmé chaque jour à 7 h (heure de Lomé).

## Capabilities and Constraints
- Comptes : prénom, nom, e-mail confirmé par lien, mot de passe robuste.
- Factures : lignes (heures, jours, forfait…), TVA facultative, retenue (% du HT), numérotation sans trou (FAC-2612-0001 : préfixe, année + n° de compte, compteur), envoi immédiat / programmé / brouillon, PDF joint.
- Devises : XOF, XAF, EUR, USD, GBP, CAD, CHF, GHS, NGN, MAD ; conversion affichée au client (parité fixe pour € / F CFA, taux saisi sinon).
- Page client : bascule de devise, téléchargement du PDF, signalement du paiement avec référence et justificatif.
- Tableau de bord : à encaisser, encaissé, net, part mise de côté pour les impôts, retenues.
- Prix : « gratuit pour commencer » (une offre payante pourra venir ; aucun montant décidé).

## Brand Commitments
- Nom : FactPay. Logo noir/blanc (public/logo_factpay_dark.png sur fond clair, public/logo_factpay_light.png sur fond sombre).
- Le style de l'application (bleu marine, gris clair, Public Sans) reste la référence visuelle, y compris pour la page d'accueil.

## Evidence on Hand
Aucun client, témoignage, chiffre d'usage ni presse. Ne rien inventer de tel ; les exemples de factures montrés sont fictifs et doivent le rester visiblement.

## Product Principles
- Être payé plus vite : chaque écran rapproche la facture de l'argent reçu.
- Les réalités locales d'abord : F CFA, Mobile Money, retenue, NIF / RCCM ne sont pas des options cachées.
- Clair pour le client du freelance, qui n'a pas de compte et ne doit rien installer.
- Honnête sur les chiffres : net réel, impôts à prévoir, rien d'approximatif.
