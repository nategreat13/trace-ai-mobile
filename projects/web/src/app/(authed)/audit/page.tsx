import { listAuditEntries } from "@/lib/audit";
import { getAdminEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const env = await getAdminEnv();
  const entries = await listAuditEntries(env, 300);

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Audit log</h1>
        <p className="text-sm text-gray-500 mt-1">
          Every admin action — adding/removing exclusions, editing ad spend,
          excluding users from the detail page. Append-only; entries are
          never modified or deleted.
        </p>
      </header>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {entries.length === 0 ? (
          <div className="px-6 py-16 text-center text-gray-500 text-sm">
            No audit entries yet. They'll start appearing as you make
            changes.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Time</th>
                <th className="px-6 py-3 text-left font-medium">Action</th>
                <th className="px-6 py-3 text-left font-medium">Resource</th>
                <th className="px-6 py-3 text-left font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-gray-100 align-top">
                  <td className="px-6 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {formatDate(e.performedAt, true)}
                  </td>
                  <td className="px-6 py-3 font-mono text-xs text-gray-900 whitespace-nowrap">
                    {e.action}
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-700 break-all max-w-xs">
                    {e.resource ?? "—"}
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-500 font-mono break-all max-w-md">
                    {e.detail ? JSON.stringify(e.detail) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
