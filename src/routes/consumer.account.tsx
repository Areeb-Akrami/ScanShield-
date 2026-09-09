import { useSession } from "@/components/AppShell";
import {
  changeMyPassword,
  deleteNotification,
  getMyProfile,
  listMyNotifications,
  markNotificationRead,
  updateMyProfile,
  type NotificationRow,
} from "@/lib/consumer";
import { signOut } from "@/lib/auth";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, LogOut, ShieldCheck, User } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/consumer/account")({
  head: () => ({
    meta: [
      { title: "My account — ScanShield" },
      { name: "description", content: "Update your ScanShield profile, change your password and manage your notifications." },
      { property: "og:title", content: "My account — ScanShield" },
      { property: "og:description", content: "Consumer profile, password and notification settings." },
    ],
  }),
  component: AccountPage,
});

const inputCls =
  "w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">{children}</section>;
}

function AccountPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [district, setDistrict] = useState("");
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [notes, setNotes] = useState<NotificationRow[]>([]);

  useEffect(() => {
    void getMyProfile().then((p) => {
      if (!p) return;
      setName(p.full_name ?? "");
      setPhone(p.phone ?? "");
      setDistrict(p.district ?? "");
    });
    void listMyNotifications().then(setNotes);
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const res = await updateMyProfile({ full_name: name, phone, district, email: null });
    setProfileMsg(res.error ? res.error : "Profile saved.");
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setPwdMsg("Use at least 8 characters.");
      return;
    }
    const res = await changeMyPassword(password);
    setPassword("");
    setPwdMsg(res.error ? res.error : "Password changed.");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight">My account</h1>

      <Card>
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
          <User className="h-4 w-4" /> Profile
        </h2>
        <form onSubmit={saveProfile} className="mt-3 space-y-3">
          <label className="block text-sm font-medium">
            Full name
            <input value={name} onChange={(e) => setName(e.target.value)} className={`mt-1.5 ${inputCls}`} />
          </label>
          <label className="block text-sm font-medium">
            Phone
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={`mt-1.5 ${inputCls}`} />
          </label>
          <label className="block text-sm font-medium">
            District
            <input value={district} onChange={(e) => setDistrict(e.target.value)} className={`mt-1.5 ${inputCls}`} />
          </label>
          <p className="text-xs text-muted-foreground">Signed in as {session?.email}</p>
          <button className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground">
            Save profile
          </button>
          {profileMsg ? <p className="text-sm text-muted-foreground">{profileMsg}</p> : null}
        </form>
      </Card>

      <Card>
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4" /> Change password
        </h2>
        <form onSubmit={savePassword} className="mt-3 space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            className={inputCls}
          />
          <button className="min-h-11 rounded-xl border border-border px-5 text-sm font-semibold">Update password</button>
          {pwdMsg ? <p className="text-sm text-muted-foreground">{pwdMsg}</p> : null}
        </form>
      </Card>

      <Card>
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
          <Bell className="h-4 w-4" /> Notifications
        </h2>
        {notes.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">You have no notifications.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-xl border border-border px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{n.title ?? "Notification"}</p>
                    <p className="text-xs text-muted-foreground">{n.message}</p>
                  </div>
                  <div className="flex shrink-0 gap-2 text-xs">
                    {!n.read ? (
                      <button
                        onClick={async () => {
                          await markNotificationRead(n.id);
                          setNotes(await listMyNotifications());
                        }}
                        className="underline underline-offset-2"
                      >
                        Mark read
                      </button>
                    ) : null}
                    <button
                      onClick={async () => {
                        await deleteNotification(n.id);
                        setNotes(await listMyNotifications());
                      }}
                      className="text-muted-foreground underline underline-offset-2"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <button
        onClick={() => void signOut().then(() => navigate({ to: "/", replace: true }))}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
      <p className="text-center text-[11px] text-muted-foreground/70">Hackathon demo environment</p>
    </div>
  );
}
