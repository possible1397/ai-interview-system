import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { candidates: true } } },
  });
  return NextResponse.json(jobs);
}

export async function POST(req: Request) {
  const body = await req.json();

  if (!body.title || typeof body.title !== "string") {
    return NextResponse.json({ error: "職缺名稱為必填" }, { status: 400 });
  }

  const focusPoints: string[] = Array.isArray(body.focusPoints)
    ? body.focusPoints
    : String(body.focusPoints ?? "")
        .split("\n")
        .map((s: string) => s.trim())
        .filter(Boolean);

  const job = await prisma.job.create({
    data: {
      title: body.title.trim(),
      location: body.location || null,
      description: body.description || null,
      mustHave: body.mustHave || null,
      niceToHave: body.niceToHave || null,
      yearsRequired: body.yearsRequired || null,
      languageReq: body.languageReq || null,
      shift: body.shift || null,
      salaryRange: body.salaryRange || null,
      focusPoints: JSON.stringify(focusPoints),
      status: body.status === "active" ? "active" : "draft",
    },
  });

  return NextResponse.json(job, { status: 201 });
}
