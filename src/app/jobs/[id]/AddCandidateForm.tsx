"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AddCandidateForm({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: string; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);

    const formEl = e.currentTarget;
    const body = new FormData(formEl);
    body.set("jobId", jobId);

    const res = await fetch("/api/candidates", { method: "POST", body });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMessage({ kind: "error", text: data.error ?? "建立失敗" });
      setBusy(false);
      return;
    }

    setMessage(
      data.warning
        ? { kind: "warn", text: `候選人已建立，但履歷解析失敗：${data.warning}` }
        : { kind: "info", text: "候選人已建立，履歷解析完成。" }
    );
    formEl.reset();
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="card">
      <div className="card-title">加入候選人</div>
      <p className="small muted" style={{ marginTop: -6 }}>
        上傳履歷後，系統會用本地模型解析出結構化欄位，供你確認後再發送面試邀請。
      </p>

      {message && <div className={`notice ${message.kind}`}>{message.text}</div>}

      <form onSubmit={onSubmit}>
        <div className="grid2">
          <div>
            <label htmlFor="name">姓名 *</label>
            <input id="name" name="name" type="text" required />
          </div>
          <div>
            <label htmlFor="email">Email *</label>
            <input id="email" name="email" type="email" required />
          </div>
        </div>

        <label htmlFor="resume">履歷檔案（PDF / DOCX / TXT）</label>
        <input id="resume" name="resume" type="file" accept=".pdf,.docx,.txt,.md" />

        <div className="btn-row">
          <button type="submit" disabled={busy}>
            {busy ? "處理中⋯（履歷解析需要一點時間）" : "加入候選人"}
          </button>
        </div>
      </form>
    </div>
  );
}
