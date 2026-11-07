"use client";

/**
 * 候選人面試頁（對應規劃文件第六至九章）
 *
 * 流程：選擇立即開始或預約 → 面試告知同意 → 設備測試 → 進行面試 → 完成
 *
 * 目前面試以文字問答進行。步驟二導入語音時：
 *   ・候選人輸入改為 STT 辨識結果
 *   ・AI 回覆送進 TTS 播放
 *   ・deviceCheck 改為實際的麥克風／喇叭偵測
 * 對話邏輯與後端 API 皆不需更動。
 */

import { useEffect, useRef, useState } from "react";

type Msg = { role: "ai" | "candidate"; text: string };
type Step = "choose" | "schedule" | "consent" | "device" | "interview" | "done";

export default function InterviewClient({
  token,
  candidateName,
  jobTitle,
  status,
  consented,
  scheduledAt,
  initialTranscript,
}: {
  token: string;
  candidateName: string;
  jobTitle: string;
  status: string;
  consented: boolean;
  scheduledAt: string | null;
  initialTranscript: Msg[];
}) {
  const [step, setStep] = useState<Step>(() => {
    if (status === "completed") return "done";
    if (initialTranscript.length > 0) return "interview";
    if (consented) return "device";
    return "choose";
  });

  const [messages, setMessages] = useState<Msg[]>(initialTranscript);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [optOut, setOptOut] = useState(false);
  const [when, setWhen] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function post(body: unknown, path = "") {
    const res = await fetch(`/api/interview/${token}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "操作失敗");
    return data;
  }

  async function schedule() {
    if (!when) return;
    setBusy(true);
    setError("");
    try {
      await post({ action: "schedule", scheduledAt: new Date(when).toISOString() });
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "預約失敗");
    }
    setBusy(false);
  }

  async function consent() {
    setBusy(true);
    setError("");
    try {
      await post({ action: "consent", recordingOptOut: optOut });
      setStep("device");
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失敗");
    }
    setBusy(false);
  }

  async function turn(text: string) {
    setBusy(true);
    setError("");
    try {
      const data = await post({ text }, "/turn");
      if (data.say) setMessages((m) => [...m, { role: "ai", text: data.say }]);
      if (data.finished) setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "系統忙碌，請稍後再試");
    }
    setBusy(false);
  }

  async function startInterview() {
    setStep("interview");
    await turn("");
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setMessages((m) => [...m, { role: "candidate", text }]);
    setInput("");
    await turn(text);
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1>{jobTitle} 初步訪談</h1>
      <p className="sub">{candidateName} 您好，感謝您撥空參與。</p>

      {error && <div className="notice error">{error}</div>}

      {step === "choose" && (
        <div className="card">
          <div className="card-title">選擇訪談方式</div>
          <p className="small">
            本次訪談由 AI 面試助理進行，約 15 至 20 分鐘。您可以現在開始，或先預約方便的時段。
          </p>
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button onClick={() => setStep("consent")}>立即開始訪談</button>
            <button className="ghost" onClick={() => setStep("schedule")}>
              預約其他時間
            </button>
          </div>
        </div>
      )}

      {step === "schedule" && (
        <div className="card">
          <div className="card-title">預約訪談時間</div>
          <label htmlFor="when">請選擇方便的日期與時間</label>
          <input
            id="when"
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
          <p className="small muted">
            預約完成後會寄送確認信，並在訪談前一天與前一小時提醒您。若需更改時間，可再回到此連結重新選擇。
          </p>
          <div className="btn-row">
            <button onClick={schedule} disabled={!when || busy}>
              {busy ? "處理中⋯" : "確認預約"}
            </button>
            <button className="ghost" onClick={() => setStep("choose")}>
              返回
            </button>
          </div>
        </div>
      )}

      {step === "consent" && (
        <div className="card">
          <div className="card-title">訪談前告知</div>
          <ul className="plain small">
            <li>本次訪談由 AI 面試助理進行，不是真人面試官。</li>
            <li>訪談內容會轉換成文字紀錄，僅供本次招募評估使用。</li>
            <li>資料保存期間依公司個資政策辦理，您可要求刪除。</li>
            <li>AI 不會直接決定錄取或淘汰，最終仍由招募顧問與用人主管判斷。</li>
            <li>訪談過程中若遇到問題，可隨時中止並改由專人與您聯繫。</li>
          </ul>

          <label style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={optOut}
              onChange={(e) => setOptOut(e.target.checked)}
              style={{ width: "auto", margin: 0 }}
            />
            <span style={{ fontWeight: 400, color: "var(--text)" }}>
              我不同意保留錄音，僅保留文字紀錄
            </span>
          </label>

          <div className="btn-row" style={{ marginTop: 12 }}>
            <button onClick={consent} disabled={busy}>
              {busy ? "處理中⋯" : "我了解並同意，繼續"}
            </button>
            <button className="ghost" onClick={() => setStep("choose")}>
              返回
            </button>
          </div>
        </div>
      )}

      {step === "device" && (
        <div className="card">
          <div className="card-title">開始前確認</div>
          <p className="small">
            本階段的訪談以文字進行，請確認您的網路連線穩定即可。
          </p>
          <div className="notice info">
            語音訪談功能將於下一階段開放。屆時這裡會加入麥克風、喇叭與瀏覽器相容性的自動檢測。
          </div>
          <div className="btn-row">
            <button onClick={startInterview} disabled={busy}>
              {busy ? "連線中⋯" : "開始訪談"}
            </button>
          </div>
        </div>
      )}

      {step === "interview" && (
        <div className="card">
          <div className="card-title">訪談進行中</div>
          <div className="chat" ref={chatRef}>
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role === "ai" ? "ai" : "me"}`}>
                {m.text}
              </div>
            ))}
            {busy && <div className="bubble ai muted">（思考中⋯）</div>}
          </div>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="請在此輸入您的回答，按 Enter 送出"
            disabled={busy}
          />
          <div className="btn-row">
            <button onClick={send} disabled={busy || !input.trim()}>
              送出回答
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="card">
          <div className="card-title">
            {scheduledAt && status === "scheduled" ? "預約完成" : "訪談完成"}
          </div>
          {scheduledAt && status === "scheduled" ? (
            <p className="small">
              您的訪談已預約於{" "}
              <strong>{new Date(scheduledAt).toLocaleString("zh-TW")}</strong>。
              確認信已寄出，屆時請透過同一個連結進入。
            </p>
          ) : (
            <p className="small">
              謝謝您完成本次訪談。Recruitment Consultant
              將查看本次面談內容，如有下一階段安排，會再與您聯繫。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
