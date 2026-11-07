import Link from "next/link";
import { prisma, parseJson } from "@/lib/db";
import { emptyReport, type CandidateReport } from "@/lib/report";

export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { text: string; cls: string }> = {
  pending: { text: "待審核", cls: "amber" },
  proceed: { text: "Proceed", cls: "green" },
  hold: { text: "Hold", cls: "grey" },
  follow_up: { text: "Need Follow-up", cls: "amber" },
  not_suitable: { text: "Not Suitable", cls: "red" },
};

export default async function ReviewListPage() {
  const reports = await prisma.report.findMany({
    orderBy: [{ recruiterStatus: "asc" }, { createdAt: "desc" }],
    include: {
      interview: { include: { candidate: { include: { job: true } } } },
    },
  });

  return (
    <>
      <h1>面談報告審核</h1>
      <p className="sub">
        每位候選人各自完成面試後產生報告，依報告內容個別判斷是否推薦。
      </p>

      {reports.length === 0 ? (
        <div className="card">
          <div className="empty">目前沒有已完成的面談報告。</div>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>候選人</th>
                <th>職缺</th>
                <th>相關年資</th>
                <th>完成時間</th>
                <th>審核狀態</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const content = parseJson<CandidateReport>(r.content, emptyReport);
                const meta = STATUS_META[r.recruiterStatus] ?? STATUS_META.pending;
                return (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/review/${r.id}`}>
                        {r.interview.candidate.name}
                      </Link>
                    </td>
                    <td className="small">{r.interview.candidate.job.title}</td>
                    <td className="small">{content.basics.relevantYears || "—"}</td>
                    <td className="small">
                      {r.interview.endedAt
                        ? r.interview.endedAt.toLocaleString("zh-TW")
                        : "—"}
                    </td>
                    <td>
                      <span className={`tag ${meta.cls}`}>{meta.text}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
