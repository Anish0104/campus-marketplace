import mongoose from "mongoose";

export async function connectDB(uri: string) {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("MongoDB connected");
  } catch (err) {
    console.warn("MongoDB not connected:", (err as Error).message);
  }
}
