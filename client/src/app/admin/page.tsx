"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Pagination, Paper, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import Link from "next/link";
import AuthGate from "@/components/AuthGate";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import type { Listing, ManagedUser, MarketplaceRules, QueuedFlag, FlagStatus } from "@/lib/types";
import { FLAG_REASON_LABELS } from "@/lib/types";

type Section = "flags" | "listings" | "users" | "rules";
type FlagAction = "dismiss" | "remove" | "suspend";
type ManagementData = { listings?: Listing[]; users?: ManagedUser[]; flags?: QueuedFlag[]; totalPages?: number; content?: string };
const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : "Something went wrong. Please try again.";

export default function AdminPage() { return <AuthGate admin><AdminDashboard /></AuthGate>; }
function AdminDashboard() {
  const [section, setSection] = useState<Section>("flags");
  const [flagStatus, setFlagStatus] = useState<FlagStatus>("open");
  const [pendingFlag, setPendingFlag] = useState<{ flag: QueuedFlag; action: FlagAction } | null>(null);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ManagementData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState("");
  const [editing, setEditing] = useState<Listing | null>(null);
  const [target, setTarget] = useState<ManagedUser | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => { setData(null); setRevision((value) => value + 1); }, []);
  useEffect(() => {
    const controller = new AbortController();
    apiFetch<ManagementData>(section === "rules" ? "/api/rules" : section === "flags" ? `/api/admin/flags?page=${page}&status=${flagStatus}` : `/api/admin/${section}?page=${page}`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) { setData(result); if (section === "rules") setRules(result.content ?? ""); } })
      .catch((cause) => { if (!controller.signal.aborted) setError(errorMessage(cause)); });
    return () => controller.abort();
  }, [section, page, revision, flagStatus]);
  async function perform(action: () => Promise<unknown>, message: string) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(message); setEditing(null); setTarget(null); setPendingFlag(null); refresh(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  function saveListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const { title, description, price, category, condition, status } = editing;
    void perform(() => apiFetch(`/api/admin/listings/${editing._id}`, { method: "PATCH", body: { title, description, price, category, condition, status } }), "Listing updated.");
  }
  return <>
    <PageHeader title="Administration" description="Review reports, and manage listings, student accounts and marketplace rules." />
    <Tabs value={section} onChange={(_, value: Section) => { setSection(value); setPage(1); setData(null); setError(""); setNotice(""); }} sx={{ mb: 3 }} aria-label="Administration sections">
      <Tab value="flags" label="Flagged" /><Tab value="listings" label="Listings" /><Tab value="users" label="Users" /><Tab value="rules" label="Rules" />
    </Tabs>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}<Button onClick={() => { setError(""); refresh(); }}>Retry</Button></Alert>}
    {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
    {!data && !error && <CircularProgress aria-label="Loading administration" />}
    {data && <Stack spacing={2}>
      {section === "flags" && <>
        <Tabs value={flagStatus} onChange={(_, value: FlagStatus) => { setFlagStatus(value); setPage(1); setData(null); }} textColor="secondary" indicatorColor="secondary" aria-label="Report status">
          <Tab value="open" label="Open" /><Tab value="dismissed" label="Dismissed" /><Tab value="actioned" label="Actioned" />
        </Tabs>
        {data.flags?.length ? data.flags.map((flag) => <Paper key={flag._id} variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
              <Chip size="small" color="error" variant="outlined" label={FLAG_REASON_LABELS[flag.reason]} />
              <Chip size="small" label={flag.targetType === "listing" ? "Listing" : "User"} />
              <Typography variant="body2" sx={{ color: "text.secondary", ml: "auto" }}>
                <time dateTime={flag.createdAt}>{new Date(flag.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>
              </Typography>
            </Stack>
            <Box sx={{ minWidth: 0 }}>
              <Typography component="h2" variant="h6" sx={{ overflowWrap: "anywhere" }}>
                {flag.target ? (flag.targetType === "listing" ? flag.target.title : flag.target.name) : "This item no longer exists"}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Reported by {flag.reporter?.name ?? "a deleted account"}
                {flag.target?.status ? ` · listing is ${flag.target.status}` : ""}
                {flag.target?.suspended ? " · account suspended" : ""}
              </Typography>
            </Box>
            {flag.note && <Typography sx={{ borderLeft: 2, borderColor: "divider", pl: 1.5, fontStyle: "italic", overflowWrap: "anywhere" }}>{flag.note}</Typography>}
            {flag.status === "open" && <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              {flag.target && <Button size="small" variant="outlined" component={Link} href={flag.targetType === "listing" ? `/listings/${flag.target._id}` : `/users/${flag.target._id}`}>
                View {flag.targetType}
              </Button>}
              <Button size="small" variant="contained" disabled={busy} onClick={() => setPendingFlag({ flag, action: "dismiss" })}>Dismiss</Button>
              {flag.targetType === "listing" && <Button size="small" color="error" disabled={busy} onClick={() => setPendingFlag({ flag, action: "remove" })}>Remove listing</Button>}
              <Button size="small" color="error" disabled={busy} onClick={() => setPendingFlag({ flag, action: "suspend" })}>
                Suspend {flag.targetType === "listing" ? "seller" : "user"}
              </Button>
            </Stack>}
          </Stack>
        </Paper>) : <EmptyState title={flagStatus === "open" ? "Nothing to review" : `No ${flagStatus} reports`} description={flagStatus === "open" ? "Reports from students show up here." : "Switch to the Open tab for reports still waiting."} />}
      </>}
      {section === "listings" && (data.listings?.length ? data.listings.map((listing) => <Paper key={listing._id} variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ minWidth: 0 }}><Typography component="h2" variant="h6" sx={{ overflowWrap: "anywhere" }}>{listing.title}</Typography><Typography>${listing.price.toFixed(2)} · {listing.category}</Typography><Chip size="small" label={listing.status} /></Box>
          <Button variant="outlined" onClick={() => setEditing(listing)}>Edit</Button>
        </Stack>
      </Paper>) : <Typography>No listings yet.</Typography>)}
      {section === "users" && (data.users?.length ? data.users.map((user) => <Paper key={user._id} variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
          <Box><Typography component="h2" variant="h6">{user.name}</Typography><Typography sx={{ overflowWrap: "anywhere" }}>{user.email ?? user.username}</Typography><Typography>{user.role} · {user.suspended ? "Suspended" : "Active"}</Typography></Box>
          {user.role !== "admin" && <Button color={user.suspended ? "primary" : "error"} disabled={busy} onClick={() => setTarget(user)}>{user.suspended ? "Restore access" : "Suspend"}</Button>}
        </Stack>
      </Paper>) : <Typography>No users found.</Typography>)}
      {section !== "rules" && (data.totalPages ?? 0) > 1 && <Pagination page={page} count={data.totalPages} onChange={(_, value) => { setPage(value); setData(null); }} />}
      {section === "rules" && <Box component="form" onSubmit={(event) => { event.preventDefault(); void perform(() => apiFetch<MarketplaceRules>("/api/admin/rules", { method: "PUT", body: { content: rules } }), "Rules published."); }}>
        <Stack spacing={2}><TextField label="Marketplace rules" multiline minRows={10} required fullWidth value={rules} onChange={(event) => setRules(event.target.value)} slotProps={{ htmlInput: { maxLength: 10000 } }} helperText="Published rules are visible to everyone. Plain text, up to 10,000 characters." /><Button type="submit" variant="contained" disabled={busy || !rules.trim()}>Publish rules</Button></Stack>
      </Box>}
    </Stack>}
    <Dialog open={!!editing} onClose={() => { if (!busy) setEditing(null); }} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={saveListing}><DialogTitle>Edit listing</DialogTitle><DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {editing && <>
            <TextField label="Title" required value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} slotProps={{ htmlInput: { maxLength: 120 } }} />
            <TextField label="Description" required multiline minRows={3} value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} slotProps={{ htmlInput: { maxLength: 5000 } }} />
            <TextField label="Price" type="number" required value={Number.isNaN(editing.price) ? "" : editing.price} onChange={(event) => setEditing({ ...editing, price: event.target.value === "" ? NaN : Number(event.target.value) })} slotProps={{ htmlInput: { min: 0, step: "0.01" } }} />
            <TextField label="Category" required value={editing.category} onChange={(event) => setEditing({ ...editing, category: event.target.value })} slotProps={{ htmlInput: { maxLength: 80 } }} />
            <TextField select label="Condition" value={editing.condition} onChange={(event) => setEditing({ ...editing, condition: event.target.value as Listing["condition"] })}>{["new", "like_new", "good", "fair"].map((value) => <MenuItem key={value} value={value}>{value.replaceAll("_", " ")}</MenuItem>)}</TextField>
            <TextField select label="Status" value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value as Listing["status"] })} helperText="Removed listings disappear from public browsing.">{["active", "sold", "removed"].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
          </>}
        </Stack>
      </DialogContent><DialogActions><Button disabled={busy} onClick={() => setEditing(null)}>Cancel</Button><Button disabled={busy} type="submit" variant="contained">Save changes</Button></DialogActions></Box>
    </Dialog>
    <Dialog open={!!target} onClose={() => { if (!busy) setTarget(null); }}><DialogTitle>{target?.suspended ? "Restore account access?" : "Suspend account?"}</DialogTitle><DialogContent>
      {error && <Alert severity="error">{error}</Alert>}
      <Typography>{target?.name} {target?.suspended ? "will be able to sign in again." : "will lose access to posting and messaging. They can still browse publicly."}</Typography>
    </DialogContent><DialogActions><Button disabled={busy} onClick={() => setTarget(null)}>Cancel</Button><Button disabled={busy} onClick={() => { if (target) void perform(() => apiFetch(`/api/admin/users/${target._id}`, { method: "PATCH", body: { suspended: !target.suspended } }), "Account updated."); }}>Confirm</Button></DialogActions></Dialog>
    <Dialog open={!!pendingFlag} onClose={() => { if (!busy) setPendingFlag(null); }} fullWidth maxWidth="xs">
      <DialogTitle>
        {pendingFlag?.action === "dismiss" ? "Dismiss this report?" : pendingFlag?.action === "remove" ? "Remove this listing?" : "Suspend this account?"}
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error">{error}</Alert>}
        <Typography>
          {pendingFlag?.action === "dismiss" && "The report is closed and nothing else changes."}
          {pendingFlag?.action === "remove" && "The listing disappears from browsing and saved lists. The report is closed."}
          {pendingFlag?.action === "suspend" && "They lose access to signing in and messaging, and their active listings are hidden. The report is closed."}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={() => setPendingFlag(null)}>Cancel</Button>
        <Button disabled={busy} color={pendingFlag?.action === "dismiss" ? "primary" : "error"} onClick={() => {
          if (pendingFlag) void perform(() => apiFetch(`/api/admin/flags/${pendingFlag.flag._id}`, { method: "PATCH", body: { action: pendingFlag.action } }), "Report resolved.");
        }}>Confirm</Button>
      </DialogActions>
    </Dialog>
  </>;
}
