import { useEffect, useRef, useState } from "react";
import { ChevronDown, CircleHelp, LogOut, Monitor, Moon, Save, Sun, Trash2, UserRound, X } from "lucide-react";
import { useAuth } from "../lib/authContext";
import { isStarterPreview } from "../lib/starterPreview";
import type { ThemePreference } from "../lib/themePreference";

type View = "profile" | "help" | null;
const profileFieldClass = "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900 outline-none placeholder:text-slate-400 focus:border-lagoon focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-600 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500";

export function ProfileMenu({ theme, onTheme }: {
  theme: ThemePreference;
  onTheme: (theme: ThemePreference) => void;
}) {
  const preview = isStarterPreview();
  const { user, updateProfile, signOut, deleteAccount } = useAuth();
  const personalAccount = !preview && !user.sharedWorkspace;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>(null);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [pictureUrl, setPictureUrl] = useState(user.pictureUrl);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function show(next: View) { setView(next); setOpen(false); setMessage(""); }
  async function saveProfile() {
    setWorking(true); setMessage("");
    try { await updateProfile({ name, phone, pictureUrl }); setMessage("Profile saved."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save profile."); }
    finally { setWorking(false); }
  }
  async function removeAccount() {
    setWorking(true); setMessage("");
    try { await deleteAccount(deleteConfirmation); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to delete the account."); }
    finally { setWorking(false); }
  }

  return <div className="relative" ref={menuRef}>
    <button type="button" className="text-button min-w-0 gap-2 px-2" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Open profile menu">
      {user.pictureUrl ? <img className="h-7 w-7 shrink-0 rounded-full object-cover" src={user.pictureUrl} alt="" referrerPolicy="no-referrer" /> : <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-mist text-xs font-bold text-lagoon">{user.name.slice(0, 1).toUpperCase()}</span>}
      <span className="hidden max-w-28 truncate text-left xl:block"><span className="block truncate text-xs font-semibold">{user.name}</span><span className="block text-[10px] capitalize text-slate-400">{preview ? "Starter workspace" : user.sharedWorkspace ? "Workspace" : user.role}</span></span><ChevronDown size={14} />
    </button>
    {open && <div className="absolute right-0 z-[80] mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800"><p className="truncate text-sm font-semibold text-ink dark:text-white">{user.name}</p><p className="truncate text-xs text-slate-500">{user.sharedWorkspace ? "Shared workspace" : user.email}</p></div>
      {personalAccount && <MenuButton icon={UserRound} label="My profile" onClick={() => show("profile")} />}
      <div className="my-1 border-t border-slate-100 pt-2 dark:border-slate-800"><p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Appearance</p><div className="mt-2 grid grid-cols-3 gap-1">{([{ id: "light", label: "Light", icon: Sun }, { id: "dark", label: "Dark", icon: Moon }, { id: "system", label: "System", icon: Monitor }] as const).map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => onTheme(id)} className={`rounded-lg border px-2 py-2 text-xs font-semibold ${theme === id ? "border-lagoon bg-mist text-lagoon dark:bg-cyan-500/15" : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-800"}`}><Icon className="mx-auto mb-1" size={15} />{label}</button>)}</div></div>
      <MenuButton icon={CircleHelp} label="Help & instructions" onClick={() => show("help")} />
      {personalAccount && <button type="button" className="mt-1 flex w-full items-center gap-3 border-t border-slate-100 px-3 py-3 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:border-slate-800 dark:hover:bg-rose-500/10" onClick={() => void signOut()}><LogOut size={17} />Sign out</button>}
    </div>}
    {view && <div className="fixed inset-0 z-[100] grid place-items-center bg-ink/55 p-4" role="dialog" aria-modal="true"><section className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-ink dark:text-white">{view === "profile" ? "My profile" : view === "help" ? "Help & instructions" : "Report a problem"}</h2><button className="icon-button" onClick={() => setView(null)} aria-label="Close"><X size={17} /></button></div>
      {view === "profile" && <div className="mt-5 space-y-4"><label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Display name<input className={profileFieldClass} value={name} onChange={(event) => setName(event.target.value)} /></label><label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Phone<input className={profileFieldClass} type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Optional" /></label><label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Profile photo URL<input className={profileFieldClass} type="url" value={pictureUrl} onChange={(event) => setPictureUrl(event.target.value)} placeholder="https://..." /></label><p className="text-xs text-slate-500 dark:text-slate-400">Your email and account role are managed by sign-in and cannot be changed here.</p><button className="primary-button w-full gap-2" disabled={working} onClick={() => void saveProfile()}><Save size={16} />{working ? "Saving..." : "Save profile"}</button>{personalAccount && <div className="border-t border-rose-200 pt-4 dark:border-rose-900/60"><h3 className="text-sm font-bold text-rose-700 dark:text-rose-300">Delete account</h3><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Permanently removes your sign-in and personal profile information. Business and payment records may be retained as anonymized company records.</p>{confirmingDelete ? <div className="mt-3 space-y-3"><label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Type DELETE to confirm<input className={profileFieldClass} value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" /></label><div className="flex gap-2"><button type="button" className="text-button flex-1" disabled={working} onClick={() => { setConfirmingDelete(false); setDeleteConfirmation(""); setMessage(""); }}>Cancel</button><button type="button" className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={working || deleteConfirmation !== "DELETE"} onClick={() => void removeAccount()}><Trash2 size={16} />{working ? "Deleting..." : "Delete forever"}</button></div></div> : <button type="button" className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-rose-300 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/30" onClick={() => setConfirmingDelete(true)}><Trash2 size={16} />Delete my account</button>}</div>}</div>}
      {view === "help" && <div className="mt-5 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300"><p><strong>Jobs:</strong> create and edit your work.</p><p><strong>Calendar:</strong> plan jobs and meetings.</p><p><strong>Service Plans:</strong> manage recurring customers and upcoming service dates.</p><p><strong>Refresh:</strong> reload your latest business records.</p></div>}
      {message && <p className="mt-4 rounded-lg bg-mist p-3 text-sm font-medium text-lagoon dark:bg-cyan-500/10 dark:text-cyan-200">{message}</p>}
    </section></div>}
  </div>;
}

function MenuButton({ icon: Icon, label, onClick }: { icon: typeof UserRound; label: string; onClick: () => void }) { return <button type="button" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800" onClick={onClick}><Icon size={17} className="text-lagoon" />{label}</button>; }
