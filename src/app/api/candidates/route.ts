import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma, parseJson } from "@/lib/db";
import { extractText, parseResume, emptyProfile } from "@/lib/resume";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

/**
 * 建立候選人並解析履歷（對應規劃文件第三章）
 * 接收 multipart/form-data：name, email, jobId, resume(檔案)
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const jobId = String(form.get("jobId") ?? "").trim();
  const file = form.get("resume");

  if (!name || !email || !jobId) {
    return NextResponse.json({ error: "姓名、Email、職缺為必填" }, { status: 400 });
  }

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "找不到職缺" }, { status: 404 });

  const candidate = await prisma.candidate.create({
    data: { name, email, jobId, profile: JSON.stringify(emptyProfile) },
  });

  // 沒有附履歷就先建立資料，之後可再補上傳
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(candidate, { status: 201 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await mkdir(UPLOAD_DIR, { recursive: true });
    const safeName = `${candidate.id}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    await writeFile(path.join(UPLOAD_DIR, safeName), buffer);

    const resumeText = await extractText(buffer, file.name);
    const profile = await parseResume(resumeText, job.title);

    const updated = await prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        resumeFile: safeName,
        resumeText,
        profile: JSON.stringify(profile),
        parseStatus: "parsed",
      },
    });

    return NextResponse.json(updated, { status: 201 });
  } catch (err) {
    await prisma.candidate.update({
      where: { id: candidate.id },
      data: { parseStatus: "failed" },
    });
    return NextResponse.json(
      {
        ...candidate,
        parseStatus: "failed",
        warning: err instanceof Error ? err.message : "履歷解析失敗",
      },
      { status: 201 }
    );
  }
}

export async function GET(req: Request) {
  const jobId = new URL(req.url).searchParams.get("jobId");
  const candidates = await prisma.candidate.findMany({
    where: jobId ? { jobId } : undefined,
    orderBy: { createdAt: "desc" },
    include: { job: { select: { title: true } }, interviews: true },
  });
  return NextResponse.json(
    candidates.map((c) => ({ ...c, profile: parseJson(c.profile, emptyProfile) }))
  );
}
