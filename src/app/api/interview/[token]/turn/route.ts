import { NextResponse } from "next/server";
import { prisma, parseJson } from "@/lib/db";
import { emptyOutline, type InterviewOutline } from "@/lib/questions";
import {
  nextTurn,
  type Stage,
  type Turn,
  STAGE_LABELS,
} from "@/lib/interview-engine";
import { emptyProfile, type CandidateProfile } from "@/lib/resume";
import { generateReport } from "@/lib/report";

type Params = { params: { token: string } };

/**
 * 面試的一個回合（對應規劃文件第九章）
 *
 * 目前以文字問答驅動。步驟二導入語音後，只需在前端把輸入換成 STT 結果、
 * 把回覆送進 TTS，這支 API 與對話邏輯不需更動。
 */
export async function POST(req: Request, { params }: Params) {
  const body = await req.json().catch(() => ({}));
  const answer = typeof body.text === "string" ? body.text.trim() : "";

  const interview = await prisma.interview.findUnique({
    where: { token: params.token },
    include: {
      candidate: { include: { job: true } },
      transcript: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!interview) return NextResponse.json({ error: "連結無效" }, { status: 404 });
  if (!interview.consentAt) {
    return NextResponse.json({ error: "尚未完成面試告知確認" }, { status: 400 });
  }
  if (interview.status === "completed") {
    return NextResponse.json({ error: "本場面試已結束" }, { status: 400 });
  }

  const startedAt = interview.startedAt ?? new Date();
  const offsetMs = Date.now() - startedAt.getTime();

  // 首次呼叫：標記面試開始
  if (!interview.startedAt) {
    await prisma.interview.update({
      where: { id: interview.id },
      data: { startedAt, status: "in_progress" },
    });
  }

  // 記錄候選人回答
  if (answer) {
    await prisma.transcriptEntry.create({
      data: {
        interviewId: interview.id,
        role: "candidate",
        text: answer,
        offsetMs,
        stage: interview.stage,
      },
    });
  }

  const history: Turn[] = [
    ...interview.transcript.map((t) => ({
      role: t.role as "ai" | "candidate",
      text: t.text,
      stage: t.stage,
    })),
    ...(answer ? [{ role: "candidate" as const, text: answer, stage: interview.stage }] : []),
  ];

  const outline = parseJson<InterviewOutline>(interview.outline, emptyOutline);

  let result;
  try {
    result = await nextTurn(interview.stage as Stage, outline, history);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "對話引擎錯誤" },
      { status: 500 }
    );
  }

  // 記錄 AI 發言
  if (result.say) {
    await prisma.transcriptEntry.create({
      data: {
        interviewId: interview.id,
        role: "ai",
        text: result.say,
        offsetMs: Date.now() - startedAt.getTime(),
        stage: interview.stage,
      },
    });
  }

  await prisma.interview.update({
    where: { id: interview.id },
    data: {
      stage: result.nextStage,
      status: result.finished ? "completed" : "in_progress",
      endedAt: result.finished ? new Date() : null,
    },
  });

  // 面試結束：產生報告（對應第十、十一章）
  if (result.finished) {
    const fullTranscript = await prisma.transcriptEntry.findMany({
      where: { interviewId: interview.id },
      orderBy: { createdAt: "asc" },
    });

    try {
      const report = await generateReport({
        candidateName: interview.candidate.name,
        jobTitle: interview.candidate.job.title,
        profile: parseJson<CandidateProfile>(interview.candidate.profile, emptyProfile),
        transcript: fullTranscript.map((t) => ({
          role: t.role as "ai" | "candidate",
          text: t.text,
          stage: t.stage,
        })),
        engineUnconfirmed: result.unconfirmed,
      });

      await prisma.report.upsert({
        where: { interviewId: interview.id },
        create: { interviewId: interview.id, content: JSON.stringify(report) },
        update: { content: JSON.stringify(report) },
      });
    } catch (err) {
      console.error("報告生成失敗：", err);
    }
  }

  return NextResponse.json({
    say: result.say,
    stage: result.nextStage,
    stageLabel: STAGE_LABELS[result.nextStage],
    finished: result.finished,
  });
}
