import Link from "next/link";
import { prisma } from "@/lib/db";
import { checkLLM } from "@/lib/llm";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [jobs, llm] = await Promise.all([
    prisma.job.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { candidates: true } },
        candidates: { include: { interviews: true } },
      },
    }),
    checkLLM(),
  ]);

  const pendingReviews = await prisma.report.count({
    where: { recruiterStatus: "pending" },
  });

  return (
    <>
      <h1>職缺總覽</h1>
      <p className="sub">
        建立職缺、上傳候選人履歷、發送 AI 面試邀請，並在面試完成後審核報告。
      </p>

      {!llm.ok && (
        <div className="notice warn">
          <strong>本地模型尚未就緒：</strong> {llm.message}
          <div className="small" style={{ marginTop: 4 }}>
            履歷解析、題目生成與面試對話都需要本地模型。職缺與候選人管理不受影響。
          </div>
        </div>
      )}

      {pendingReviews > 0 && (
        <div className="notice info">
          有 {pendingReviews} 份面談報告待審核 —{" "}
          <Link href="/review">前往審核</Link>
        </div>
      )}

      <div className="btn-row" style={{ marginBottom: 18 }}>
        <Link href="/jobs/new">
          <button>建立新職缺</button>
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="card">
          <div className="empty">尚未建立任何職缺。</div>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>職缺</th>
                <th>地點</th>
                <th>候選人</th>
                <th>已完成面試</th>
                <th>狀態</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const completed = job.candidates.reduce(
                  (n, c) =>
                    n + c.interviews.filter((i) => i.status === "completed").length,
                  0
                );
                return (
                  <tr key={job.id}>
                    <td>
                      <Link href={`/jobs/${job.id}`}>{job.title}</Link>
                    </td>
                    <td className="muted">{job.location || "—"}</td>
                    <td>{job._count.candidates}</td>
                    <td>{completed}</td>
                    <td>
                      <span className={`tag ${job.status === "active" ? "green" : "grey"}`}>
                        {job.status === "active" ? "招募中" : "草稿"}
                      </span>
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
