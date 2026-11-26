"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, MenuItem, Stack, TextField } from "@mui/material";
import { CONDITION_LABELS } from "@/components/ConditionChip";
import { deleteListing, editListing, LISTING_LIMITS, markListingSold } from "@/lib/listings";
import type { Condition, Listing } from "@/lib/types";

export default function ListingManagement({ listing, onUpdated }: { listing: Listing; onUpdated: (listing: Listing) => void }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"edit" | "sold" | "delete" | null>(null);
  const [fields, setFields] = useState({ title: listing.title, description: listing.description, category: listing.category, price: String(listing.price), condition: listing.condition });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof fields, string>>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  function open(action: typeof dialog) {
    setFields({ title: listing.title, description: listing.description, category: listing.category, price: String(listing.price), condition: listing.condition });
    setErrors({}); setError(""); setSuccess(""); setDialog(action);
  }
  function close() { if (!locked.current) setDialog(null); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current || !dialog) return;
    if (dialog === "edit") {
      const invalid: typeof errors = {};
      for (const field of ["title", "description", "category"] as const) {
        if (!fields[field].trim()) invalid[field] = `Enter a ${field}.`;
        else if (fields[field].trim().length > LISTING_LIMITS[field]) invalid[field] = `Use at most ${LISTING_LIMITS[field]} characters.`;
      }
      if (!fields.price.trim() || !Number.isFinite(Number(fields.price)) || Number(fields.price) < 0) invalid.price = "Enter a valid price of $0 or more.";
      if (!(fields.condition in CONDITION_LABELS)) invalid.condition = "Choose a condition.";
      setErrors(invalid);
      if (Object.keys(invalid).length) { document.getElementById(`edit-${Object.keys(invalid)[0]}`)?.focus(); return; }
    }
    locked.current = true; setBusy(true); setError("");
    try {
      const updated = dialog === "edit" ? await editListing(listing._id, { ...fields, price: Number(fields.price) })
        : dialog === "sold" ? await markListingSold(listing._id) : await deleteListing(listing._id);
      if (!mounted.current) return;
      if (dialog === "delete") { router.replace("/"); router.refresh(); return; }
      onUpdated(updated);
      setSuccess(dialog === "edit" ? "Listing updated." : "Listing marked as sold.");
      setDialog(null);
    } catch (cause) {
      if (mounted.current) setError((cause instanceof Error ? cause.message : "Could not update listing.") + " Refresh the listing before retrying if its status or your account has changed.");
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const title = dialog === "edit" ? "Edit listing" : dialog === "sold" ? "Mark listing as sold?" : "Delete listing?";
  return <Stack spacing={1.5}>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
      <Button variant="outlined" disabled={busy} onClick={() => open("edit")}>Edit listing</Button>
      {listing.status === "active" && <Button variant="outlined" disabled={busy} onClick={() => open("sold")}>Mark as sold</Button>}
      <Button color="error" disabled={busy} onClick={() => open("delete")}>Delete listing</Button>
    </Stack>
    {success && <Alert severity="success">{success}</Alert>}
    <Dialog open={dialog !== null} onClose={close} fullWidth maxWidth="sm" aria-labelledby="manage-listing-title">
      <Box component="form" noValidate onSubmit={submit} aria-busy={busy}>
        <DialogTitle id="manage-listing-title">{title}</DialogTitle>
        <DialogContent>
          {dialog === "edit" ? <Stack spacing={2.5} sx={{ pt: 1 }}>
            {(["title", "description", "category"] as const).map((field) => <TextField key={field} id={`edit-${field}`} label={field[0].toUpperCase() + field.slice(1)} fullWidth required disabled={busy} value={fields[field]} multiline={field === "description"} minRows={field === "description" ? 4 : undefined} slotProps={{ htmlInput: { maxLength: LISTING_LIMITS[field] } }} onChange={(e) => { setFields({ ...fields, [field]: e.target.value }); setErrors({ ...errors, [field]: undefined }); }} error={!!errors[field]} helperText={errors[field]} />)}
            <TextField id="edit-price" label="Price (USD)" required type="number" disabled={busy} value={fields.price} onChange={(e) => { setFields({ ...fields, price: e.target.value }); setErrors({ ...errors, price: undefined }); }} error={!!errors.price} helperText={errors.price ?? "Enter 0 to offer it for free."} slotProps={{ htmlInput: { min: 0, step: "any", inputMode: "decimal" } }} />
            <TextField id="edit-condition" label="Condition" select required disabled={busy} value={fields.condition} onChange={(e) => setFields({ ...fields, condition: e.target.value as Condition })} error={!!errors.condition} helperText={errors.condition}>
              {Object.entries(CONDITION_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </TextField>
            <DialogContentText>Your existing photos and listing status will be preserved.</DialogContentText>
          </Stack> : <DialogContentText>{dialog === "sold" ? "This item will leave the active feed. Its details and existing conversations will remain available. You cannot relist it from this page." : "This listing will be hidden from the marketplace and its detail link will become unavailable. Existing conversations will remain available. You cannot restore it from this page."}</DialogContentText>}
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={close}>Cancel</Button>
          <Button type="submit" variant="contained" color={dialog === "delete" ? "error" : "primary"} disabled={busy}>{busy ? "Saving…" : dialog === "edit" ? "Save changes" : dialog === "sold" ? "Mark as sold" : "Delete listing"}</Button>
        </DialogActions>
      </Box>
    </Dialog>
  </Stack>;
}
