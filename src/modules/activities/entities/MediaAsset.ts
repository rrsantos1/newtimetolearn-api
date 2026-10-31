import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../../shared/database/entities/BaseEntity";
import { User } from "../../users/entities/User";

@Entity("media_assets")
@Index("uq_media_assets_storage_key", ["storageKey"], { unique: true })
@Index("idx_media_assets_uploaded_by_created", ["uploadedBy", "createdAt"])
@Index("idx_media_assets_status_created", ["status", "createdAt"])
export class MediaAsset extends BaseEntity {
  @Column({ name: "uploaded_by", type: "uuid" })
  uploadedBy!: string;

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "uploaded_by" })
  uploader!: User;

  @Column({ name: "storage_key", type: "varchar", length: 500 })
  storageKey!: string;

  @Column({ name: "public_url", type: "text" })
  publicUrl!: string;

  @Column({ name: "file_name", type: "varchar", length: 255 })
  fileName!: string;

  @Column({ name: "content_type", type: "varchar", length: 50 })
  contentType!: string;

  @Column({ name: "size_bytes", type: "integer" })
  sizeBytes!: number;

  @Column({ name: "alt_text", type: "varchar", length: 250, default: "" })
  altText!: string;

  @Column({ type: "varchar", length: 20, default: "PENDING_REVIEW" })
  status!: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
}
