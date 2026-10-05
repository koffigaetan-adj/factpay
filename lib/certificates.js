import { frDate } from './dates.js';

// Prépare les données textuelles et légales de l'attestation de travail
export function getWorkCertificateText(company, employee) {
  const hireDateFr = employee.hire_date ? frDate(employee.hire_date) : 'la date d’embauche';
  const todayFr = frDate(new Date().toISOString().split('T')[0]);
  const isPresent = !employee.end_date || employee.status === 'actif';

  const durationText = isPresent
    ? `depuis le ${hireDateFr} et continue d'y exercer ses fonctions à ce jour.`
    : `du ${hireDateFr} au ${frDate(employee.end_date)}.`;

  return {
    title: 'ATTESTATION DE TRAVAIL',
    companyName: company.name,
    companyAddress: company.address,
    companyLegalIds: company.legal_ids,
    employeeFullName: `${employee.first_name} ${employee.last_name}`,
    employeeJobTitle: employee.job_title || 'Salarié',
    employeeCnss: employee.cnss_number,
    employeeIdCard: employee.id_card_number,
    contractType: employee.contract_type || 'CDI',
    durationText,
    dateText: `Fait à ${company.address ? company.address.split(',')[0] : 'Lomé'}, le ${todayFr}`,
    statement: `Nous soussignés, ${company.name}, attestons par la présente que M./Mme ${employee.first_name} ${employee.last_name}, titulaire du N° CNSS ${employee.cnss_number || 'en cours'}, est employé(e) au sein de notre structure en qualité de ${employee.job_title || 'Collaborateur'} (${employee.contract_type}) ${durationText}`,
    closing: "La présente attestation lui est délivrée pour servir et valoir ce que de droit.",
  };
}
