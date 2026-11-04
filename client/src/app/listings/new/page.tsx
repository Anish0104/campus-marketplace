"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Box, Button, CircularProgress, Divider, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import PageHeader from "@/components/PageHeader";
import { CONDITION_LABELS } from "@/components/ConditionChip";
import { ApiError } from "@/lib/api";
import { createListing, LISTING_LIMITS, PHOTO_TYPES, uploadListingPhotos } from "@/lib/listings";
import type { Condition } from "@/lib/types";
import { tokens } from "@/theme/tokens";

type Photo = { file: File; url: string };
type Fields = { title: string; description: string; price: string; category: string; condition: Condition | "" };

export default function NewListingPage() {
  const { user } = useCurrentUser();
  const router = useRouter();
  const [formVersion, setFormVersion] = useState(0);

  function handleCreated(id: string) {
    // App Router may preserve this page. Replace the completed form so returning
    // restores a fresh draft, with fresh refs/file inputs and preview URL cleanup.
    setFormVersion((version) => version + 1);
    router.push(`/listings/${id}`);
  }

  return <NewListingForm key={`${user?.id ?? "signed-out"}:${formVersion}`} userId={user?.id} onCreated={handleCreated} />;
}

function NewListingForm({ userId, onCreated }: { userId?: string; onCreated: (id: string) => void }) {
  const [fields, setFields] = useState<Fields>({ title: "", description: "", price: "", category: "", condition: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoError, setPhotoError] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"idle" | "uploading" | "creating">("idle");
  const locked = useRef(false);
  const mounted = useRef(false);
  const urls = useRef(new Set<string>());
  const errorAlert = useRef<HTMLDivElement>(null);
  const busy = phase !== "idle";

  useEffect(() => {
    mounted.current = true;
    const activeUrls = urls.current;
    return () => {
      mounted.current = false;
      activeUrls.forEach((url) => URL.revokeObjectURL(url));
      activeUrls.clear();
    };
  }, []);
  useEffect(() => { if (error) errorAlert.current?.focus(); }, [error]);

  function change(field: keyof Fields, value: string) {
    setFields((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function selectPhotos(event: ChangeEvent<HTMLInputElement>, replaceIndex?: number) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length || busy) return;
    if ((replaceIndex === undefined ? photos.length + files.length : photos.length) > LISTING_LIMITS.photos) {
      setPhotoError("Choose up to five photos. Remove a photo before adding more.");
      return;
    }
    for (const file of files) {
      if (!PHOTO_TYPES.includes(file.type)) {
        setPhotoError(`${file.name}: choose a JPEG, PNG, or WebP image.`);
        return;
      }
      if (file.size === 0 || file.size > LISTING_LIMITS.photoBytes) {
        setPhotoError(`${file.name}: each image must be nonempty and at most 5 MiB.`);
        return;
      }
    }
    const added = files.map((file) => {
      const url = URL.createObjectURL(file);
      urls.current.add(url);
      return { file, url };
    });
    if (replaceIndex !== undefined) {
      const old = photos[replaceIndex];
      URL.revokeObjectURL(old.url);
      urls.current.delete(old.url);
      setPhotos(photos.map((photo, index) => index === replaceIndex ? added[0] : photo));
    } else setPhotos([...photos, ...added]);
    setPhotoError("");
  }

  function removePhoto(index: number) {
    const photo = photos[index];
    URL.revokeObjectURL(photo.url);
    urls.current.delete(photo.url);
    setPhotos(photos.filter((_, i) => i !== index));
    setPhotoError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || locked.current) return;
    const invalid: typeof errors = {};
    for (const field of ["title", "description", "category"] as const) {
      if (!fields[field].trim()) invalid[field] = `Enter a ${field}.`;
      else if (fields[field].trim().length > LISTING_LIMITS[field]) invalid[field] = `Use at most ${LISTING_LIMITS[field]} characters.`;
    }
    const price = Number(fields.price);
    if (!fields.price.trim() || !Number.isFinite(price) || price < 0) invalid.price = "Enter a valid price of $0 or more.";
    if (!fields.condition || !(fields.condition in CONDITION_LABELS)) invalid.condition = "Choose the item's condition.";
    setErrors(invalid);
    setError("");
    if (Object.keys(invalid).length) {
      const first = Object.keys(invalid)[0];
      document.getElementById(`listing-${first}`)?.focus();
      return;
    }
    locked.current = true;
    try {
      let photoUploadId: string | undefined;
      if (photos.length) {
        setPhase("uploading");
        const uploaded = await uploadListingPhotos(userId, photos.map((photo) => photo.file));
        if (!mounted.current) return;
        if (Date.parse(uploaded.expiresAt) <= Date.now()) throw new ApiError("The photo upload expired. Submit again to upload fresh photos.", 400);
        photoUploadId = uploaded.photoUploadId;
      }
      setPhase("creating");
      const listing = await createListing(userId, {
        title: fields.title.trim(), description: fields.description.trim(), price,
        category: fields.category.trim(), condition: fields.condition as Condition,
        ...(photoUploadId ? { photoUploadId } : {}),
      });
      if (!mounted.current) return;
      onCreated(listing._id);
    } catch (cause) {
      if (!mounted.current) return;
      const message = cause instanceof Error ? cause.message : "Something went wrong.";
      const hint = cause instanceof ApiError && cause.status === 401
        ? " Select a test account or sign in, then try again."
        : cause instanceof ApiError && cause.status === 0
          ? " Your request may have reached the server; check before submitting again."
          : " Your form is preserved. Check the fields and photos, then submit again; selected photos will be uploaded afresh.";
      setError(message + hint);
      setPhase("idle");
      locked.current = false;
    }
  }

  return (
    <>
      <PageHeader title="New listing" description="Give something a second home on campus." />
      {!userId && <Alert severity="info" sx={{ mb: 2 }}>Sign in or select a test account to create a listing.</Alert>}
      <Box component="form" noValidate onSubmit={submit} aria-busy={busy} sx={{ maxWidth: 840 }}>
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack spacing={3}>
            <Typography variant="h4" component="h2">About your item</Typography>
            <Box component="fieldset" disabled={busy || !userId} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
              <Stack spacing={2.5}>
                <TextField id="listing-title" label="Title" required fullWidth value={fields.title} onChange={(e) => change("title", e.target.value)} error={!!errors.title} helperText={errors.title ?? "A short, specific name. Up to 120 characters."} slotProps={{ htmlInput: { maxLength: LISTING_LIMITS.title } }} />
                <TextField id="listing-description" label="Description" required fullWidth multiline minRows={5} value={fields.description} onChange={(e) => change("description", e.target.value)} error={!!errors.description} helperText={errors.description ?? "Include useful details, dimensions, and any wear. Up to 5,000 characters."} slotProps={{ htmlInput: { maxLength: LISTING_LIMITS.description } }} />
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5 }}>
                  <TextField id="listing-price" label="Price (USD)" required type="number" value={fields.price} onChange={(e) => change("price", e.target.value)} error={!!errors.price} helperText={errors.price ?? "Enter 0 to offer it for free."} slotProps={{ htmlInput: { min: 0, step: "any", inputMode: "decimal" } }} />
                  <TextField id="listing-condition" label="Condition" select required value={fields.condition} onChange={(e) => change("condition", e.target.value)} error={!!errors.condition} helperText={errors.condition ?? "Choose the closest match."}>
                    {Object.entries(CONDITION_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                  </TextField>
                </Box>
                <TextField id="listing-category" label="Category" required fullWidth value={fields.category} onChange={(e) => change("category", e.target.value)} error={!!errors.category} helperText={errors.category ?? "For example: Books, Furniture, or Electronics. Up to 80 characters."} slotProps={{ htmlInput: { maxLength: LISTING_LIMITS.category } }} />
                <Divider />
                <Box>
                  <Typography variant="h4" component="h2" sx={{ mb: 1 }}>Photos <Typography component="span" sx={{ color: "text.secondary" }}>(optional)</Typography></Typography>
                  <Typography id="photo-help" variant="body2" sx={{ color: "text.secondary", mb: 2 }}>Up to five JPEG, PNG, or WebP images, 5 MiB each. Use still images up to 20 megapixels. Your first photo is the cover.</Typography>
                  <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateOutlinedIcon />} disabled={busy || !userId || photos.length >= 5}>
                    Add photos ({photos.length}/5)
                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="Add listing photos" aria-describedby="photo-help" onChange={selectPhotos} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }} disabled={busy || !userId || photos.length >= 5} />
                  </Button>
                  {photoError && <Alert severity="error" sx={{ mt: 2 }}>{photoError}</Alert>}
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)" }, gap: 2, mt: photos.length ? 2 : 0 }}>
                    {photos.map((photo, index) => (
                      <Paper key={photo.url} variant="outlined" sx={{ overflow: "hidden", minWidth: 0 }}>
                        <Box component="img" src={photo.url} alt={`Photo ${index + 1} preview of your item`} sx={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", display: "block", bgcolor: tokens.mist }} />
                        <Stack spacing={0.5} sx={{ p: 1 }}>
                          <Typography variant="caption" noWrap title={photo.file.name}>{index === 0 ? "Cover · " : ""}{photo.file.name}</Typography>
                          <Button component="label" size="small" disabled={busy}>
                            Replace<span className="sr-only"> photo {index + 1}</span>
                            <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Replace photo ${index + 1}`} onChange={(e) => selectPhotos(e, index)} disabled={busy} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }} />
                          </Button>
                          <Button size="small" aria-label={`Remove photo ${index + 1}`} onClick={() => removePhoto(index)} disabled={busy}>Remove</Button>
                        </Stack>
                      </Paper>
                    ))}
                  </Box>
                </Box>
              </Stack>
            </Box>
            {error && <Alert severity="error" ref={errorAlert} tabIndex={-1}>{error}</Alert>}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
              <Button type="submit" variant="contained" disabled={busy || !userId} startIcon={busy ? <CircularProgress size={18} color="inherit" /> : undefined}>
                {phase === "uploading" ? "Uploading photos…" : phase === "creating" ? "Creating listing…" : "Create listing"}
              </Button>
              {!busy && <Button component={Link} href="/" color="inherit">Cancel</Button>}
              <Typography role="status" aria-live="polite" variant="body2" sx={{ color: "text.secondary" }}>
                {phase === "uploading" ? "Keep this page open while your photos upload." : phase === "creating" ? "Saving your listing." : "You can create a listing without photos."}
              </Typography>
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </>
  );
}
