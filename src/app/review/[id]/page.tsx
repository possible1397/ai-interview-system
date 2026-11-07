import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma, parseJson } from "@/lib/db";
import { emptyReport, type CandidateReport, type ReportItem } from "@/lib/report";
import ReviewActions from "./ReviewActions";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: { id: string } }) {
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

  if (!report) notFound();

  const c = parseJson<CandidateReport>(report.content, emptyReport);
  const { candidate } = report.interview;
  const durationMin =
    report.interview.startedAt && report.interview.endedAt
      ? Math.round(
          (report.interview.endedAt.getTime() - report.interview.startedAt.getTime()) /
            60000
        )
      : null;

  return (
    <>
      <h1>{c.basics.name || candidate.name}</h1>
      <p className="sub">
        應徵 <Link href={`/jobs/${candidate.jobId}`}>{candidate.job.title}</Link>
        {durationMin != null ? ` ・ 面試長度 ${durationMin} 分鐘` : ""}
        {" ・ "}
        <Link href={`/candidates/${candidate.id}`}>候選人資料</Link>
      </p>

      <ReviewActions
        reportId={report.id}
        status={report.recruiterStatus}
        note={report.recruiterNote ?? ""}
      />

      <div className="card">
        <div className="card-title">基本資料</div>
        <div className="grid2">
          <Field label="目前公司" value={c.basics.currentCompany} />
          <Field label="目前職稱" value={c.basics.currentTitle} />
          <Field label="總年資" value={c.basics.totalYears} />
          <Field label="相關年資" value={c.basics.relevantYears} />
          <Field label="學歷" value={c.basics.education} />
          <Field label="語言" value={c.basics.languages} />
        </div>
      </div>

      {c.experienceSummary && (
        <div className="card">
          <div className="card-title">工作經驗摘要</div>
          <div className="small">{c.experienceSummary}</div>
        </div>
      )}

      <div className="card">
        <div className="card-title">技術能力與熟悉程度</div>
        {c.skills.length > 0 && (
          <div className="small" style={{ marginBottom: 10 }}>
            {c.skills.join("、")}
          </div>
        )}
        {c.proficiency.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>能力項目</th>
                <th>熟悉程度</th>
              </tr>
            </thead>
            <tbody>
              {c.proficiency.map((p, i) => (
                <tr key={i}>
                  <td className="small">{p.skill}</td>
                  <td className="small">{p.level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="small muted">面試中未取得足以判斷的資訊。</div>
        )}
      </div>

      <EvidenceCard title="具體成果" items={c.achievements} />
      <EvidenceCard title="亮點" items={c.highlights} />
      <EvidenceCard title="疑慮" items={c.concerns} />

      <div className="card">
        <div className="card-title">求職條件</div>
        <div className="grid2">
          <Field label="目前薪資" value={c.conditions.currentSalary} />
          <Field label="期望薪資" value={c.conditions.expectedSalary} />
          <Field label="到職時間" value={c.conditions.noticePeriod} />
          <Field label="工作地點" value={c.conditions.location} />
          <Field label="輪班意願" value={c.conditions.shift} />
          <Field label="出差意願" value={c.conditions.travel} />
        </div>
      </div>

      {c.unconfirmed.length > 0 && (
        <div className="card">
          <div className="card-title">未確認資訊</div>
          <p className="small muted" style={{ marginTop: -6 }}>
            以下項目 AI 面試中未能確認，需由 Recruiter 補問。
          </p>
          <ul className="plain small">
            {c.unconfirmed.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      )}

      {c.candidateQuestions.length > 0 && (
        <div className="card">
          <div className="card-title">候選人提問</div>
          <p className="small muted" style={{ marginTop: -6 }}>
            AI 僅記錄問題，未代為答覆，請 Recruiter 後續回覆。
          </p>
          <ul className="plain small">
            {c.candidateQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <div className="card-title">
          逐字稿（{report.interview.transcript.length} 則）
        </div>
        <p className="small muted" style={{ marginTop: -6 }}>
          報告內容以此為依據，可據此查證 AI 摘要是否正確。
        </p>
        <div style={{ maxHeight: 480, overflowY: "auto" }}>
          {report.interview.transcript.map((t) => (
            <div key={t.id} style={{ marginBottom: 10 }}>
              <div className="small muted">
                {t.role === "ai" ? "AI" : "候選人"}
                {" ・ "}
                {formatOffset(t.offsetMs)}
              </div>
              <div className="small" style={{ whiteSpace: "pre-wrap" }}>
                {t.text}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label>{label}</label>
      <div className="small">{value || "—"}</div>
    </div>
  );
}

function EvidenceCard({ title, items }: { title: string; items: ReportItem[] }) {
  if (!items.length) return null;
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      {items.map((i, idx) => (
        <div key={idx} style={{ marginBottom: 12 }}>
          <div className="small">
            <strong>{i.point}</strong>
          </div>
          {i.evidence && <div className="evidence">「{i.evidence}」</div>}
        </div>
      ))}
    </div>
  );
}

function formatOffset(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
