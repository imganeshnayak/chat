import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

export default function BackendStatus() {
  const [status, setStatus] = useState<string>("Checking...");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    apiFetch<{ status: string; timestamp: string }>("/api/health")
      .then((data) => setStatus(`${data.status} (${new Date(data.timestamp).toLocaleTimeString()})`))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="p-4 text-sm">
      <strong>Backend status:</strong>{" "}
      {error ? <span className="text-red-500">{error}</span> : <span className="text-green-500">{status}</span>}
    </div>
  );
}
