// Calculs sans base de données : montants, devises, périodes, jours fériés, numéros Mobile Money, mots de passe.
// Lancer avec : npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totals, convert, fixedRate, rateLabel, money, roundFor } from '../lib/money.js';
import { workedDays, periodHours, describePeriod, periodSummary, shiftPeriod, cleanPeriod } from '../lib/period.js';
import { holidayName, holidaysOf } from '../lib/holidays.js';
import { localNumber, formatNumber, cleanMobiles } from '../lib/payment.js';
import { passwordProblem } from '../lib/password.js';

const nbsp = (s) => s.replace(/[  ]/g, ' ');

test('totaux : TVA, retenue sur la base hors primes, net à payer', () => {
  const t = totals([
    { kind: 'period', quantity: 136, unit_price: 40 },
    { kind: 'prime', quantity: 2, unit_price: 250 },
  ], 0, 5, 'EUR');
  assert.deepEqual(t, { subtotal: 5940, vat: 0, total: 5940, base: 5440, withholding: 272, due: 5668 });

  const v = totals([{ quantity: 10, unit_price: 100000 }], 18, 5, 'XOF');
  assert.equal(v.vat, 180000);
  assert.equal(v.total, 1180000);
  assert.equal(v.withholding, 50000); // 5 % du HT, pas du TTC
  assert.equal(v.due, 1130000);
});

test('francs CFA sans centimes, euros au centime', () => {
  assert.equal(roundFor(1234.6, 'XOF'), 1235);
  assert.equal(roundFor(1234.567, 'EUR'), 1234.57);
  assert.equal(nbsp(money(1567500, 'XOF')), '1 567 500 F CFA');
});

test('parité fixe € / F CFA et taux saisi', () => {
  assert.equal(fixedRate('EUR', 'XOF'), 655.957);
  assert.equal(fixedRate('XOF', 'XAF'), 1);
  assert.equal(fixedRate('USD', 'XOF'), null);
  assert.equal(convert(1000, fixedRate('EUR', 'XOF'), 'XOF'), 655957);
  // Affichage arrondi, calcul exact
  assert.equal(nbsp(rateLabel('XOF', 'EUR', fixedRate('XOF', 'EUR'))), '1 € ≈ 656 F CFA (parité fixe 655,957)');
  assert.equal(nbsp(rateLabel('USD', 'XOF', 604.37)), '1 $ US ≈ 604 F CFA');
  assert.equal(nbsp(rateLabel('GBP', 'EUR', 1.1734)), '1 £ ≈ 1,17 €');
  assert.equal(nbsp(rateLabel('USD', 'XOF', 600)), '1 $ US = 600 F CFA');
});

test('jours fériés : France et Togo', () => {
  assert.equal(holidayName('2026-04-06', 'FR'), 'Lundi de Pâques');
  assert.equal(holidayName('2026-05-14', 'FR'), 'Ascension');
  assert.equal(holidayName('2026-07-14', 'FR'), 'Fête nationale');
  assert.equal(holidayName('2026-04-27', 'TG'), "Fête de l'indépendance");
  assert.equal(holidayName('2026-04-27', 'FR'), undefined);
  assert.equal(Object.keys(holidaysOf(2026, 'FR')).length, 11);
});

test('période : mois entier sans week-ends ni fériés', () => {
  const p = { mode: 'mois', month: '2026-05', hours_per_day: 8, exclude_weekends: true, exclude_holidays: true, country: 'FR' };
  assert.equal(workedDays(p).length, 17); // 21 jours de semaine − 4 fériés
  assert.equal(periodHours(p), 136);
  assert.equal(describePeriod(p), 'mai 2026');
  assert.equal(periodSummary(p), '17 jours travaillés × 8 h');
});

test('période : du … au …, jours au choix, heures décimales', () => {
  assert.equal(describePeriod({ mode: 'periode', from: '2026-09-28', to: '2026-10-09', exclude_weekends: true }), 'du 28 septembre au 9 octobre 2026');
  const j = { mode: 'jours', dates: ['2026-09-01', '2026-09-03'], hours_per_day: '7,5' };
  assert.equal(periodHours(j), 15);
  assert.equal(describePeriod(j), 'du 1er au 3 septembre 2026');
  assert.equal(cleanPeriod({ mode: 'mois', month: '' }), null); // aucun jour : pas de période
});

test('duplication : la période passe au mois suivant', () => {
  const next = shiftPeriod({ mode: 'mois', month: '2026-12', from: '2026-01-31', to: '', dates: ['2026-01-30', '2026-01-31'] }, 1);
  assert.equal(next.month, '2027-01');
  assert.equal(next.from, '2026-02-28'); // fin de mois ramenée au dernier jour
  assert.deepEqual(next.dates, ['2026-02-28']);
});

test('Mobile Money : numéros au format du pays', () => {
  assert.equal(localNumber('90 12 34 56', 'TG'), '90123456');
  assert.equal(localNumber('+228 90123456', 'TG'), '90123456');
  assert.equal(localNumber('9012345', 'TG'), null);
  assert.equal(formatNumber('90123456', 'TG'), '+228 90 12 34 56');
  assert.equal(cleanMobiles([{ operator: 'Flooz', number: '901234' }], 'TG').error, 'Le numéro Flooz doit avoir 8 chiffres (Togo, +228).');
  assert.deepEqual(cleanMobiles([{ operator: 'Autre', other: 'Ecobank Xpress', number: '70112233' }], 'TG').list,
    [{ operator: 'Ecobank Xpress', number: '70112233' }]);
});

test('mot de passe : règles et confirmation', () => {
  assert.match(passwordProblem('abc', 'abc'), /trop faible/);
  assert.equal(passwordProblem('Factpay#2026', 'Factpay#2026'), null);
  assert.equal(passwordProblem('Factpay#2026', 'Factpay#2025'), 'Les deux mots de passe ne sont pas identiques.');
});
