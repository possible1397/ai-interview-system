import { NextResponse } from "next/server";
import { prisma, parseJson } from "@/lib/db";
import { emptyReport, type CandidateReport } from "@/lib/report";

type Params = { params: { id: string } };

const VALID_STATUS = ["pending", "proceed", "hold", "follow_up", "not_suitable"];

export async function GET(_req: Request, { params }: Params) {
  const report = await prisma.report.findUnique({
    where: { id: params.id },
    include: {
      interview: {
        include: {
          candidate: { include: { job: true } },
          transcript: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!report) return NextResponse.json({ error: "找不到報告" }, { status: 404 });

  return NextResponse.json({
    ...report,
    content: parseJson<CandidateReport>(report.content, emptyReport),
  });
}

/** Recruiter 審核：標記狀態與備註（對應規劃文件第十二章） */
export async function PATCH(req: Request, { params }: Params) {
  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.recruiterStatus) {
    if (!VALID_STATUS.includes(body.recruiterStatus)) {
      return NextResponse.json({ error: "狀態值不合法" }, { status: 400 });
    }
    data.recruiterStatus = body.recruiterStatus;
    data.reviewedAt = new Date();
  }
  if ("recruiterNote" in body) data.recruiterNote = body.recruiterNote || null;
  if (body.content) data.content = JSON.stringify(body.content);

  const report = await prisma.report.update({ where: { id: params.id }, data });

  return NextResponse.json({
    ...report,
    content: parseJson<CandidateReport>(report.content, emptyReport),
  });
}
