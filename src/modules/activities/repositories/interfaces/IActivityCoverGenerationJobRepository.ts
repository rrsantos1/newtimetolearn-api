export type ActivityCoverGenerationJobStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "REVIEW_PENDING"
  | "FAILED";

export interface ClaimedActivityCoverGenerationJob {
  id: string;
  userId: string;
  prompt: string;
}

export interface ActivityCoverGenerationJobDetails {
  id: string;
  status: ActivityCoverGenerationJobStatus;
  errorCode: string | null;
  errorMessage: string | null;
  mediaAssetId: string | null;
  assetStatus: "APPROVED" | "PENDING_REVIEW" | "REJECTED" | null;
  publicUrl: string | null;
  altText: string | null;
  fileName: string | null;
  storageKey: string | null;
}

export interface UpdateActivityCoverGenerationJobInput {
  id: string;
  status: Extract<ActivityCoverGenerationJobStatus, "COMPLETED" | "REVIEW_PENDING" | "FAILED">;
  mediaAssetId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface IActivityCoverGenerationJobRepository {
  create(userId: string, prompt: string): Promise<{ id: string } | null>;
  findByIdAndUserId(id: string, userId: string): Promise<ActivityCoverGenerationJobDetails | null>;
  claimNextJob(staleJobMinutes: number): Promise<ClaimedActivityCoverGenerationJob | null>;
  updateStatus(input: UpdateActivityCoverGenerationJobInput): Promise<void>;
}
