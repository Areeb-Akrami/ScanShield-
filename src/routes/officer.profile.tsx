import { useSession } from "@/components/AppShell";
import { Button, Field, Panel, PanelHeader, Stat, inputClass } from "@/components/ui";
import { signOut } from "@/lib/auth";
import { getMyProfile, updateMyProfile, type ConsumerProfile } from "@/lib/consumer";
import { listCases, listRecentDecisions } from "@/lib/officer";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/officer/profile")({
  head: () => ({
    meta: [
      { title: "Officer profile — ScanShield" },
      { name: "description", content: "Enforcement officer identity, jurisdiction, contact details and personal decision statistics." },
      { property: "og:title", content: "Officer profile — ScanShield" },
      { property: "og:description", content: "Officer identity, jurisdiction and decision statistics." },
    ],
  }),
  component: OfficerProfile,
});

function OfficerProfile() {
  const session = useSession();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ConsumerProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [caseLoad, setCaseLoad] = useState(0);
  const [myDecisions, setMyDecisions] = useState(0);

  useEffect(() => {
    void getMyProfile().then(setProfile);
    void listCases().then((c) => setCaseLoad(c.length));
    void listRecentDecisions(100).then((d) => setMyDecisions(d.filter((x) => x.officer === session?.name || x.officer === session?.email).length));
  }, [session?.name, session?.email]);

  async function save() {
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    const res = await updateMyProfile(profile);
    setSaving(false);
    setMessage(res.error ? res.error : "Profile saved.");
  }

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Officer details" />
        <dl className="divide-y divide-border text-sm">
          {[
            ["Official email", session?.email],
            ["Role", session?.role.replaceAll("_", " ").toLowerCase()],
            ["Employee ID", session?.employeeId ?? "—"],
            ["Department", session?.department ?? "—"],
            ["Jurisdiction", session?.district],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium">{v ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Visible cases" value={caseLoad} />
        <Stat label="My recent decisions" value={myDecisions} hint="of the last 100 recorded" />
      </div>

      <Panel>
        <PanelHeader title="Contact details" subtitle="Kept up to date for departmental correspondence." />
        <div className="space-y-3 p-4">
          <Field label="Full name">
            <input
              className={inputClass()}
              value={profile?.full_name ?? ""}
              onChange={(e) => setProfile({ ...(profile ?? {}), full_name: e.target.value } as ConsumerProfile)}
            />
          </Field>
          <Field label="Phone">
            <input
              className={inputClass()}
              value={profile?.phone ?? ""}
              onChange={(e) => setProfile({ ...(profile ?? {}), phone: e.target.value } as ConsumerProfile)}
            />
          </Field>
          <Field label="District">
            <input
              className={inputClass()}
              value={profile?.district ?? ""}
              onChange={(e) => setProfile({ ...(profile ?? {}), district: e.target.value } as ConsumerProfile)}
            />
          </Field>
          <Button disabled={saving || !profile} onClick={() => void save()}>
            {saving ? "Saving…" : "Save details"}
          </Button>
          {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
        </div>
      </Panel>

      <Button
        variant="outline"
        onClick={() => {
          void signOut();
          navigate({ to: "/" });
        }}
      >
        Sign out
      </Button>
    </div>
  );
}
