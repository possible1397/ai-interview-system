import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import InterviewClient from "./InterviewClient";

export const dynamic = "force-dynamic";

export default async function InterviewPage({
  params,
}: {
  params: { token: string };
}) {
  const interview = await prisma.interview.findUnique({
    where: { token: params.token },
    include: {
      candidate: { include: { job: true } },
      transcript: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!interview) notFound();

  return (
    <InterviewClient
      token={interview.token}
      candidateName={interview.candidate.name}
      jobTitle={interview.candidate.job.title}
      status={interview.status}
      consented={Boolean(interview.consentAt)}
      scheduledAt={interview.scheduledAt?.toISOString() ?? null}
      initialTranscript={interview.transcript.map((t) => ({
        role: t.role as "ai" | "candidate",
        text: t.text,
      }))}
    />
  );
}
