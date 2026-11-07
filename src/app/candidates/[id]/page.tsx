import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma, parseJson } from "@/lib/db";
import { emptyProfile, type CandidateProfile } from "@/lib/resume";
import { emptyOutline, type InterviewOutline } from "@/lib/questions";
import CandidateActions from "./CandidateActions";

export const dynamic = "force-dynamic";

export default async function CandidateDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: {
      job: true,
      interviews: { include: { report: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!candidate) notFound();

  const profile = parseJson<CandidateProfile>(candidate.profile, emptyProfile);
  const latest = candidate.interviews[0];
  const outline = latest
    ? parseJson<InterviewOutline>(latest.outline, emptyOutline)
    : null;

  return (
    <>
      <h1>{candidate.name}</h1>
      <p className="sub">
        {candidate.email} ・ 應徵{" "}
        <Link href={`/jobs/${candidate.jobId}`}>{candidate.job.title}</Link>
      </p>

      <div className="card">
        <div className="card-title">履歷解析結果</div>
        {candidate.parseStatus === "failed" && (
          <div className="notice error">履歷解析失敗，請確認檔案格式或本地模型狀態。</div>
        )}
        <div className="grid2">
          <div>
            <label>目前公司</label>
            <div className="small">{profile.currentCompany || "—"}</div>
          </div>
          <div>
            <label>目前職稱</label>
            <div className="small">{profile.currentTitle || "—"}</div>
          </div>
          <div>
            <label>總年資</label>
            <div className="small">{profile.totalYears || "—"}</div>
          </div>
          <div>
            <label>相關年資</label>
            <div className="small">{profile.relevantYears || "—"}</div>
          </div>
          <div>
            <label>學歷</label>
            <div className="small">{profile.education || "—"}</div>
          </div>
          <div>
            <label>語言能力</label>
            <div className="small">{profile.languages.join("、") || "—"}</div>
          </div>
        </div>

        <label style={{ marginTop: 12 }}>技術能力</label>
        <div className="small">{profile.skills.join("、") || "—"}</div>

        {profile.experiences.length > 0 && (
          <>
            <label style={{ marginTop: 12 }}>工作經歷</label>
            <ul className="plain small">
              {profile.experiences.map((e, i) => (
                <li key={i}>
                  <strong>{e.company}</strong>／{e.title}／{e.period}
                  {e.summary ? <div className="muted">{e.summary}</div> : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <CandidateActions
        candidateId={candidate.id}
        parseStatus={candidate.parseStatus}
        hasInterview={Boolean(latest)}
        interviewToken={latest?.token ?? null}
        interviewStatus={latest?.status ?? null}
      />

      {outline && (
        <div className="card">
          <div className="card-title">本場面試專屬大綱</div>
          <p className="small muted" style={{ marginTop: -6 }}>
            由職缺內容 + 這份履歷 + 面試重點生成，每位候選人不同。
          </p>

          <Section title="面試目標" items={outline.objectives} />
          <Section title="基本條件確認" items={outline.basicQuestions} />
          <Section title="履歷確認" items={outline.resumeQuestions} />

          {outline.technicalProbes.length > 0 && (
            <>
              <h3>技術追問方向</h3>
              <ul className="plain small">
                {outline.technicalProbes.map((t, i) => (
                  <li key={i}>
                    <strong>{t.topic}</strong>：{t.opening}
                    {t.followUps.length > 0 && (
                      <div className="muted">可追問：{t.followUps.join("／")}</div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          <Section title="成果確認" items={outline.achievementQuestions} />
          <Section title="英文題目" items={outline.englishQuestions} />
          <Section title="需釐清的疑點" items={outline.flags} />
        </div>
      )}

      {candidate.interviews.length > 0 && (
        <div className="card">
          <div className="card-title">面試紀錄</div>
          <table>
            <thead>
              <tr>
                <th>建立時間</th>
                <th>預約時間</th>
                <th>狀態</th>
                <th>報告</th>
              </tr>
            </thead>
            <tbody>
              {candidate.interviews.map((i) => (
                <tr key={i.id}>
                  <td className="small">{i.createdAt.toLocaleString("zh-TW")}</td>
                  <td className="small">
                    {i.scheduledAt ? i.scheduledAt.toLocaleString("zh-TW") : "—"}
                  </td>
                  <td className="small">{i.status}</td>
                  <td className="small">
                    {i.report ? (
                      <Link href={`/review/${i.report.id}`}>查看</Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <>
      <h3>{title}</h3>
      <ul className="plain small">
        {items.map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ul>
    </>
  );
}
