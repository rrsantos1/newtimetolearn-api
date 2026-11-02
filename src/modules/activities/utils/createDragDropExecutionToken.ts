import { createHmac } from "node:crypto";
import { env } from "../../../shared/config/env";

export function createDragDropExecutionToken(pairId: string, side: "source" | "target"): string {
  return createHmac("sha256", env.JWT_SECRET)
    .update(`timetolearn:drag-drop:${pairId}:${side}`, "utf8")
    .digest("hex");
}
