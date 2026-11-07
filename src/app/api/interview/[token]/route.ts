import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendScheduleConfirmation } from "@/lib/mail";

type Params = { params: { token: string } };

/** 候選人端讀取面試基本資訊 */
export async function GET(_req: Request, { params }: Params) {
  const interview = await prisma.interview.findUnique({
    where: { token: params.token },
    include: { candidate: { include: { job: true } }, transcript: true },
  });
  if (!interview) return NextResponse.json({ error: "連結無效" }, { status: 404 });

  return NextResponse.json({
    status: interview.status,
    stage: interview.stage,
    scheduledAt: interview.scheduledAt,
    consentAt: interview.consentAt,
    candidateName: interview.candidate.name,
    jobTitle: interview.candidate.job.title,
    transcript: interview.transcript.map((t) => ({
      role: t.role,
      text: t.text,
      stage: t.stage,
    })),
  });
}

/**
 * 候選人操作：預約時段、同意告知、標記未出席
 * （對應規劃文件第六、七、十六章）
 */
export async function POST(req: Request, { params }: Params) {
  const body = await req.json();
  const action = String(body.action ?? "");

  const interview = await prisma.interview.findUnique({
    where: { token: params.token },
    include: { candidate: { include: { job: true } } },
  });
  if (!interview) return NextResponse.json({ error: "連結無效" }, { status: 404 });

  if (action === "schedule") {
    const scheduledAt = new Date(body.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ error: "時間格式錯誤" }, { status: 400 });
    }

    const updated = await prisma.interview.update({
      where: { id: interview.id },
      data: { scheduledAt, status: "scheduled" },
    });

    const mail = await sendScheduleConfirmation({
      to: interview.candidate.email,
      candidateName: interview.candidate.name,
      jobTitle: interview.candidate.job.title,
      token: interview.token,
      scheduledAt,
    });

    return NextResponse.json({ interview: updated, mail });
  }

  if (action === "consent") {
    const updated = await prisma.interview.update({
      where: { id: interview.id },
      data: {
        consentAt: new Date(),
        recordingOptOut: Boolean(body.recordingOptOut),
      },
    });
    return NextResponse.json({ interview: updated });
  }

  if (action === "no_show") {
    const updated = await prisma.interview.update({
      where: { id: interview.id },
      data: { status: "no_show" },
    });
    return NextResponse.json({ interview: updated });
  }

  return NextResponse.json({ error: "未知的操作" }, { status: 400 });
}
