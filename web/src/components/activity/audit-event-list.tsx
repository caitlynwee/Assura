"use client";

import { useAuditLog } from "@/hooks/use-audit-log";
import { formatDate } from "@/lib/utils";
import Spinner from "@/components/ui/spinner";

export default function AuditEventList() {
  const { entries, loading, error } = useAuditLog();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <p className="text-red-600 text-sm">{error}</p>;
  }

  if (!entries.length) {
    return (
      <div className="bg-white border rounded-xl p-8 text-center text-gray-400 text-sm">
        No activity recorded yet.
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <th className="px-4 py-3 text-left">Time</th>
            <th className="px-4 py-3 text-left">Actor</th>
            <th className="px-4 py-3 text-left">Action</th>
            <th className="px-4 py-3 text-left font-mono">Hash (prev→)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map((entry, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-4 py-2 text-gray-500 text-xs whitespace-nowrap">
                {formatDate(entry.timestamp)}
              </td>
              <td className="px-4 py-2 text-gray-700 font-mono text-xs">
                {entry.actor.slice(0, 12)}
              </td>
              <td className="px-4 py-2 text-gray-800">{entry.action}</td>
              <td className="px-4 py-2 font-mono text-xs text-gray-400">
                {entry.hash.slice(0, 8)}…
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
