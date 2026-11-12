import "server-only";

import { getDb } from "@/lib/db";

export type Subject = { id: number; name: string; description: string };
export type Batch = {
  id: number;
  title: string;
  description: string;
  price_paise: number;
  is_free: number;
  published: number;
  subjects: string;
  enrollment_status?: string;
  payment_status?: string;
};

export async function getSubjects(): Promise<Subject[]> {
  return await getDb()
    .prepare("SELECT id, name, description FROM subjects WHERE active = 1 ORDER BY name")
    .all() as Subject[];
}

export async function getBatches(studentId?: number): Promise<Batch[]> {
  const rows = await getDb().prepare(`
    SELECT batches.id, batches.title, batches.description, batches.price_paise, batches.is_free,
      batches.published, COALESCE(group_concat(subjects.name, ', '), '') AS subjects
    FROM batches
    LEFT JOIN batch_subjects ON batch_subjects.batch_id = batches.id
    LEFT JOIN subjects ON subjects.id = batch_subjects.subject_id
    WHERE batches.published = 1
    GROUP BY batches.id
    ORDER BY batches.created_at DESC
  `).all() as Batch[];
  if (!studentId) return rows;
  return Promise.all(rows.map(async (batch) => {
    const [enrollment, payment] = await Promise.all([
      getDb().prepare("SELECT status FROM enrollments WHERE student_id = ? AND batch_id = ?")
        .get(studentId, batch.id) as Promise<{ status: string } | undefined>,
      getDb().prepare("SELECT status FROM offline_payment_requests WHERE student_id = ? AND batch_id = ?")
        .get(studentId, batch.id) as Promise<{ status: string } | undefined>,
    ]);
    return { ...batch, enrollment_status: enrollment?.status, payment_status: payment?.status };
  }));
}

export function money(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export async function countRows(query: string): Promise<number> {
  const row = await getDb().prepare(query).get() as { count: number | string };
  return Number(row.count);
}

export async function canStudentAccessBatch(studentId: number, batchId: number | null): Promise<boolean> {
  if (batchId === null) return true;
  return Boolean(
    await getDb().prepare("SELECT 1 FROM enrollments WHERE student_id = ? AND batch_id = ? AND status = 'active'")
      .get(studentId, batchId),
  );
}
