"use client";

import { useState, useEffect } from "react";

interface ConnectorInfo {
  name: string;
  enabled: boolean;
}

export default function AdminPage() {
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
  const [missingKeys, setMissingKeys] = useState<string[]>([]);
  const [seedResult, setSeedResult] = useState<string>("");
  const [syncResult, setSyncResult] = useState<string>("");
  const [searchRaw, setSearchRaw] = useState<string>("");
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/debug/connectors")
      .then((r) => r.json())
      .then((data) => {
        setConnectors(data.connectors || []);
        setMissingKeys(data.missingKeys || []);
      })
      .catch(() => {});
  }, []);

  async function runSeed() {
    setLoading((p) => ({ ...p, seed: true }));
    try {
      const res = await fetch("/api/debug/seed", { method: "POST" });
      const data = await res.json();
      setSeedResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setSeedResult("Error: " + String(e));
    }
    setLoading((p) => ({ ...p, seed: false }));
  }

  async function runSync() {
    setLoading((p) => ({ ...p, sync: true }));
    try {
      const res = await fetch("/api/debug/sync-test", { method: "POST" });
      const data = await res.json();
      setSyncResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setSyncResult("Error: " + String(e));
    }
    setLoading((p) => ({ ...p, sync: false }));
  }

  async function runTestSearch() {
    setLoading((p) => ({ ...p, search: true }));
    try {
      const res = await fetch(
        "/api/search?query=Ohio+State+flag&zip=43040&radius=25"
      );
      const data = await res.json();
      setSearchRaw(JSON.stringify(data, null, 2));
    } catch (e) {
      setSearchRaw("Error: " + String(e));
    }
    setLoading((p) => ({ ...p, search: false }));
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 text-sm">
      <a href="/" className="text-blue-600 underline">
        Back to search
      </a>
      <h1 className="text-xl font-bold mt-3 mb-4">Admin / Debug</h1>

      <section className="mb-6">
        <h2 className="font-medium text-lg mb-2">Connectors</h2>
        <table className="w-full text-left border">
          <thead>
            <tr className="bg-gray-50">
              <th className="border px-2 py-1">Connector</th>
              <th className="border px-2 py-1">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {connectors.map((c) => (
              <tr key={c.name}>
                <td className="border px-2 py-1 font-mono text-xs">
                  {c.name}
                </td>
                <td className="border px-2 py-1">
                  {c.enabled ? "Yes" : "No"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {missingKeys.length > 0 && (
        <section className="mb-6">
          <h2 className="font-medium text-lg mb-2">Missing API Keys</h2>
          <ul className="list-disc ml-5 font-mono text-xs">
            {missingKeys.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-6 space-y-3">
        <h2 className="font-medium text-lg mb-2">Actions</h2>

        <div>
          <button
            onClick={runSeed}
            disabled={loading.seed}
            className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
          >
            {loading.seed ? "Running..." : "Run Seed Import"}
          </button>
          {seedResult && (
            <pre className="mt-2 bg-gray-50 border rounded p-2 text-xs overflow-auto max-h-40">
              {seedResult}
            </pre>
          )}
        </div>

        <div>
          <button
            onClick={runSync}
            disabled={loading.sync}
            className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
          >
            {loading.sync ? "Running..." : "Run Connector Sync Test"}
          </button>
          {syncResult && (
            <pre className="mt-2 bg-gray-50 border rounded p-2 text-xs overflow-auto max-h-40">
              {syncResult}
            </pre>
          )}
        </div>

        <div>
          <button
            onClick={runTestSearch}
            disabled={loading.search}
            className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
          >
            {loading.search
              ? "Running..."
              : 'Test Search: "Ohio State flag" @ 43040'}
          </button>
          {searchRaw && (
            <pre className="mt-2 bg-gray-50 border rounded p-2 text-xs overflow-auto max-h-96">
              {searchRaw}
            </pre>
          )}
        </div>
      </section>
    </div>
  );
}
