import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma, parseJson } from "@/lib/db";
import { emptyProfile, type CandidateProfile } from "@/lib/resume";
import { generateOutline } from "@/lib/questions";
import { sendInvitation } from "@/lib/mail";

type Params = { params: { id: string } };

/**
 * 產生專屬面試大綱並寄出邀請（對應規劃文件第四、五章）
 */
export async function POST(_req: Request, { params }: Params) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: { job: true },
  });
  if (!candidate) return NextResponse.json({ error: "找不到候選人" }, { status: 404 });

  const profile = parseJson<CandidateProfile>(candidate.profile, emptyProfile);

  let outline;
  try {
    outline = await generateOutline(
      {
        title: candidate.job.title,
        location: candidate.job.location,
        description: candidate.job.description,
        mustHave: candidate.job.mustHave,
        niceToHave: candidate.job.niceToHave,
        yearsRequired: candidate.job.yearsRequired,
        languageReq: candidate.job.languageReq,
        shift: candidate.job.shift,
        salaryRange: candidate.job.salaryRange,
        focusPoints: parseJson<string[]>(candidate.job.focusPoints, []),
      },
      profile
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: `面試大綱生成失敗：${err instanceof Error ? err.message : "未知錯誤"}`,
      },
      { status: 500 }
    );
  }

  const interview = await prisma.interview.create({
    data: {
      candidateId: candidate.id,
      token: randomBytes(24).toString("hex"),
      outline: JSON.stringify(outline),
      status: "invited",
    },
  });

  const mail = await sendInvitation({
    to: candidate.email,
    candidateName: candidate.name,
    jobTitle: candidate.job.title,
    token: interview.token,
  });

  return NextResponse.json({ interview, outline, mail }, { status: 201 });
}
