/**
 * 面試題目生成（對應規劃文件第四章）
 *
 * 同時讀取職缺內容、候選人履歷與 Recruiter 設定的面試重點，
 * 產出「該名候選人專屬」的面試大綱。每位候選人的題目不會相同。
 */

import { chatJson } from "./llm";
import type { CandidateProfile } from "./resume";

export type InterviewOutline = {
  /** 本場面試整體要確認的重點 */
  objectives: string[];
  /** 基本條件確認題（第九章第二階段） */
  basicQuestions: string[];
  /** 履歷確認題（第三階段） */
  resumeQuestions: string[];
  /** 技術追問方向（第四階段），每項含主問題與可深入的追問點 */
  technicalProbes: { topic: string; opening: string; followUps: string[] }[];
  /** 工作成果確認（第五階段） */
  achievementQuestions: string[];
  /** 英文確認題（第六階段），若職缺不需英文則為空陣列 */
  englishQuestions: string[];
  /** 面試前已知的疑點，需在面試中釐清 */
  flags: string[];
};

export const emptyOutline: InterviewOutline = {
  objectives: [],
  basicQuestions: [],
  resumeQuestions: [],
  technicalProbes: [],
  achievementQuestions: [],
  englishQuestions: [],
  flags: [],
};

export type JobForOutline = {
  title: string;
  location?: string | null;
  description?: string | null;
  mustHave?: string | null;
  niceToHave?: string | null;
  yearsRequired?: string | null;
  languageReq?: string | null;
  shift?: string | null;
  salaryRange?: string | null;
  focusPoints: string[];
};

export async function generateOutline(
  job: JobForOutline,
  profile: CandidateProfile
): Promise<InterviewOutline> {
  const system = [
    "你是資深招募顧問，負責設計初步電話訪談的題目大綱。",
    "面試由 AI 語音進行，全長 15 至 20 分鐘，因此題目要精準、可在時間內問完。",
    "設計原則：",
    "1. 題目必須針對這位候選人的實際經歷，不要出通用題。",
    "2. 技術題要能驗證履歷內容真偽，追問要能挖出具體做法與數據。",
    "3. 不要問候選人無法回答的假設題，也不要問與職缺無關的私人問題。",
    "4. 若履歷與職缺條件有落差或矛盾，列入 flags 供面試中釐清。",
    "只輸出 JSON，不要加任何說明文字。",
  ].join("\n");

  const user = [
    "【職缺資訊】",
    `職稱：${job.title}`,
    `地點：${job.location ?? "未指定"}`,
    `工作內容：${job.description ?? "未提供"}`,
    `必要條件：${job.mustHave ?? "未提供"}`,
    `加分條件：${job.niceToHave ?? "未提供"}`,
    `年資要求：${job.yearsRequired ?? "未指定"}`,
    `語言要求：${job.languageReq ?? "未指定"}`,
    `輪班條件：${job.shift ?? "未指定"}`,
    `薪資範圍：${job.salaryRange ?? "未指定"}`,
    `Recruiter 特別要確認：${job.focusPoints.join("、") || "未指定"}`,
    "",
    "【候選人履歷摘要】",
    `目前公司：${profile.currentCompany || "未知"}`,
    `目前職稱：${profile.currentTitle || "未知"}`,
    `總年資：${profile.totalYears || "未知"}／相關年資：${profile.relevantYears || "未知"}`,
    `技術能力：${profile.skills.join("、") || "未提供"}`,
    `學歷：${profile.education || "未提供"}`,
    `語言：${profile.languages.join("、") || "未提供"}`,
    "工作經歷：",
    ...profile.experiences.map(
      (e) => `  - ${e.company}／${e.title}／${e.period}：${e.summary}`
    ),
    `專案經驗：${profile.projects.join("；") || "未提供"}`,
    "",
    "請依下列 JSON 結構輸出面試大綱：",
    JSON.stringify(
      {
        objectives: ["本場面試要確認的重點，3 至 5 項"],
        basicQuestions: ["基本條件確認題，4 至 6 題"],
        resumeQuestions: ["針對履歷內容的確認題，3 至 5 題"],
        technicalProbes: [
          {
            topic: "技術主題",
            opening: "開場問題",
            followUps: ["可深入的追問點，2 至 4 項"],
          },
        ],
        achievementQuestions: ["要求具體成果與數據的問題，2 至 4 題"],
        englishQuestions: ["英文題目，若職缺不需英文則給空陣列"],
        flags: ["履歷與職缺的落差或疑點"],
      },
      null,
      2
    ),
  ].join("\n");

  const parsed = await chatJson<Partial<InterviewOutline>>([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);

  return {
    objectives: arr(parsed.objectives),
    basicQuestions: arr(parsed.basicQuestions),
    resumeQuestions: arr(parsed.resumeQuestions),
    technicalProbes: Array.isArray(parsed.technicalProbes)
      ? parsed.technicalProbes.slice(0, 8).map((t) => ({
          topic: str(t?.topic),
          opening: str(t?.opening),
          followUps: arr(t?.followUps),
        }))
      : [],
    achievementQuestions: arr(parsed.achievementQuestions),
    englishQuestions: arr(parsed.englishQuestions),
    flags: arr(parsed.flags),
  };
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v);
}

function arr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(str).filter(Boolean).slice(0, 12);
}
