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
import { safeReturnPath } from "@/lib/auth";
import type { User } from "@/lib/types";

export default function LoginForm({ admin = false }: { admin?: boolean }) {
  return (
    <Suspense fallback={<CircularProgress aria-label="Loading sign-in" />}>
      <LoginContent admin={admin} />
    </Suspense>
  );
}

function LoginContent({ admin }: { admin: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: userLoading, error: authError, acceptAuthentication } = useCurrentUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const returnTo = safeReturnPath(searchParams.get("returnTo"), admin ? "/admin" : "/");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const authenticatedUser = await apiFetch<User>(admin ? "/api/auth/admin/login" : "/api/auth/login", {
        method: "POST",
        body: admin ? { username: email, password } : { email, password },
      });
      acceptAuthentication(authenticatedUser);
      router.replace(returnTo);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box sx={{ display: "grid", placeItems: "center", minHeight: "60vh", py: 4 }}>
      <Paper variant="outlined" sx={{ width: "100%", maxWidth: 460, p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
        <Stack spacing={2.5}>
          <div>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>{admin ? "Administrator sign in" : "Welcome back"}</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              {admin ? "Manage listings, student accounts and marketplace rules." : "Sign in to your Rutgers Campus Marketplace account."}
            </Typography>
          </div>

          {(error || authError) && <Alert severity="error">{error || authError}</Alert>}

          {userLoading ? (
            <CircularProgress aria-label="Checking sign-in status" />
          ) : user ? (
            <>
              <Alert severity="success">You’re signed in as {user.name}.</Alert>
              <Button variant="contained" onClick={() => router.replace(admin && user.role !== "admin" ? "/" : returnTo)}>{admin && user.role === "admin" ? "Continue to administration" : "Continue to marketplace"}</Button>
            </>
          ) : (
            <Box component="form" onSubmit={submit}>
              <Stack spacing={2}>
                <TextField
                  label={admin ? "Username" : "Rutgers email"}
                  type={admin ? "text" : "email"}
                  autoComplete={admin ? "username" : "email"}
                  required
                  fullWidth
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <TextField
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  required
                  fullWidth
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <Button type="submit" variant="contained" size="large" disabled={submitting}>
                  {submitting ? "Signing in…" : "Sign in"}
                </Button>
                {!admin && <Typography variant="body2" align="center" color="text.secondary">
                  Don’t have an account?{" "}
                  <LinkMui component={Link} href={signupHref(returnTo)} underline="hover">
                    Create one
                  </LinkMui>
                </Typography>}
              </Stack>
            </Box>
          )}
          <Typography variant="body2" align="center">
            {admin ? <LinkMui component={Link} href="/login">Student sign in</LinkMui> : <>Admin? <LinkMui component={Link} href="/admin/login">login here</LinkMui></>}
          </Typography>
          <LinkMui component={Link} href="/" align="center">Continue browsing as a viewer</LinkMui>
        </Stack>
      </Paper>
    </Box>
  );
}

function signupHref(returnTo: string) {
  return returnTo === "/" ? "/signup" : `/signup?returnTo=${encodeURIComponent(returnTo)}`;
}
