import { Route, Sparkles, Flame, Repeat, AlertTriangle, MoonStar, Utensils, UserCog } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import SEO from "../../hooks/useSEO";
import { adminV1Service } from "../../services/api";
import { TONES, riseIn, container } from "../../components/admin/adminTheme";
import { AnimatedNumber } from "../../components/admin/AdminUI";
import { useApi } from "../../components/admin/useApi";
import { Page, PageHeader, LoadingGrid, ErrorState, PrivacyNote, HiddenValue } from "../../components/admin/TakeAdminKit";

const META = {
  new: { icon: Sparkles, tone: "blue" },
  highly_active: { icon: Flame, tone: "mint" },
  used_once: { icon: Repeat, tone: "amber" },
  at_risk: { icon: AlertTriangle, tone: "error" },
  inactive: { icon: MoonStar, tone: "info" },
  meal_trackers: { icon: Utensils, tone: "teal" },
  incomplete: { icon: UserCog, tone: "blue" },
};

export default function TakeAdminBehaviour() {
  const reduce = useReducedMotion();
  const { data, loading, error, reload } = useApi(() => adminV1Service.behaviour(), []);

  return (
    <Page>
      <SEO pageName="takeAdminBehaviour" />
      <PageHeader icon={Route} title="User Behaviour" subtitle="Groups based on how people use the app" />
      <PrivacyNote minGroup={data?.minGroupSize} />

      {loading && !data ? (
        <LoadingGrid cards={4} tall={false} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <>
          <motion.div variants={riseIn} className="bg-white rounded-3xl border border-tk-line p-6 flex flex-col sm:flex-row sm:items-center gap-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-tk-muted">Used the app on only one day (last 30 days)</p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight text-tk-ink">{data.usedOncePct}%</p>
            </div>
            <div className="flex-1">
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <motion.div
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${data.usedOncePct}%` }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full bg-tk-blue"
                />
              </div>
              <p className="text-sm text-tk-muted mt-2">
                {data.activeIn30.toLocaleString()} users were active in the last 30 days. People who open the app once and never return are the biggest growth opportunity.
              </p>
            </div>
          </motion.div>

          <motion.div variants={container} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.groups.map((g) => {
              const m = META[g.key] || META.new;
              const t = TONES[m.tone];
              return (
                <motion.div
                  key={g.key}
                  variants={riseIn}
                  whileHover={reduce ? undefined : { y: -4 }}
                  className="group bg-white rounded-2xl border border-tk-line p-5 hover:shadow-[0_12px_28px_-12px_rgba(32,90,226,0.25)] transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className={`w-11 h-11 rounded-xl grid place-items-center ${t.tile}`}>
                      <m.icon className="w-5 h-5" />
                    </div>
                    <div className="text-right">
                      {g.hidden ? (
                        <HiddenValue minGroup={data.minGroupSize} />
                      ) : (
                        <AnimatedNumber value={g.value} className="text-3xl font-extrabold tracking-tight text-tk-ink" />
                      )}
                    </div>
                  </div>
                  <h3 className="mt-4 text-base font-bold text-tk-ink">{g.name}</h3>
                  <p className="text-sm text-tk-muted mt-0.5">{g.desc}</p>
                  <p className="mt-3 pt-3 border-t border-tk-line text-xs text-slate-600">
                    <b className="text-tk-ink">Suggested action:</b> {g.action}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
          <p className="text-xs text-tk-muted">{data.note}</p>
        </>
      )}
    </Page>
  );
}
