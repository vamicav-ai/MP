import { decideOfflinePayment } from "@/lib/actions";
import { EmptyState, Field, PageHeading, PageMessages } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { money } from "@/lib/queries";
import type { BatchDocument, OfflinePaymentDocument, UserDocument } from "@/lib/models";

type Request = { id: number; student: string; email: string; batch: string; amount_paise: number; reference: string; status: string; created_at: string | Date; decision_note: string };

export default async function AdminPaymentsPage() {
  await requireUser(["admin"]);
  const db = getDb();
  const [paymentDocs, userDocs, batchDocs] = await Promise.all([
    db.collection<OfflinePaymentDocument>("offline_payment_requests").find()
      .sort({ created_at: -1 }).toArray(),
    db.collection<UserDocument>("users").find().toArray(),
    db.collection<BatchDocument>("batches").find().toArray(),
  ]);
  const users = new Map(userDocs.map((user) => [user.id, user]));
  const batches = new Map(batchDocs.map((batch) => [batch.id, batch]));
  const requests: Request[] = paymentDocs.flatMap((item) => {
    const student = users.get(item.student_id);
    const batch = batches.get(item.batch_id);
    return student && batch ? [{
      id: item.id,
      student: student.name,
      email: student.email,
      batch: batch.title,
      amount_paise: item.amount_paise,
      reference: item.reference,
      status: item.status,
      created_at: item.created_at,
      decision_note: item.decision_note,
    }] : [];
  }).sort((left, right) => Number(right.status === "pending") - Number(left.status === "pending")
    || new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  const pending = requests.filter((request) => request.status === "pending").length;
  return (
    <>
      <PageMessages />
      <PageHeading eyebrow="MANUAL COLLECTIONS" title="Verify offline payments." description="Confirm receipt of funds before a student gets access to a paid batch." action={<span className="content-count">{pending} pending review</span>} />
      <div className="payment-reminder"><strong>Offline workflow only.</strong><span>Verify each transfer or cash collection independently. Never confirm from the student’s claim alone. This app does not collect money online.</span></div>
      {requests.length ? <div className="payment-list">{requests.map((request) => <article className="payment-card" key={request.id}><div className="payment-card-head"><div className="person-avatar">{request.student.slice(0, 1).toUpperCase()}</div><div className="person-copy"><strong>{request.student}</strong><span>{request.email}</span><small>Requested {new Date(request.created_at).toLocaleDateString("en-IN")}</small></div><span className={`status-pill status-${request.status}`}>{request.status}</span></div><div className="payment-details"><div><span>Batch</span><strong>{request.batch}</strong></div><div><span>Expected amount</span><strong>{money(request.amount_paise)}</strong></div><div><span>Student reference</span><strong>{request.reference || "Not provided"}</strong></div></div>{request.status === "pending" ? <form action={decideOfflinePayment} className="payment-decision-form"><input type="hidden" name="requestId" value={request.id} /><Field label="Verified amount (INR)" name="verifiedAmount" type="number" min={1} required defaultValue={(request.amount_paise / 100).toFixed(2)} /><Field label="Collection method" name="paymentMethod" required placeholder="Bank transfer, UPI, cash..." /><Field label="Decision note (optional)" name="decisionNote" placeholder="Reference or note" /><div className="payment-buttons"><button className="button button-outline" name="decision" value="rejected">Reject request</button><button className="button button-primary" name="decision" value="confirmed">Confirm payment & unlock</button></div></form> : <p className="decision-note">{request.status === "confirmed" ? "Verified payment recorded. Batch access is active." : `Request rejected${request.decision_note ? `: ${request.decision_note}` : "."}`}</p>}</article>)}</div> : <div className="panel"><EmptyState title="No payment requests">Offline payment requests from students will appear here for review.</EmptyState></div>}
    </>
  );
}
