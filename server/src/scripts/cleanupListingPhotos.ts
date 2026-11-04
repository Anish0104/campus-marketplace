import "dotenv/config";
import mongoose from "mongoose";
import { cleanupExpiredUploads } from "../services/listingPhotos";

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI ?? "mongodb://localhost:27017/campus-marketplace");
    const result = await cleanupExpiredUploads();
    console.log(`Photo cleanup: ${result.cleaned} batches cleaned; ${result.retained} retained for retry.`);
    if (result.retained) process.exitCode = 1;
  } catch {
    console.error("Photo cleanup could not finish. Check database and Cloudinary configuration.");
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
void main();
