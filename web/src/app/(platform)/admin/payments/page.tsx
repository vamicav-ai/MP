import { decideOfflinePayment } from "@/lib/actions";
import { EmptyState, Field, PageHeading, PageMessages } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { money } from "@/lib/queries";

type Request = { id: number; student: string; email: string; batch: string; amount_paise: number; reference: string; status: string; created_at: string; decision_note: string };

export default async function AdminPaymentsPage() {
  await requireUser(["admin"]);
  const requests = await getDb().prepare(`
    SELECT requests.id, users.name AS student, users.email, batches.title AS batch,
      requests.amount_paise, requests.reference, requests.status, requests.created_at, requests.decision_note
    FROM offline_payment_requests AS requests
    JOIN users ON users.id = requests.student_id
    JOIN batches ON batches.id = requests.batch_id
    ORDER BY CASE requests.status WHEN 'pending' THEN 0 ELSE 1 END, requests.created_at DESC
  `).all() as Request[];
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
