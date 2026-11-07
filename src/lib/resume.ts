/**
 * 履歷解析（對應規劃文件第三章）
 *
 * 兩段式：先把 PDF / Word 轉成純文字，再交給本地 LLM 萃取結構化欄位。
 * 解析結果一律需要 Recruiter 確認後才視為可用。
 */

import { chatJson } from "./llm";

export type CandidateProfile = {
  currentCompany: string;
  currentTitle: string;
  totalYears: string;
  relevantYears: string;
  skills: string[];
  experiences: { company: string; title: string; period: string; summary: string }[];
  education: string;
  languages: string[];
  projects: string[];
};

export const emptyProfile: CandidateProfile = {
  currentCompany: "",
  currentTitle: "",
  totalYears: "",
  relevantYears: "",
  skills: [],
  experiences: [],
  education: "",
  languages: [],
  projects: [],
};

/** 從上傳檔案取出純文字 */
export async function extractText(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  if (ext === "pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    return result.text.trim();
  }

  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }

  if (ext === "txt" || ext === "md") {
    return buffer.toString("utf-8").trim();
  }

  throw new Error(`不支援的履歷格式：.${ext}（請提供 PDF、DOCX 或 TXT）`);
}

/** 交由本地 LLM 萃取結構化履歷欄位 */
export async function parseResume(
  resumeText: string,
  jobTitle: string
): Promise<CandidateProfile> {
  const system = [
    "你是招募顧問的履歷解析助理。",
    "請從履歷純文字中萃取結構化資訊，只輸出 JSON，不要加任何說明文字。",
    "找不到的欄位請填空字串或空陣列，不要臆測、不要編造內容。",
    "年資請以數字加單位表示，例如「3 年」。",
  ].join("\n");

  const user = [
    `本次應徵職缺：${jobTitle}`,
    "",
    "請依照下列 JSON 結構輸出：",
    JSON.stringify(
      {
        currentCompany: "目前公司",
        currentTitle: "目前職稱",
        totalYears: "總工作年資",
        relevantYears: "與本職缺相關的年資",
        skills: ["技術能力關鍵字"],
        experiences: [
          { company: "公司", title: "職稱", period: "期間", summary: "工作內容摘要" },
        ],
        education: "最高學歷",
        languages: ["語言能力"],
        projects: ["專案經驗摘要"],
      },
      null,
      2
    ),
    "",
    "履歷內容：",
    "---",
    resumeText.slice(0, 12000),
    "---",
  ].join("\n");

  const parsed = await chatJson<Partial<CandidateProfile>>([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);

  // 正規化：確保欄位型別一致，避免小模型輸出格式漂移
  return {
    currentCompany: str(parsed.currentCompany),
    currentTitle: str(parsed.currentTitle),
    totalYears: str(parsed.totalYears),
    relevantYears: str(parsed.relevantYears),
    skills: arr(parsed.skills),
    experiences: Array.isArray(parsed.experiences)
      ? parsed.experiences.slice(0, 20).map((e) => ({
          company: str(e?.company),
          title: str(e?.title),
          period: str(e?.period),
          summary: str(e?.summary),
        }))
      : [],
    education: str(parsed.education),
    languages: arr(parsed.languages),
    projects: arr(parsed.projects),
  };
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v);
}

function arr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(str).filter(Boolean).slice(0, 40);
}
