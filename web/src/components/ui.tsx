import type { ReactNode } from "react";
import { FlashMessage } from "@/components/flash-message";

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="heading-action">{action}</div>}
    </div>
  );
}

export function PageMessages() {
  return <FlashMessage />;
}

export function StatCard({ label, value, note, icon }: { label: string; value: string | number; note: string; icon: ReactNode }) {
  return (
    <article className="stat-card">
      <div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="empty-state"><div className="empty-mark">✦</div><strong>{title}</strong><p>{children}</p></div>;
}

export function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  min,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  min?: number;
  defaultValue?: string | number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input name={name} type={type} required={required} placeholder={placeholder} min={min} defaultValue={defaultValue} />
    </label>
  );
}

export function SubjectChoices({
  subjects,
  selected = [],
  name = "subjectIds",
}: {
  subjects: Array<{ id: number; name: string }>;
  selected?: number[];
  name?: string;
}) {
  return (
    <div className="subject-choices">
      {subjects.map((subject) => (
        <label className="check-choice" key={subject.id}>
          <input type="checkbox" name={name} value={subject.id} defaultChecked={selected.includes(subject.id)} />
          <span>{subject.name}</span>
        </label>
      ))}
    </div>
  );
}
