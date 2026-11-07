"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CandidateActions({
  candidateId,
  parseStatus,
  hasInterview,
  interviewToken,
  interviewStatus,
}: {
  candidateId: string;
  parseStatus: string;
  hasInterview: boolean;
  interviewToken: string | null;
  interviewStatus: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ kind: string; text: string } | null>(null);

  async function call(action: string, url: string, method = "POST", body?: unknown) {
    setBusy(action);
    setMessage(null);
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    setBusy("");

    if (!res.ok) {
      setMessage({ kind: "error", text: data.error ?? "操作失敗" });
      return null;
    }
    router.refresh();
    return data;
  }

  async function confirmProfile() {
    const data = await call("confirm", `/api/candidates/${candidateId}`, "PATCH", {
      parseStatus: "confirmed",
    });
    if (data) setMessage({ kind: "info", text: "已確認履歷解析結果。" });
  }

  async function reparse() {
    const data = await call("reparse", `/api/candidates/${candidateId}`, "POST");
    if (data) setMessage({ kind: "info", text: "已重新解析履歷。" });
  }

  async function invite() {
    const data = await call("invite", `/api/candidates/${candidateId}/invite`);
    if (data) {
      setMessage({
        kind: data.mail?.delivered ? "info" : "warn",
        text: `面試大綱已生成。${data.mail?.note ?? ""}`,
      });
    }
  }

  const link = interviewToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/interview/${interviewToken}`
    : null;

  return (
    <div className="card">
      <div className="card-title">操作</div>
      {message && <div className={`notice ${message.kind}`}>{message.text}</div>}

      <div className="btn-row">
        <button className="ghost" onClick={reparse} disabled={Boolean(busy)}>
          {busy === "reparse" ? "解析中⋯" : "重新解析履歷"}
        </button>

        {parseStatus !== "confirmed" && (
          <button className="ghost" onClick={confirmProfile} disabled={Boolean(busy)}>
            確認解析結果正確
          </button>
        )}

        <button onClick={invite} disabled={Boolean(busy)}>
          {busy === "invite"
            ? "生成面試大綱中⋯"
            : hasInterview
              ? "重新生成大綱並再次邀請"
              : "生成大綱並發送面試邀請"}
        </button>
      </div>

      {link && (
        <div style={{ marginTop: 14 }}>
          <label>候選人面試連結（狀態：{interviewStatus}）</label>
          <div className="small">
            <a href={link} target="_blank" rel="noreferrer">
              {link}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
