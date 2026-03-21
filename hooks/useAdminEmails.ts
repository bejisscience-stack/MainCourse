import useSWR from "swr";
import { supabase } from "@/lib/supabase";

export interface AdminEmailEntry {
  email: string;
  source: "profile" | "coming_soon" | "both";
  user_id: string | null;
  full_name: string | null;
  username: string | null;
  role: string | null;
  is_registered: boolean;
  registered_at: string | null;
  has_enrollment: boolean;
  enrolled_courses_count: number;
  last_email_sent_at: string | null;
  total_emails_sent: number;
}

async function fetchAdminEmails(): Promise<AdminEmailEntry[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const response = await fetch(`/api/admin/emails?t=${Date.now()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Cache-Control": "no-cache",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.emails || [];
}

export function useAdminEmails() {
  const { data, error, isLoading, mutate } = useSWR<AdminEmailEntry[]>(
    "admin-emails",
    fetchAdminEmails,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    },
  );

  return {
    emails: data || [],
    isLoading,
    error,
    mutate,
  };
}
