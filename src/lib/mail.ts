/**
 * Email 通知（對應規劃文件第五、六章）
 *
 * 走公司內部 SMTP。未設定 SMTP_HOST 時會改為輸出到終端機，
 * 讓開發階段不必依賴郵件伺服器也能測試整個流程。
 */

import nodemailer from "nodemailer";

const HOST = process.env.SMTP_HOST ?? "";
const PORT = Number(process.env.SMTP_PORT ?? 587);
const SECURE = process.env.SMTP_SECURE === "true";
const USER = process.env.SMTP_USER ?? "";
const PASS = process.env.SMTP_PASS ?? "";
const FROM = process.env.MAIL_FROM ?? "recruiting@example.com";
const FROM_NAME = process.env.MAIL_FROM_NAME ?? "招募團隊";
const BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";

export type MailResult = { delivered: boolean; note: string };

async function send(to: string, subject: string, text: string): Promise<MailResult> {
  if (!HOST) {
    console.log(
      ["", "──── [開發模式] 未設定 SMTP，信件內容如下 ────", `收件者：${to}`, `主旨：${subject}`, "", text, "────────────────────────────────────────", ""].join("\n")
    );
    return { delivered: false, note: "未設定 SMTP，信件內容已輸出到終端機" };
  }

  const transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: SECURE,
    auth: USER ? { user: USER, pass: PASS } : undefined,
  });

  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM}>`,
    to,
    subject,
    text,
  });

  return { delivered: true, note: `已寄送至 ${to}` };
}

/** 面試邀請信（第五章） */
export function sendInvitation(params: {
  to: string;
  candidateName: string;
  jobTitle: string;
  token: string;
  recordingEnabled?: boolean;
}): Promise<MailResult> {
  const { to, candidateName, jobTitle, token, recordingEnabled = true } = params;
  const link = `${BASE_URL}/interview/${token}`;

  const text = [
    `${candidateName} 您好，`,
    "",
    `感謝您應徵 ${jobTitle} 一職。`,
    "為了讓我們更了解您的工作經驗，想邀請您完成一段初步訪談。",
    "",
    "【訪談說明】",
    "・本次訪談由 AI 面試助理進行",
    "・預估時間 15 至 20 分鐘",
    "・可立即開始，或先預約方便的時段",
    "・請準備可正常使用的麥克風與穩定的網路",
    recordingEnabled
      ? "・訪談內容會轉為文字紀錄，僅供本次招募評估使用"
      : "・訪談內容僅保留文字紀錄，不會保存錄音",
    "・AI 不會直接決定錄取或淘汰，最終仍由招募顧問與用人主管判斷",
    "",
    "【開始訪談】",
    link,
    "",
    "若有任何問題，歡迎直接回覆本信。",
    "",
    FROM_NAME,
  ].join("\n");

  return send(to, `${jobTitle} — 初步訪談邀請`, text);
}

/** 預約完成確認信（第六章） */
export function sendScheduleConfirmation(params: {
  to: string;
  candidateName: string;
  jobTitle: string;
  token: string;
  scheduledAt: Date;
}): Promise<MailResult> {
  const { to, candidateName, jobTitle, token, scheduledAt } = params;
  const link = `${BASE_URL}/interview/${token}`;
  const when = scheduledAt.toLocaleString("zh-TW", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const text = [
    `${candidateName} 您好，`,
    "",
    `您的 ${jobTitle} 初步訪談已完成預約。`,
    "",
    `訪談時間：${when}`,
    `訪談連結：${link}`,
    "",
    "我們會在訪談前一天與前一小時再次提醒您。",
    "若需要更改時間，可直接透過上方連結重新選擇。",
    "",
    FROM_NAME,
  ].join("\n");

  return send(to, `${jobTitle} — 訪談預約確認`, text);
}

/** 面試提醒信（第六章） */
export function sendReminder(params: {
  to: string;
  candidateName: string;
  jobTitle: string;
  token: string;
  scheduledAt: Date;
  kind: "day_before" | "hour_before";
}): Promise<MailResult> {
  const { to, candidateName, jobTitle, token, scheduledAt, kind } = params;
  const link = `${BASE_URL}/interview/${token}`;
  const when = scheduledAt.toLocaleString("zh-TW", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const lead = kind === "day_before" ? "明天" : "一小時後";

  const text = [
    `${candidateName} 您好，`,
    "",
    `提醒您，${jobTitle} 的初步訪談將於${lead}進行。`,
    "",
    `訪談時間：${when}`,
    `訪談連結：${link}`,
    "",
    "開始前請確認麥克風與網路狀況。",
    "",
    FROM_NAME,
  ].join("\n");

  return send(to, `${jobTitle} — 訪談提醒`, text);
}
