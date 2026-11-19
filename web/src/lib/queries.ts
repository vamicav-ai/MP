import "server-only";

import type { Filter } from "mongodb";
import { getDb, initializeDatabase } from "@/lib/db";
import type {
  BatchDocument,
  EnrollmentDocument,
  OfflinePaymentDocument,
  SubjectDocument,
} from "@/lib/models";

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
  await initializeDatabase();
  return getDb().collection<SubjectDocument>("subjects")
    .find({ active: 1 }, { projection: { _id: 0, id: 1, name: 1, description: 1 } })
    .sort({ name: 1 })
    .toArray();
}

export async function getBatches(studentId?: number): Promise<Batch[]> {
  await initializeDatabase();
  const database = getDb();
  const [batches, links, subjects, enrollments, payments] = await Promise.all([
    database.collection<BatchDocument>("batches").find({ published: 1 }).sort({ created_at: -1 }).toArray(),
    database.collection<{ batch_id: number; subject_id: number }>("batch_subjects").find().toArray(),
    database.collection<SubjectDocument>("subjects").find().toArray(),
    studentId
      ? database.collection<EnrollmentDocument>("enrollments").find({ student_id: studentId }).toArray()
      : Promise.resolve([] as EnrollmentDocument[]),
    studentId
      ? database.collection<OfflinePaymentDocument>("offline_payment_requests").find({ student_id: studentId }).toArray()
      : Promise.resolve([] as OfflinePaymentDocument[]),
  ]);
  const subjectNames = new Map(subjects.map((subject) => [subject.id, subject.name]));
  const subjectsByBatch = new Map<number, string[]>();
  for (const link of links) {
    const name = subjectNames.get(link.subject_id);
    if (name) subjectsByBatch.set(link.batch_id, [...(subjectsByBatch.get(link.batch_id) ?? []), name]);
  }
  const enrollmentByBatch = new Map(enrollments.map((item) => [item.batch_id, item.status]));
  const paymentByBatch = new Map(payments.map((item) => [item.batch_id, item.status]));

  return batches.map((batch) => ({
    id: batch.id,
    title: batch.title,
    description: batch.description,
    price_paise: batch.price_paise,
    is_free: batch.is_free,
    published: batch.published,
    subjects: (subjectsByBatch.get(batch.id) ?? []).join(", "),
    enrollment_status: enrollmentByBatch.get(batch.id),
    payment_status: paymentByBatch.get(batch.id),
  }));
}

export function money(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export async function countDocuments(
  collectionName: string,
  filter: Filter<object> = {},
): Promise<number> {
  await initializeDatabase();
  return getDb().collection(collectionName).countDocuments(filter);
}

export async function canStudentAccessBatch(studentId: number, batchId: number | null): Promise<boolean> {
  if (batchId === null) return true;
  await initializeDatabase();
  return Boolean(
    await getDb().collection<EnrollmentDocument>("enrollments")
      .findOne({ student_id: studentId, batch_id: batchId, status: "active" }),
  );
}
