"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import LinkMui from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import { ApiError, apiFetch } from "@/lib/api";
import type { User } from "@/lib/types";

const PASSWORD_MIN_LENGTH = 8;

export default function SignupPage() {
  return (
    <Suspense fallback={<CircularProgress aria-label="Loading sign-up" />}>
      <SignupContent />
    </Suspense>
  );
}

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: userLoading, error: authError, acceptAuthentication } = useCurrentUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const returnTo = safeReturnPath(searchParams.get("returnTo"));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }

    setSubmitting(true);
    try {
      const authenticatedUser = await apiFetch<User>("/api/auth/register", {
        method: "POST",
        body: { name, email, password },
      });
      acceptAuthentication(authenticatedUser);
      router.replace(returnTo);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not create your account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box sx={{ display: "grid", placeItems: "center", minHeight: "60vh", py: 4 }}>
      <Paper variant="outlined" sx={{ width: "100%", maxWidth: 480, p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
        <Stack spacing={2.5}>
          <div>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>Create your account</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              Join the marketplace for Rutgers students.
            </Typography>
          </div>

          {(error || authError) && <Alert severity="error">{error || authError}</Alert>}

          {userLoading ? (
            <CircularProgress aria-label="Checking sign-in status" />
          ) : user ? (
            <>
              <Alert severity="success">You’re signed in as {user.name}.</Alert>
              <Button variant="contained" onClick={() => router.replace(returnTo)}>Continue to marketplace</Button>
            </>
          ) : (
            <Box component="form" onSubmit={submit}>
              <Stack spacing={2}>
                <TextField
                  label="Full name"
                  autoComplete="name"
                  required
                  fullWidth
                  slotProps={{ htmlInput: { maxLength: 120 } }}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <TextField
                  label="Rutgers email"
                  type="email"
                  autoComplete="email"
                  required
                  fullWidth
                  helperText="Use your @rutgers.edu or @scarletmail.rutgers.edu address. Email ownership is not verified yet."
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <TextField
                  label="Password"
                  type="password"
                  autoComplete="new-password"
                  required
                  fullWidth
                  slotProps={{ htmlInput: { minLength: PASSWORD_MIN_LENGTH, maxLength: 128 } }}
                  helperText={`Use at least ${PASSWORD_MIN_LENGTH} characters (72-byte maximum).`}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <TextField
                  label="Confirm password"
                  type="password"
                  autoComplete="new-password"
                  required
                  fullWidth
                  slotProps={{ htmlInput: { maxLength: 128 } }}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                <Button type="submit" variant="contained" size="large" disabled={submitting}>
                  {submitting ? "Creating account…" : "Create account"}
                </Button>
                <Typography variant="body2" align="center" color="text.secondary">
                  Already have an account?{" "}
                  <LinkMui
                    component={Link}
                    href={returnTo === "/" ? "/login" : `/login?returnTo=${encodeURIComponent(returnTo)}`}
                    underline="hover"
                  >
                    Sign in
                  </LinkMui>
                </Typography>
              </Stack>
            </Box>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}

function safeReturnPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/";
}
