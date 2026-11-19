export type UserDocument = {
  id: number;
  name: string;
  email: string;
  email_key: string;
  mobile: string;
  password_hash: string;
  role: "student" | "teacher" | "admin";
  active: number;
  created_at: Date;
};

export type SessionDocument = {
  token_hash: string;
  user_id: number;
  device_id: string;
  expires_at: Date;
  created_at: Date;
};

export type SubjectDocument = {
  id: number;
  name: string;
  name_key: string;
  description: string;
  active: number;
};

export type RelationDocument = {
  student_id?: number;
  teacher_id?: number;
  subject_id?: number;
  batch_id?: number;
};

export type BatchDocument = {
  id: number;
  title: string;
  description: string;
  price_paise: number;
  is_free: number;
  published: number;
  created_at: Date;
};

export type EnrollmentDocument = {
  id: number;
  student_id: number;
  batch_id: number;
  status: "active" | "revoked";
  created_at: Date;
};

export type OfflinePaymentDocument = {
  id: number;
  student_id: number;
  batch_id: number;
  amount_paise: number;
  verified_amount_paise: number | null;
  payment_method: string | null;
  reference: string;
  status: "pending" | "confirmed" | "rejected";
  decision_note: string;
  verified_by: number | null;
  verified_at: Date | null;
  created_at: Date;
};

export type ClassDocument = {
  id: number;
  title: string;
  description: string;
  subject_id: number;
  teacher_id: number;
  batch_id: number | null;
  video_url: string;
  duration_seconds: number;
  published: number;
  created_at: Date;
};

export type ClassProgressDocument = {
  student_id: number;
  class_id: number;
  position_seconds: number;
  updated_at: Date;
};

export type ReelSeriesDocument = {
  id: number;
  title: string;
  topic: string;
  subject_id: number;
  teacher_id: number;
  batch_id: number | null;
  published: number;
  created_at: Date;
};

export type ReelDocument = {
  id: number;
  series_id: number;
  title: string;
  description: string;
  video_url: string;
  duration_seconds: number;
  sequence_number: number;
  published: number;
  created_at: Date;
};

export type ReelProgressDocument = {
  student_id: number;
  reel_id: number;
  position_seconds: number;
  watched_seconds: number;
  checkpoint_at: Date;
  completed: number;
  updated_at: Date;
};

export type NotificationDocument = {
  id: number;
  user_id: number;
  message: string;
  read_at: Date | null;
  created_at: Date;
};

export type AuditLogDocument = {
  id: number;
  actor_id: number | null;
  action: string;
  details: string;
  created_at: Date;
};
