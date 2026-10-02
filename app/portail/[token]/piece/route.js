import { notFound } from 'next/navigation';
import { getEmployeeByPortalToken } from '@/lib/portal';
import { one } from '@/lib/db';
import { fileResponse } from '@/lib/documents';

// La pièce d'un salarié, servie à travers son propre lien de portail. Le droit est vérifié sur
// employee_id ET company_id : le salarié ne peut voir que ses propres pièces, pas celles d'un
// collègue dont il aurait deviné l'identifiant.
export async function GET(request, { params, searchParams }) {
  const { token } = await params;
  if (!token) notFound();

  const employee = await getEmployeeByPortalToken(token);
  if (!employee) return new Response('Accès refusé', { status: 401 });

  const sp = await searchParams;
  const type = sp.type === 'frais' ? 'frais' : 'conge';
  const id = Number(sp.id) || 0;
  if (!id) return new Response('Pièce introuvable', { status: 404 });

  const row = type === 'frais'
    ? await one(
      `SELECT receipt_url AS key, receipt_name AS name, receipt_mime AS mime
       FROM expense_reports WHERE id = $1 AND employee_id = $2 AND company_id = $3`,
      [id, employee.id, employee.company_id],
    )
    : await one(
      `SELECT document_url AS key, document_name AS name, document_mime AS mime
       FROM leave_requests WHERE id = $1 AND employee_id = $2 AND company_id = $3`,
      [id, employee.id, employee.company_id],
    );

  if (!row || !row.key) return new Response('Pièce introuvable', { status: 404 });
  return fileResponse(row.key, row.name, row.mime);
}