import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const PLATFORMS = ["meta", "tiktok", "google", "other"] as const;

async function saveSpend(formData: FormData) {
  "use server";

  const platform = formData.get("platform") as string;
  const month = formData.get("month") as string;
  const dollars = parseFloat((formData.get("spend") as string) ?? "0");
  if (!platform || !month || !Number.isFinite(dollars)) {
    redirect("/analytics/spend?error=1");
  }

  const db = getDb();
  const id = `${platform}_${month}`;
  await db.collection("adSpend").doc(id).set({
    platform,
    month,
    spendCents: Math.round(dollars * 100),
    updatedAt: new Date(),
  });

  revalidatePath("/analytics");
  revalidatePath("/analytics/spend");
  redirect("/analytics/spend?saved=1");
}

async function deleteSpend(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  if (!id) return;
  const db = getDb();
  await db.collection("adSpend").doc(id).delete();
  revalidatePath("/analytics");
  revalidatePath("/analytics/spend");
}

export default async function AdSpendPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const db = getDb();
  const snap = await db.collection("adSpend").orderBy("month", "desc").limit(100).get();
  const rows = snap.docs.map((d) => ({
    id: d.id,
    platform: d.data().platform as string,
    month: d.data().month as string,
    spendCents: (d.data().spendCents as number) ?? 0,
  }));

  // Default month = current YYYY-MM
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-6">
      <div className="max-w-3xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <a href="/analytics" className="text-sm text-rose-500 hover:text-rose-600">
              ← Back to dashboard
            </a>
            <h1 className="text-3xl font-bold text-gray-900 mt-1">Ad spend</h1>
            <p className="text-sm text-gray-500 mt-1">
              Enter monthly ad spend per platform. Used to compute CAC on the dashboard.
            </p>
          </div>
        </header>

        <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add / update spend</h2>
          <form action={saveSpend} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Platform</label>
              <select
                name="platform"
                defaultValue="meta"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Month</label>
              <input
                type="month"
                name="month"
                defaultValue={currentMonth}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Spend (USD)
              </label>
              <input
                type="number"
                name="spend"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-lg"
            >
              Save
            </button>
          </form>
          {params?.saved && (
            <p className="text-sm text-green-600 mt-3">Saved.</p>
          )}
          {params?.error && (
            <p className="text-sm text-red-600 mt-3">Something went wrong.</p>
          )}
        </section>

        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">History</h2>
          </div>
          {rows.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500 text-sm">
              No spend entries yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">Month</th>
                  <th className="px-6 py-3 text-left font-medium">Platform</th>
                  <th className="px-6 py-3 text-right font-medium">Spend</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100">
                    <td className="px-6 py-3">{row.month}</td>
                    <td className="px-6 py-3 capitalize">{row.platform}</td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      ${(row.spendCents / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <form action={deleteSpend} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={row.id} />
                        <button
                          type="submit"
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
