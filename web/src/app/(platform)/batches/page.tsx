import Link from "next/link";
import { ArrowRight, Check, Clock3, UsersRound } from "lucide-react";
import { joinFreeBatch, requestOfflinePayment } from "@/lib/actions";
import { EmptyState, PageHeading, PageMessages } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getBatches, money } from "@/lib/queries";

export default async function BatchesPage() {
  const user = await requireUser(["student"]);
  const batches = await getBatches(user.id);
  return (
    <>
      <PageMessages />
      <PageHeading eyebrow="FIND YOUR NEXT CLASS" title="Learning that fits your goals." description="Join a batch to learn with structure, or request access after you make an offline payment." />
      {batches.length ? (
        <div className="batch-grid">
          {batches.map((batch, index) => {
            const joined = batch.enrollment_status === "active";
            const waiting = batch.payment_status === "pending";
            return (
              <article className="batch-card" key={batch.id}>
                <div className={`batch-art batch-art-${index % 4}`}><span className="batch-art-tag">{batch.is_free ? "OPEN ACCESS" : "GUIDED BATCH"}</span><div className="batch-art-symbol">{String(index + 1).padStart(2, "0")}</div></div>
                <div className="batch-card-body">
                  <div className="batch-subject">{batch.subjects || "Learning batch"}</div>
                  <h2>{batch.title}</h2>
                  <p>{batch.description || "A focused path to build your knowledge and confidence."}</p>
                  <div className="batch-meta"><span><UsersRound size={15} /> Self-paced</span><strong>{batch.is_free ? "Free" : money(batch.price_paise)}</strong></div>
                  {joined ? (
                    <Link className="button button-outline button-full" href="/classes">You’re enrolled <Check size={16} /></Link>
                  ) : waiting ? (
                    <button className="button button-pending button-full" disabled><Clock3 size={16} /> Payment review pending</button>
                  ) : batch.is_free ? (
                    <form action={joinFreeBatch}><input type="hidden" name="batchId" value={batch.id} /><button className="button button-primary button-full" type="submit">Join this batch <ArrowRight size={16} /></button></form>
                  ) : (
                    <form action={requestOfflinePayment} className="batch-payment-form">
                      <input type="hidden" name="batchId" value={batch.id} />
                      <input className="compact-input" name="reference" placeholder="Offline payment reference (optional)" maxLength={120} />
                      <button className="button button-dark button-full" type="submit">Request access after payment <ArrowRight size={16} /></button>
                      <small>Access is unlocked after an administrator confirms receipt of your offline payment.</small>
                    </form>
                  )}
                  {batch.payment_status === "rejected" && <div className="inline-notice">Previous request was not confirmed. Contact your administrator.</div>}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="panel"><EmptyState title="No batches are published yet">Check back soon. Your administrator is preparing new learning paths.</EmptyState></div>
      )}
    </>
  );
}
