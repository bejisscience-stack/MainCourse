type GrossPaymentType = "course_enrollment" | "bundle_enrollment";

export interface GrossRevenuePayment {
  id: string;
  payment_type: GrossPaymentType;
  reference_id: string;
  amount: number | string | null;
  price_at_order_time?: number | string | null;
  paid_at: string | null;
  updated_at: string | null;
  created_at: string | null;
}

interface FetchGrossRevenuePaymentsOptions {
  fromDate?: string | null;
  toDate?: string | null;
  paymentTypes?: GrossPaymentType[];
}

function paymentTimestamp(payment: GrossRevenuePayment): string | null {
  return payment.paid_at || payment.updated_at || payment.created_at;
}

function isWithinRange(
  payment: GrossRevenuePayment,
  fromDate?: string | null,
  toDate?: string | null,
): boolean {
  const timestamp = paymentTimestamp(payment);
  if (!timestamp) return false;

  const time = new Date(timestamp).getTime();
  if (Number.isNaN(time)) return false;

  if (fromDate) {
    const from = new Date(`${fromDate}T00:00:00Z`).getTime();
    if (time < from) return false;
  }

  if (toDate) {
    const to = new Date(`${toDate}T23:59:59.999Z`).getTime();
    if (time > to) return false;
  }

  return true;
}

export function grossPaymentAmount(payment: GrossRevenuePayment): number {
  return Number(payment.price_at_order_time ?? payment.amount ?? 0);
}

export function grossPaymentDate(payment: GrossRevenuePayment): string | null {
  const timestamp = paymentTimestamp(payment);
  return timestamp ? timestamp.split("T")[0] : null;
}

export async function fetchGrossRevenuePayments(
  serviceSupabase: any,
  {
    fromDate,
    toDate,
    paymentTypes = ["course_enrollment", "bundle_enrollment"],
  }: FetchGrossRevenuePaymentsOptions = {},
): Promise<GrossRevenuePayment[]> {
  const pageSize = 1000;
  const payments: GrossRevenuePayment[] = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await serviceSupabase
      .from("keepz_payments")
      .select(
        "id, payment_type, reference_id, amount, price_at_order_time, paid_at, updated_at, created_at",
      )
      .eq("status", "success")
      .in("payment_type", paymentTypes)
      .order("created_at", { ascending: true })
      .range(from, to);

    if (error) {
      throw error;
    }

    const page = (data || []) as GrossRevenuePayment[];
    payments.push(
      ...page.filter((payment) => isWithinRange(payment, fromDate, toDate)),
    );

    if (page.length < pageSize) break;
  }

  return payments;
}
