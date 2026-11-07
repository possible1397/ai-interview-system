"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const OPTIONS = [
  { value: "proceed", label: "Proceed", hint: "可推薦，進入下一階段" },
  { value: "hold", label: "Hold", hint: "暫時保留" },
  { value: "follow_up", label: "Need Follow-up", hint: "需人工補問" },
  { value: "not_suitable", label: "Not Suitable", hint: "不適合此職缺" },
];

export default function ReviewActions({
  reportId,
  status,
  note,
}: {
  reportId: string;
  status: string;
  note: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [text, setText] = useState(note);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(nextStatus: string) {
    setBusy(true);
    setSaved(false);
    const res = await fetch(`/api/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recruiterStatus: nextStatus, recruiterNote: text }),
    });
    setBusy(false);
    if (res.ok) {
      setCurrent(nextStatus);
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <div className="card">
      <div className="card-title">Recruiter 審核</div>
      <p className="small muted" style={{ marginTop: -6 }}>
        請先對照逐字稿確認 AI 摘要是否正確、是否有回答矛盾或重要資訊遺漏，再標記狀態。
      </p>

      {saved && <div className="notice info">已儲存審核結果。</div>}

      <label>審核備註</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="例如：技術經驗符合，但需再確認英文會議能力"
      />

      <div className="btn-row">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            className={current === o.value ? "" : "ghost"}
            onClick={() => save(o.value)}
            disabled={busy}
            title={o.hint}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="small muted" style={{ marginTop: 8 }}>
        目前狀態：{OPTIONS.find((o) => o.value === current)?.label ?? "待審核"}
      </div>
    </div>
  );
}
