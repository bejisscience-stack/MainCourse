export type KycStatus = "not_submitted" | "pending" | "verified" | "rejected";

export type KycDocType = "id_card" | "passport" | "drivers_license";

export type KycSubmissionStatus = "pending" | "verified" | "rejected";

export interface KycSubmission {
  id: string;
  user_id: string;
  doc_type: KycDocType;
  doc_front_path: string;
  doc_back_path: string | null;
  selfie_path: string;
  phone: string;
  status: KycSubmissionStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    email: string;
    username: string | null;
    role: string;
  };
}

export interface KycStatusResponse {
  status: KycStatus;
  submission: KycSubmission | null;
}

export interface KycSignedUrls {
  frontUrl: string;
  backUrl: string | null;
  selfieUrl: string;
}
