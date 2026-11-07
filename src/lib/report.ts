/**
 * 候選人面談報告生成（對應規劃文件第十一章）
 *
 * 由逐字稿摘要而成。為降低 LLM 幻覺風險，報告的每個重點都要求模型
 * 附上逐字稿中的原句依據（evidence），Recruiter 可據此快速覆核。
 */

import { chatJson } from "./llm";
import type { CandidateProfile } from "./resume";
import type { Turn } from "./interview-engine";

export type ReportItem = { point: string; evidence: string };

export type CandidateReport = {
  basics: {
    name: string;
    currentCompany: string;
    currentTitle: string;
    totalYears: string;
    relevantYears: string;
    education: string;
    languages: string;
  };
  experienceSummary: string;
  skills: string[];
  proficiency: { skill: string; level: string }[];
  achievements: ReportItem[];
  conditions: {
    currentSalary: string;
    expectedSalary: string;
    noticePeriod: string;
    location: string;
    shift: string;
    travel: string;
  };
  highlights: ReportItem[];
  concerns: ReportItem[];
  unconfirmed: string[];
  candidateQuestions: string[];
};

export const emptyReport: CandidateReport = {
  basics: {
    name: "",
    currentCompany: "",
    currentTitle: "",
    totalYears: "",
    relevantYears: "",
    education: "",
    languages: "",
  },
  experienceSummary: "",
  skills: [],
  proficiency: [],
  achievements: [],
  conditions: {
    currentSalary: "",
    expectedSalary: "",
    noticePeriod: "",
    location: "",
    shift: "",
    travel: "",
  },
  highlights: [],
  concerns: [],
  unconfirmed: [],
  candidateQuestions: [],
};

export async function generateReport(params: {
  candidateName: string;
  jobTitle: string;
  profile: CandidateProfile;
  transcript: Turn[];
  engineUnconfirmed: string[];
}): Promise<CandidateReport> {
  const { candidateName, jobTitle, profile, transcript, engineUnconfirmed } = params;

  const system = [
    "你是資深招募顧問，負責把 AI 初步訪談的逐字稿整理成給 Recruiter 看的面談報告。",
    "",
    "鐵則：",
    "1. 只根據逐字稿與履歷寫，絕對不要推測或補充沒有出現過的內容。",
    "2. 每個亮點、疑慮、成果都必須附上逐字稿中的原句作為 evidence；找不到原句就不要寫這一項。",
    "3. 候選人沒提到或回答模糊的項目，一律放進 unconfirmed，不要猜。",
    "4. 熟悉程度只能用「可獨立」「熟悉」「有經驗」「經驗有限」「未提及」這幾種描述。",
    "5. 不要給錄取建議，不要替 Recruiter 下判斷。",
    "只輸出 JSON，不要加任何說明文字。",
  ].join("\n");

  const transcriptText = transcript
    .map((t) => `${t.role === "ai" ? "AI" : "候選人"}：${t.text}`)
    .join("\n");

  const user = [
    `應徵職缺：${jobTitle}`,
    `候選人：${candidateName}`,
    "",
    "【履歷解析結果】",
    `目前公司：${profile.currentCompany}／目前職稱：${profile.currentTitle}`,
    `總年資：${profile.totalYears}／相關年資：${profile.relevantYears}`,
    `學歷：${profile.education}／語言：${profile.languages.join("、")}`,
    `技術能力：${profile.skills.join("、")}`,
    "",
    "【面試逐字稿】",
    transcriptText.slice(0, 20000),
    "",
    "請依下列 JSON 結構輸出報告：",
    JSON.stringify(
      {
        basics: {
          name: "",
          currentCompany: "",
          currentTitle: "",
          totalYears: "",
          relevantYears: "",
          education: "",
          languages: "",
        },
        experienceSummary: "工作經驗摘要，三到五句",
        skills: ["技術關鍵字"],
        proficiency: [{ skill: "能力項目", level: "可獨立／熟悉／有經驗／經驗有限／未提及" }],
        achievements: [{ point: "具體成果", evidence: "逐字稿原句" }],
        conditions: {
          currentSalary: "",
          expectedSalary: "",
          noticePeriod: "",
          location: "",
          shift: "",
          travel: "",
        },
        highlights: [{ point: "亮點", evidence: "逐字稿原句" }],
        concerns: [{ point: "疑慮", evidence: "逐字稿原句" }],
        unconfirmed: ["尚未確認的資訊"],
        candidateQuestions: ["候選人提出、需 Recruiter 回覆的問題"],
      },
      null,
      2
    ),
  ].join("\n");

  const parsed = await chatJson<Partial<CandidateReport>>(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { timeoutMs: 180_000 }
  );

  const merged: CandidateReport = {
    basics: {
      name: str(parsed.basics?.name) || candidateName,
      currentCompany: str(parsed.basics?.currentCompany) || profile.currentCompany,
      currentTitle: str(parsed.basics?.currentTitle) || profile.currentTitle,
      totalYears: str(parsed.basics?.totalYears) || profile.totalYears,
      relevantYears: str(parsed.basics?.relevantYears) || profile.relevantYears,
      education: str(parsed.basics?.education) || profile.education,
      languages: str(parsed.basics?.languages) || profile.languages.join("、"),
    },
    experienceSummary: str(parsed.experienceSummary),
    skills: arr(parsed.skills),
    proficiency: Array.isArray(parsed.proficiency)
      ? parsed.proficiency
          .slice(0, 20)
          .map((p) => ({ skill: str(p?.skill), level: str(p?.level) }))
          .filter((p) => p.skill)
      : [],
    achievements: items(parsed.achievements),
    conditions: {
      currentSalary: str(parsed.conditions?.currentSalary),
      expectedSalary: str(parsed.conditions?.expectedSalary),
      noticePeriod: str(parsed.conditions?.noticePeriod),
      location: str(parsed.conditions?.location),
      shift: str(parsed.conditions?.shift),
      travel: str(parsed.conditions?.travel),
    },
    highlights: items(parsed.highlights),
    concerns: items(parsed.concerns),
    unconfirmed: arr(parsed.unconfirmed),
    candidateQuestions: arr(parsed.candidateQuestions),
  };

  // 併入對話過程中引擎已標記的未確認項目，去重
  merged.unconfirmed = Array.from(
    new Set([...merged.unconfirmed, ...engineUnconfirmed.map(str)])
  ).filter(Boolean);

  return merged;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v);
}

function arr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(str).filter(Boolean).slice(0, 30);
}

function items(v: unknown): ReportItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, 15)
    .map((i) => ({ point: str((i as ReportItem)?.point), evidence: str((i as ReportItem)?.evidence) }))
    .filter((i) => i.point);
}
