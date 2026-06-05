import mongoose, { type Document, Schema } from "mongoose";

export type RunStatus = "pending" | "running" | "done" | "error";

export interface IRunDoc extends Document {
  runId: string;
  prompt: string;
  status: RunStatus;
  output: string;
  exitCode: number | null;
  startedAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
}

const runSchema = new Schema<IRunDoc>(
  {
    runId: { type: String, required: true, unique: true, index: true },
    prompt: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "running", "done", "error"],
      default: "pending",
    },
    output: { type: String, default: "" },
    exitCode: { type: Number, default: null },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, default: null },
    durationMs: { type: Number, default: null },
  },
  { versionKey: false },
);

runSchema.index({ startedAt: -1 });

export const Run = mongoose.model<IRunDoc>("Run", runSchema);
