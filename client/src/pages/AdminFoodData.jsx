import { useCallback, useEffect, useState } from "react";
import { Check, X, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import SEO from "../hooks/useSEO";
import { foodAdminService } from "../services/api";
import { apiError, when, Card, Spinner, Table, Pager, Button } from "../components/shopAdmin/ShopAdminUI";

// Food DB admin: dishes the AI added to the DB, waiting for review (docs/FOOD_DB_FLOW.md 8.4).
// Food photos are switched off across the app, so there is no photo review here.

// ── New foods (added by the AI from scans and diet plans) ────────────────────

function FoodsTab() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData((await foodAdminService.foods({ status: "ai_pending", sort: "-hitCount", page, limit: 25 })).data);
    } catch (err) {
      toast.error(apiError(err, "Failed to load foods"));
    } finally {
      setLoading(false);
    }
  }, [page]);
  useEffect(() => { load(); }, [load]);

  const act = async (food, fn, okMsg) => {
    setBusyId(food.foodId);
    try {
      await fn();
      toast.success(okMsg);
      setData((d) => d && ({ ...d, total: d.total - 1, items: d.items.filter((f) => f.foodId !== food.foodId) }));
    } catch (err) {
      toast.error(apiError(err, "Action failed"));
    } finally {
      setBusyId(null);
    }
  };

  const columns = [
    {
      key: "name", label: "Food", render: (f) => (
        <div>
          <div className="font-medium text-slate-900">{f.name}</div>
          <div className="text-xs text-slate-500">{f.foodId}{f.aliases?.length ? ` · also: ${f.aliases.slice(0, 3).join(", ")}` : ""}</div>
        </div>
      ),
    },
    { key: "category", label: "Category", render: (f) => <span className="text-slate-700">{f.classification?.category || "—"}</span> },
    { key: "diet", label: "Diet", render: (f) => <span className="text-slate-700">{(f.classification?.dietType || "—").replace(/_/g, " ")}</span> },
    { key: "serving", label: "Serving", render: (f) => <span className="whitespace-nowrap text-slate-700">{f.serving?.defaultUnit} · {f.serving?.defaultGrams} g</span> },
    {
      key: "per100", label: "Per 100 g", render: (f) => {
        const n = f.nutritionPer100g || {};
        return <span className="whitespace-nowrap tabular-nums text-slate-700">{Math.round(n.calories ?? 0)} kcal · P {n.protein ?? "—"} · C {n.carbs ?? "—"} · F {n.fats ?? "—"}</span>;
      },
    },
    {
      key: "checks", label: "Checks", render: (f) => (f.dataQuality?.checksPassed
        ? <span className="text-xs text-green-700">Passed</span>
        : <span className="text-xs text-red-700">Failed</span>),
    },
    { key: "uses", label: "Uses", align: "right", render: (f) => f.stats?.hitCount ?? 0 },
    { key: "created", label: "Added", render: (f) => <span className="whitespace-nowrap text-slate-500 text-xs">{when(f.createdAt)}</span> },
    {
      key: "actions", label: "", render: (f) => (
        <div className="flex gap-2 justify-end">
          <Button disabled={busyId === f.foodId} onClick={() => act(f, () => foodAdminService.approveFood(f.foodId), `Approved: ${f.name}`)}>
            <Check className="w-4 h-4" /> Approve
          </Button>
          <Button variant="secondary" disabled={busyId === f.foodId} onClick={() => act(f, () => foodAdminService.rejectFood(f.foodId), `Rejected: ${f.name}`)}>
            <X className="w-4 h-4" /> Reject
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card
      title="Foods added by the AI, waiting for review"
      action={<Button variant="secondary" onClick={load} aria-label="Refresh"><RefreshCw className="w-4 h-4" /></Button>}
    >
      <p className="text-xs text-slate-500 mb-3">
        Added when a scan or a diet plan named a dish the database did not have. Approve if the values look right; it can
        then also be picked by the database diet plans. Reject if it is not a real dish or the values are wrong.
        Most-used first.
      </p>
      {loading && !data ? <Spinner /> : (
        <>
          <Table columns={columns} rows={(data?.items || []).map((f) => ({ ...f, _key: f.foodId }))} empty="No foods waiting for review." />
          <Pager page={page} totalPages={Math.max(1, Math.ceil((data?.total || 0) / 25))} total={data?.total || 0} onPage={setPage} />
        </>
      )}
    </Card>
  );
}

export default function AdminFoodData() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-5">
      <SEO title="Food Data | Admin" />
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Food data</h1>
        <p className="text-sm text-slate-500 mt-0.5">Review foods added to the food database.</p>
      </div>
      <FoodsTab />
    </div>
  );
}
