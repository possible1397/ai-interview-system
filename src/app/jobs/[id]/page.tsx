import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma, parseJson } from "@/lib/db";
import { emptyProfile, type CandidateProfile } from "@/lib/resume";
import AddCandidateForm from "./AddCandidateForm";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  invited: { text: "已邀請", cls: "grey" },
  scheduled: { text: "已預約", cls: "" },
  in_progress: { text: "面試中", cls: "amber" },
  completed: { text: "已完成", cls: "green" },
  no_show: { text: "未出席", cls: "red" },
  cancelled: { text: "已取消", cls: "red" },
};

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    include: {
      candidates: {
        orderBy: { createdAt: "desc" },
        include: { interviews: { include: { report: true } } },
      },
    },
  });

  if (!job) notFound();

  const focusPoints = parseJson<string[]>(job.focusPoints, []);

  return (
    <>
      <h1>{job.title}</h1>
      <p className="sub">
        {job.location || "地點未指定"}
        {job.salaryRange ? ` ・ ${job.salaryRange}` : ""}
      </p>

      <div className="card">
        <div className="card-title">職缺內容</div>
        <div className="grid2">
          <div>
            <label>工作內容</label>
            <div className="small">{job.description || "—"}</div>
          </div>
          <div>
            <label>必要條件</label>
            <div className="small">{job.mustHave || "—"}</div>
          </div>
          <div>
            <label>加分條件</label>
            <div className="small">{job.niceToHave || "—"}</div>
          </div>
          <div>
            <label>年資／語言／輪班</label>
            <div className="small">
              {[job.yearsRequired, job.languageReq, job.shift].filter(Boolean).join("／") || "—"}
            </div>
          </div>
        </div>

        <label style={{ marginTop: 12 }}>AI 面試重點</label>
        {focusPoints.length ? (
          <ul className="plain small">
            {focusPoints.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        ) : (
          <div className="small muted">未設定</div>
        )}
      </div>

      <AddCandidateForm jobId={job.id} />

      <h2>候選人（{job.candidates.length}）</h2>
      {job.candidates.length === 0 ? (
        <div className="card">
          <div className="empty">尚未加入候選人。</div>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>姓名</th>
                <th>目前職稱</th>
                <th>相關年資</th>
                <th>履歷解析</th>
                <th>面試狀態</th>
              </tr>
            </thead>
            <tbody>
              {job.candidates.map((c) => {
                const profile = parseJson<CandidateProfile>(c.profile, emptyProfile);
                const latest = c.interviews[c.interviews.length - 1];
                const s = latest ? STATUS_LABEL[latest.status] : null;
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/candidates/${c.id}`}>{c.name}</Link>
                      <div className="small muted">{c.email}</div>
                    </td>
                    <td className="small">
                      {profile.currentTitle || "—"}
                      <div className="muted">{profile.currentCompany}</div>
                    </td>
                    <td className="small">{profile.relevantYears || "—"}</td>
                    <td>
                      <span
                        className={`tag ${
                          c.parseStatus === "confirmed"
                            ? "green"
                            : c.parseStatus === "failed"
                              ? "red"
                              : c.parseStatus === "parsed"
                                ? "amber"
                                : "grey"
                        }`}
                      >
                        {c.parseStatus === "confirmed"
                          ? "已確認"
                          : c.parseStatus === "failed"
                            ? "解析失敗"
                            : c.parseStatus === "parsed"
                              ? "待確認"
                              : "尚未解析"}
                      </span>
                    </td>
                    <td>
                      {s ? (
                        <>
                          <span className={`tag ${s.cls}`}>{s.text}</span>
                          {latest?.report && (
                            <div className="small" style={{ marginTop: 4 }}>
                              <Link href={`/review/${latest.report.id}`}>查看報告</Link>
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="tag grey">未邀請</span>
                      )}
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
