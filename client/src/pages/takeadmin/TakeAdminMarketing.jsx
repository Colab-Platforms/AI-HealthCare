import { Megaphone, CheckCircle2, CircleDashed } from "lucide-react";
import { motion } from "framer-motion";
import SEO from "../../hooks/useSEO";
import { riseIn } from "../../components/admin/adminTheme";
import { Page, PageHeader } from "../../components/admin/TakeAdminKit";

const STEPS = [
  { done: false, title: "Sign-up source tracking", body: "Record where each user came from (organic, paid ad, referral, campaign) when they sign up. Nothing is stored today, so acquisition charts and cost per sign-up cannot be calculated." },
  { done: false, title: "Onboarding funnel events", body: "Log each onboarding step (installed, signed up, finished setup, first log, active after 7 days) so the drop-off between steps can be measured." },
  { done: false, title: "Campaign workflow", body: "Draft → Super Admin approval → scheduled send → results (sent, opened, action taken, opt-outs). Sending must stay blocked until a Super Admin approves." },
  { done: true, title: "Approval engine", body: "Requests, approval, rejection and audit log are in place and ready for campaigns to plug into." },
];

export default function TakeAdminMarketing() {
  return (
    <Page>
      <SEO pageName="takeAdminMarketing" />
      <PageHeader icon={Megaphone} title="Marketing & Campaigns" subtitle="Acquisition, funnels and campaign results" />

      <motion.div variants={riseIn} className="bg-white rounded-3xl border border-tk-line p-6 md:p-8">
        <h2 className="text-lg font-bold text-tk-ink">This area needs data that isn't collected yet</h2>
        <p className="text-sm text-tk-muted mt-1 max-w-2xl">
          To avoid showing made-up numbers, marketing charts stay empty until the tracking below exists. Here is what has to be built first.
        </p>

        <ol className="mt-6 space-y-4">
          {STEPS.map((s) => (
            <li key={s.title} className="flex gap-3.5">
              {s.done ? (
                <CheckCircle2 className="w-6 h-6 text-tk-teal shrink-0 mt-0.5" />
              ) : (
                <CircleDashed className="w-6 h-6 text-tk-muted shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold text-tk-ink">
                  {s.title}
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-[11px] font-bold ${s.done ? "bg-tk-teal-soft text-tk-teal" : "bg-slate-100 text-slate-600"}`}>
                    {s.done ? "Ready" : "To build"}
                  </span>
                </p>
                <p className="text-sm text-slate-600 mt-0.5">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </motion.div>
    </Page>
  );
}
