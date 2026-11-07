import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    include: { candidates: true },
  });
  if (!job) return NextResponse.json({ error: "找不到職缺" }, { status: 404 });
  return NextResponse.json(job);
}

export async function PATCH(req: Request, { params }: Params) {
  const body = await req.json();
  const data: Record<string, unknown> = {};

  for (const key of [
    "title",
    "location",
    "description",
    "mustHave",
    "niceToHave",
    "yearsRequired",
    "languageReq",
    "shift",
    "salaryRange",
    "status",
  ]) {
    if (key in body) data[key] = body[key] || null;
  }

  if ("focusPoints" in body) {
    const points: string[] = Array.isArray(body.focusPoints)
      ? body.focusPoints
      : String(body.focusPoints ?? "")
          .split("\n")
          .map((s: string) => s.trim())
          .filter(Boolean);
    data.focusPoints = JSON.stringify(points);
  }

  const job = await prisma.job.update({ where: { id: params.id }, data });
  return NextResponse.json(job);
}

export async function DELETE(_req: Request, { params }: Params) {
  await prisma.job.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
