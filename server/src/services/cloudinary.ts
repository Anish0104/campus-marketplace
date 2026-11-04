import { v2 as cloudinary } from "cloudinary";

function configure() {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) throw new Error("Photo storage is not configured.");
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
}

// Small boundary for tests: replace these methods, never call real Cloudinary.
export const photoStorage = {
  async upload(buffer: Buffer, publicId: string): Promise<{ url: string; publicId: string }> {
    configure();
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
        public_id: publicId,
        resource_type: "image",
        allowed_formats: ["webp"],
        overwrite: false,
        timeout: 60000,
        // upload_stream returns a stream, so its internal promise cannot be awaited.
        // Use the callback only to avoid unhandled SDK promise rejections.
        disable_promises: true,
      }, (error, result) => {
        if (error || !result || result.public_id !== publicId || typeof result.secure_url !== "string" || !result.secure_url.startsWith("https://")) {
          // Never propagate provider errors, request objects or credentials to logs/responses.
          reject(new Error("Photo storage upload failed."));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      });
      stream.on("error", () => reject(new Error("Photo storage upload failed.")));
      stream.end(buffer);
    });
  },
  async destroy(publicId: string): Promise<void> {
    configure();
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
    if (result.result !== "ok" && result.result !== "not found") throw new Error("Photo cleanup failed.");
  },
};
