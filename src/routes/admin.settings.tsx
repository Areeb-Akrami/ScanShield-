import { RequireRole, useSession } from "@/components/AppShell";
import { Button, Field, Panel, PanelHeader, inputClass } from "@/components/ui";
import { EXEMPTIONS, RULES } from "@/legal/corpus";
import { updateUserProfile } from "@/lib/admin-users";
import { signOut } from "@/lib/auth";
import { changeMyPassword } from "@/lib/consumer";
import { listDbRules, listExemptions, listLegalDocuments } from "@/lib/db";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Administrator settings — ScanShield" },
      { name: "description", content: "Your administrator profile, password, and the state of the Legal Metrology corpus held in the database." },
      { property: "og:title", content: "Administrator settings — ScanShield" },
      { property: "og:description", content: "Profile, password and corpus status for ScanShield administrators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [district, setDistrict] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [corpus, setCorpus] = useState({ rules: 0, exemptions: 0, sources: 0 });

  useEffect(() => {
    if (!session) return;
    setFullName(session.name ?? "");
    setDistrict(session.district === "—" ? "" : session.district);
    setDepartment(session.department ?? "");
  }, [session]);

  useEffect(() => {
    void Promise.all([listDbRules(), listExemptions(), listLegalDocuments()]).then(([r, x, d]) => {
      setCorpus({ rules: new Set(r.map((v) => v.rule_key)).size, exemptions: x.length, sources: d.length });
    });
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    const { error } = await updateUserProfile(session.userId, {
      full_name: fullName,
      phone,
      department,
      district,
    });
    setBusy(false);
    setStatus(error ?? "Your profile was saved.");
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await changeMyPassword(password);
    setBusy(false);
    setPassword("");
    setStatus(res.error ?? "Your password was changed.");
  }

  return (
    <RequireRole allowed={["ADMIN"]}>
      <div className="space-y-4">
        {status ? <p className="rounded-md border border-border bg-card px-4 py-2.5 text-xs">{status}</p> : null}

        <Panel>
          <PanelHeader title="Corpus status" subtitle="What is actually held in the database right now." />
          <dl className="grid grid-cols-3 divide-x divide-border text-center">
            <div className="px-4 py-3">
              <dt className="label-caps">Provisions</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">{corpus.rules}</dd>
            </div>
            <div className="px-4 py-3">
              <dt className="label-caps">Exemptions</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">{corpus.exemptions}</dd>
            </div>
            <div className="px-4 py-3">
              <dt className="label-caps">Source documents</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">{corpus.sources}</dd>
            </div>
          </dl>
          <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
            Bundled corpus used by the checking engine: {RULES.length} provisions, {EXEMPTIONS.length} exemptions.
          </p>
        </Panel>

        <Panel>
          <PanelHeader title="Your profile" />
          <form onSubmit={saveProfile} className="space-y-3 p-4">
            <Field label="Full name">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass()} />
            </Field>
            <Field label="Phone">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass()} />
            </Field>
            <Field label="Department">
              <input value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass()} />
            </Field>
            <Field label="District">
              <input value={district} onChange={(e) => setDistrict(e.target.value)} className={inputClass()} />
            </Field>
            <Button type="submit" disabled={busy}>
              Save profile
            </Button>
          </form>
        </Panel>

        <Panel>
          <PanelHeader title="Change password" />
          <form onSubmit={savePassword} className="space-y-3 p-4">
            <Field label="New password">
              <input
                type="password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass()}
              />
            </Field>
            <Button type="submit" disabled={busy}>
              Update password
            </Button>
          </form>
        </Panel>

        <Panel>
          <PanelHeader title="Session" />
          <div className="p-4">
            <Button
              variant="outline"
              onClick={async () => {
                await signOut();
                void navigate({ to: "/", replace: true });
              }}
            >
              Sign out
            </Button>
          </div>
        </Panel>
      </div>
    </RequireRole>
  );
}
