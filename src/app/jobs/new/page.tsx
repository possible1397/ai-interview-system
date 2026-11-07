"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewJobPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());

    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, status: "active" }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "建立失敗");
      setSaving(false);
      return;
    }

    const job = await res.json();
    router.push(`/jobs/${job.id}`);
  }

  return (
    <>
      <h1>建立職缺</h1>
      <p className="sub">
        職缺內容會直接影響 AI 面試的題目生成，填得越具體，面試問到的重點越準確。
      </p>

      {error && <div className="notice error">{error}</div>}

      <form onSubmit={onSubmit}>
        <div className="card">
          <div className="card-title">基本資訊</div>
          <label htmlFor="title">職缺名稱 *</label>
          <input id="title" name="title" type="text" required placeholder="半導體設備工程師" />

          <div className="grid2">
            <div>
              <label htmlFor="location">工作地點</label>
              <input id="location" name="location" type="text" placeholder="台南" />
            </div>
            <div>
              <label htmlFor="salaryRange">薪資範圍</label>
              <input id="salaryRange" name="salaryRange" type="text" placeholder="月薪 5 至 7 萬" />
            </div>
          </div>

          <label htmlFor="description">工作內容</label>
          <textarea id="description" name="description" placeholder="負責 CVD 設備的 PM、CM 與異常排除⋯⋯" />
        </div>

        <div className="card">
          <div className="card-title">條件要求</div>
          <label htmlFor="mustHave">必要條件</label>
          <textarea id="mustHave" name="mustHave" placeholder="三年以上半導體設備維護經驗" />

          <label htmlFor="niceToHave">加分條件</label>
          <textarea id="niceToHave" name="niceToHave" placeholder="具備裝機經驗、原廠溝通經驗" />

          <div className="grid2">
            <div>
              <label htmlFor="yearsRequired">年資要求</label>
              <input id="yearsRequired" name="yearsRequired" type="text" placeholder="3 年以上" />
            </div>
            <div>
              <label htmlFor="languageReq">語言要求</label>
              <input id="languageReq" name="languageReq" type="text" placeholder="英文可讀寫，會議溝通佳" />
            </div>
          </div>

          <label htmlFor="shift">輪班條件</label>
          <input id="shift" name="shift" type="text" placeholder="需配合 12 小時兩班制" />
        </div>

        <div className="card">
          <div className="card-title">AI 面試重點</div>
          <p className="small muted" style={{ marginTop: -4 }}>
            每行一項。這些是本次招募最需要確認的事，AI 面試會針對這些方向追問。
          </p>
          <textarea
            name="focusPoints"
            style={{ minHeight: 130 }}
            placeholder={"是否有半導體設備經驗\n負責過哪些設備品牌與機型\n是否具備 PM、CM 或 Troubleshooting 經驗\n是否可以接受輪班\n期望薪資與到職時間"}
          />
        </div>

        <div className="btn-row">
          <button type="submit" disabled={saving}>
            {saving ? "建立中⋯" : "建立職缺"}
          </button>
        </div>
      </form>
    </>
  );
}
