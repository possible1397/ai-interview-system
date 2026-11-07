import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkLLM } from "@/lib/llm";

/** 系統健康檢查：確認資料庫與本地模型是否就緒 */
export async function GET() {
  const llm = await checkLLM();

  let db = { ok: true, message: "資料庫連線正常" };
  try {
    await prisma.job.count();
  } catch (err) {
    db = {
      ok: false,
      message: `資料庫連線失敗：${err instanceof Error ? err.message : "未知錯誤"}。請執行 npm run db:push`,
    };
  }

  const smtp = process.env.SMTP_HOST
    ? { ok: true, message: `已設定 SMTP：${process.env.SMTP_HOST}` }
    : { ok: false, message: "未設定 SMTP，信件會輸出到終端機（開發模式）" };

  return NextResponse.json({ ok: db.ok && llm.ok, db, llm, smtp });
}
