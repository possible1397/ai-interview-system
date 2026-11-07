import { NextResponse } from "next/server";
import { prisma, parseJson } from "@/lib/db";
import { emptyProfile, parseResume, type CandidateProfile } from "@/lib/resume";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: { job: true, interviews: { include: { report: true } } },
  });
  if (!candidate) return NextResponse.json({ error: "找不到候選人" }, { status: 404 });

  return NextResponse.json({
    ...candidate,
    profile: parseJson<CandidateProfile>(candidate.profile, emptyProfile),
  });
}

/** Recruiter 修正解析結果並確認（第三章：發送前先確認資料是否正確） */
export async function PATCH(req: Request, { params }: Params) {
  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.name) data.name = String(body.name).trim();
  if (body.email) data.email = String(body.email).trim();
  if (body.profile) data.profile = JSON.stringify(body.profile);
  if (body.parseStatus) data.parseStatus = String(body.parseStatus);

  const candidate = await prisma.candidate.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json({
    ...candidate,
    profile: parseJson<CandidateProfile>(candidate.profile, emptyProfile),
  });
}

/** 重新解析履歷 */
export async function POST(_req: Request, { params }: Params) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: { job: true },
  });
  if (!candidate) return NextResponse.json({ error: "找不到候選人" }, { status: 404 });
  if (!candidate.resumeText) {
    return NextResponse.json({ error: "此候選人尚未上傳履歷" }, { status: 400 });
  }

  try {
    const profile = await parseResume(candidate.resumeText, candidate.job.title);
    const updated = await prisma.candidate.update({
      where: { id: candidate.id },
      data: { profile: JSON.stringify(profile), parseStatus: "parsed" },
    });
    return NextResponse.json({ ...updated, profile });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "解析失敗" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  await prisma.candidate.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
