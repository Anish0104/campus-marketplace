"use client";

import { useState, type FormEvent } from "react";
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  MenuItem, Stack, TextField,
} from "@mui/material";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import { apiFetch, ApiError } from "@/lib/api";
import { FLAG_REASONS, FLAG_REASON_LABELS, type FlagReason, type FlagTargetType } from "@/lib/types";

const NOTE_MAX = 1000;

type Props = {
  targetType: FlagTargetType;
  targetId: string;
  /** Hidden for your own listing or profile, where reporting is refused anyway. */
  ownerId?: string;
};

/**
 * Reports a listing or a user. Shown on listing detail and on profiles.
 * Signed-out visitors and owners do not see it.
 */
export default function ReportButton({ targetType, targetId, ownerId }: Props) {
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<FlagReason>("scam");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!user || (ownerId && ownerId === user.id)) return null;

  function close() {
    setOpen(false);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/flags", {
        method: "POST",
        body: { targetType, target: targetId, reason, note: note.trim() },
      });
      setDone(true);
      setOpen(false);
      setNote("");
    } catch (cause) {
      // 409 means this person already reported it, which is not a failure worth
      // an alarming message.
      if (cause instanceof ApiError && cause.status === 409) {
        setDone(true);
        setOpen(false);
      } else {
        setError(cause instanceof Error ? cause.message : "Could not send the report. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Alert severity="success" sx={{ mt: 1 }}>
        Thanks. An administrator will review this.
      </Alert>
    );
  }

  return (
    <>
      <Button
        size="small"
        color="inherit"
        startIcon={<FlagOutlinedIcon />}
        onClick={() => setOpen(true)}
sx={{ opacity: 0.75 }}
      >
        Report
      </Button>

      <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
        <form onSubmit={submit}>
          <DialogTitle>Report this {targetType}</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              Tell us what is wrong. An administrator reviews every report.
            </DialogContentText>
            <Stack spacing={2}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                select
                id="report-reason"
                label="Reason"
                value={reason}
                onChange={(event) => setReason(event.target.value as FlagReason)}
                fullWidth
              >
                {FLAG_REASONS.map((value) => (
                  <MenuItem key={value} value={value}>{FLAG_REASON_LABELS[value]}</MenuItem>
                ))}
              </TextField>
              <TextField
                id="report-note"
                label="Anything to add? (optional)"
                value={note}
                onChange={(event) => setNote(event.target.value.slice(0, NOTE_MAX))}
                helperText={`${note.length} / ${NOTE_MAX}`}
                multiline
                minRows={3}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={close} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? "Sending…" : "Send report"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
