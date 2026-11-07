/**
 * 面試對話引擎（對應規劃文件第九章的九個階段）
 *
 * 設計重點：這一層只負責「決定 AI 下一句要說什麼」，不涉及語音。
 * 目前以文字問答驅動，步驟二導入 STT／TTS 時，只需把輸入輸出換成語音，
 * 對話邏輯與追問規則完全不用重寫——這是把最高風險的部分提前驗證的做法。
 */

import { chatJson } from "./llm";
import type { InterviewOutline } from "./questions";

export const STAGES = [
  "opening",
  "basic",
  "resume",
  "technical",
  "achievement",
  "english",
  "conditions",
  "candidate_questions",
  "closing",
  "done",
] as const;

export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  opening: "開場說明",
  basic: "基本資料確認",
  resume: "履歷內容確認",
  technical: "技術經驗追問",
  achievement: "工作成果確認",
  english: "英文確認",
  conditions: "條件再次確認",
  candidate_questions: "候選人提問",
  closing: "結束面試",
  done: "已完成",
};

/** 各階段給模型的任務指示 */
const STAGE_INSTRUCTIONS: Record<Stage, string> = {
  opening:
    "簡短自我介紹：說明你是本次初步訪談的 AI 面試助理、全程約 15 分鐘、會了解對方的工作經驗與求職考量，接著確認對方是否準備好開始。只需一段話，不要問專業問題。",
  basic:
    "確認基本條件：目前職務與公司、工作地點、求職原因、期望薪資、可到職時間、是否接受輪班與工作地點、是否有其他面試或 Offer。一次只問一到兩項，問完即進入下一階段。",
  resume:
    "根據履歷逐段確認，確認口述內容與履歷是否一致。若履歷資訊不清楚，請對方補充。",
  technical:
    "這是本場面試最重要的部分。依候選人的回答動態追問，挖出具體做法：異常現象是什麼、如何判斷、做了哪些檢查、Root Cause 為何、如何改善、如何避免再發生。不要照稿念題目。",
  achievement:
    "要求具體成果與數據。若對方只回答「有改善」，追問改善前後差異、實際數據、本人負責的部分、團隊與個人貢獻的區分。",
  english:
    "若大綱中有英文題目，請改用英文提問一至兩題工作相關問題；若沒有英文題目，直接結束本階段。",
  conditions:
    "面試結束前再次確認：期望薪資、到職時間、工作地點、輪班意願、出差意願、離職原因、求職動機。只補問先前尚未確認或答覆模糊的項目。",
  candidate_questions:
    "詢問對方是否有希望 Recruiter 後續協助確認的問題。記錄問題即可，絕對不要代替公司承諾薪資、福利或錄取結果。",
  closing:
    "感謝對方完成訪談，說明 Recruitment Consultant 將查看本次面談內容，如有下一階段安排會再聯繫。不要透露評價或錄取機會。",
  done: "面試已結束，不應再產生任何問題。",
};

/** 各階段最多幾組問答，用來控制 15-20 分鐘的總長度 */
const STAGE_TURN_BUDGET: Record<Stage, number> = {
  opening: 1,
  basic: 5,
  resume: 4,
  technical: 8,
  achievement: 4,
  english: 3,
  conditions: 3,
  candidate_questions: 2,
  closing: 1,
  done: 0,
};

export type Turn = { role: "ai" | "candidate"; text: string; stage?: string | null };

export type EngineResult = {
  /** AI 這一輪要說的話 */
  say: string;
  /** 進入的下一個階段 */
  nextStage: Stage;
  /** 本階段是否已完成 */
  stageComplete: boolean;
  /** 本輪判定為「無法確認」的資訊，會併入報告的未確認資訊 */
  unconfirmed: string[];
  /** 整場面試是否結束 */
  finished: boolean;
};

export function nextStageOf(stage: Stage): Stage {
  const i = STAGES.indexOf(stage);
  return i < 0 || i >= STAGES.length - 1 ? "done" : STAGES[i + 1];
}

/**
 * 產生 AI 的下一句話。
 *
 * @param stage    目前階段
 * @param outline  該候選人的專屬面試大綱
 * @param history  目前為止的逐字稿
 */
export async function nextTurn(
  stage: Stage,
  outline: InterviewOutline,
  history: Turn[]
): Promise<EngineResult> {
  if (stage === "done") {
    return {
      say: "",
      nextStage: "done",
      stageComplete: true,
      unconfirmed: [],
      finished: true,
    };
  }

  // 超出該階段的問答預算就強制進入下一階段，避免面試無限拉長
  const turnsInStage = history.filter((t) => t.role === "ai" && t.stage === stage).length;
  const overBudget = turnsInStage >= STAGE_TURN_BUDGET[stage];

  const system = [
    "你是進行初步電話訪談的 AI 面試助理，全程使用繁體中文（英文階段除外）。",
    "",
    "鐵則：",
    "1. 一次只問一個問題，問句要口語、簡短，適合用聽的。",
    "2. 同一件事最多追問兩次；仍無法確認就記入 unconfirmed 並往下走，不要反覆糾纏。",
    "3. 絕對不要承諾薪資、福利、面試結果或錄取機會。",
    "4. 不要評論候選人的表現，不要說「很好」「太棒了」這類評價。",
    "5. 不要編造候選人沒說過的內容。",
    "",
    `目前階段：${STAGE_LABELS[stage]}`,
    `階段任務：${STAGE_INSTRUCTIONS[stage]}`,
    overBudget
      ? "注意：本階段問答次數已達上限，請做一句簡短收尾並將 stageComplete 設為 true。"
      : "",
    "",
    "只輸出 JSON，格式如下：",
    '{"say":"你要說的話","stageComplete":true 或 false,"unconfirmed":["無法確認的資訊"]}',
  ]
    .filter(Boolean)
    .join("\n");

  const outlineBrief = buildOutlineBrief(stage, outline);
  const transcript = history
    .slice(-20)
    .map((t) => `${t.role === "ai" ? "AI" : "候選人"}：${t.text}`)
    .join("\n");

  const user = [
    "【本階段可用的題目大綱】",
    outlineBrief || "（無指定題目，依階段任務自行發問）",
    "",
    "【目前為止的對話】",
    transcript || "（尚未開始）",
    "",
    "請產生 AI 的下一句話。",
  ].join("\n");

  const parsed = await chatJson<{
    say?: string;
    stageComplete?: boolean;
    unconfirmed?: string[];
  }>(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { temperature: 0.4, timeoutMs: 60_000 }
  );

  const say = (parsed.say ?? "").trim() || "不好意思，可以請您再說明一次嗎？";
  const stageComplete = overBudget ? true : Boolean(parsed.stageComplete);
  const nextStage = stageComplete ? nextStageOf(stage) : stage;

  return {
    say,
    nextStage,
    stageComplete,
    unconfirmed: Array.isArray(parsed.unconfirmed)
      ? parsed.unconfirmed.filter((u) => typeof u === "string" && u.trim()).slice(0, 5)
      : [],
    finished: nextStage === "done",
  };
}

function buildOutlineBrief(stage: Stage, outline: InterviewOutline): string {
  switch (stage) {
    case "basic":
      return outline.basicQuestions.map((q) => `- ${q}`).join("\n");
    case "resume":
      return outline.resumeQuestions.map((q) => `- ${q}`).join("\n");
    case "technical":
      return outline.technicalProbes
        .map(
          (t) =>
            `- 主題：${t.topic}\n  開場：${t.opening}\n  可追問：${t.followUps.join("／")}`
        )
        .join("\n");
    case "achievement":
      return outline.achievementQuestions.map((q) => `- ${q}`).join("\n");
    case "english":
      return outline.englishQuestions.map((q) => `- ${q}`).join("\n");
    case "conditions":
      return outline.objectives.map((q) => `- 需確認：${q}`).join("\n");
    default:
      return "";
  }
}
