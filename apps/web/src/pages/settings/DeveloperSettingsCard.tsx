import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@aura/ui";
import { useAuth } from "../../hooks/useAuth";
import { ProvidersTab } from "./ProvidersTab";
import { ModelsTab } from "./ModelsTab";
import { RoutingTab } from "./RoutingTab";
import { FeatureFlagsTab } from "./FeatureFlagsTab";
import { HealthTab } from "./HealthTab";

const TABS = [
  { id: "providers", label: "AI Providers" },
  { id: "models", label: "Models" },
  { id: "routing", label: "Routing" },
  { id: "flags", label: "Feature Flags" },
  { id: "health", label: "System Health" },
];

export function DeveloperSettingsCard() {
  const { user } = useAuth();
  const [tab, setTab] = useState("providers");
  const role = (user as { role?: string } | undefined)?.role;
  if (role !== "admin" && role !== "superadmin") return null;
  return (
    <Card className="mb-6 border-indigo-300">
      <CardHeader>
        <CardTitle>Developer Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-slate-500">Manage AI providers, models, routing and platform flags. Visible to administrators only.</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button key={item.id} onClick={() => setTab(item.id)} className={tab === item.id ? "rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white" : "rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}>
              {item.label}
            </button>
          ))}
        </div>
        {tab === "providers" ? <ProvidersTab /> : null}
        {tab === "models" ? <ModelsTab /> : null}
        {tab === "routing" ? <RoutingTab /> : null}
        {tab === "flags" ? <FeatureFlagsTab /> : null}
        {tab === "health" ? <HealthTab /> : null}
      </CardContent>
    </Card>
  );
}
