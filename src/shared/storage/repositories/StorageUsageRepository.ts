import { AppDataSource } from "../../../shared/database/data-source";
import { env } from "../../../shared/config/env";

export interface ReferencedStorageObject {
  bucketName: string;
  storageKey: string;
}

interface StorageUsageRow {
  total: string | number;
}

interface ReferencedStorageObjectRow {
  bucketName: string;
  storageKey: string;
}

export class StorageUsageRepository {
  async getUsageByTeacherId(teacherId: string): Promise<number> {
    const rows = await AppDataSource.query<StorageUsageRow[]>(
      `WITH referenced_objects AS (
        SELECT
          CASE WHEN asset.status = 'PENDING_REVIEW' THEN $2 ELSE $3 END AS bucket_name,
          asset.storage_key,
          asset.size_bytes::bigint AS size_bytes
        FROM public.media_assets asset
        WHERE asset.uploaded_by = $1
          AND asset.status IN ('APPROVED', 'PENDING_REVIEW')
        UNION ALL
        SELECT $3, asset.thumbnail_storage_key, asset.thumbnail_size_bytes::bigint
        FROM public.media_assets asset
        WHERE asset.uploaded_by = $1
          AND asset.status = 'APPROVED'
          AND asset.thumbnail_storage_key IS NOT NULL
          AND asset.thumbnail_size_bytes IS NOT NULL
        UNION ALL
        SELECT $2, entry.content->>'storageKey',
          CASE WHEN (entry.content->>'sizeBytes') ~ '^[0-9]+$'
            THEN (entry.content->>'sizeBytes')::bigint ELSE 0 END
        FROM public.notebook_entries entry
        INNER JOIN public.notebook_days day ON day.id = entry.day_id
        INNER JOIN public.teacher_student_relationships relationship
          ON relationship.id = day.relationship_id
        WHERE relationship.teacher_id = $1
          AND entry.kind IN ('IMAGE', 'FILE')
          AND NULLIF(entry.content->>'storageKey', '') IS NOT NULL
        UNION ALL
        SELECT $3, passage->'audio'->>'storageKey',
          CASE WHEN (passage->'audio'->>'sizeBytes') ~ '^[0-9]+$'
            THEN (passage->'audio'->>'sizeBytes')::bigint ELSE 0 END
        FROM public.activity_versions version
        INNER JOIN public.activities activity ON activity.id = version.activity_id
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(version.content->'passages') = 'array'
            THEN version.content->'passages' ELSE '[]'::jsonb END
        ) AS passage
        WHERE activity.teacher_id = $1
          AND NULLIF(passage->'audio'->>'storageKey', '') IS NOT NULL
      ),
      unique_objects AS (
        SELECT bucket_name, storage_key, MAX(size_bytes) AS size_bytes
        FROM referenced_objects
        WHERE storage_key IS NOT NULL
        GROUP BY bucket_name, storage_key
      )
      SELECT COALESCE(SUM(size_bytes), 0)::bigint AS total
      FROM unique_objects`,
      [teacherId, env.B2_QUARANTINE_BUCKET_NAME, env.B2_BUCKET_NAME],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async listReferencedObjects(): Promise<ReferencedStorageObject[]> {
    const rows = await AppDataSource.query<ReferencedStorageObjectRow[]>(
      `SELECT DISTINCT bucket_name AS "bucketName", storage_key AS "storageKey"
      FROM (
        SELECT
          CASE WHEN status = 'PENDING_REVIEW' THEN $1 ELSE $2 END AS bucket_name,
          storage_key
        FROM public.media_assets
        WHERE status IN ('APPROVED', 'PENDING_REVIEW')
        UNION ALL
        SELECT $2, thumbnail_storage_key
        FROM public.media_assets
        WHERE status = 'APPROVED' AND thumbnail_storage_key IS NOT NULL
        UNION ALL
        SELECT $1, entry.content->>'storageKey'
        FROM public.notebook_entries entry
        WHERE entry.kind IN ('IMAGE', 'FILE')
          AND NULLIF(entry.content->>'storageKey', '') IS NOT NULL
        UNION ALL
        SELECT $2, passage->'audio'->>'storageKey'
        FROM public.activity_versions version
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(version.content->'passages') = 'array'
            THEN version.content->'passages' ELSE '[]'::jsonb END
        ) AS passage
        WHERE NULLIF(passage->'audio'->>'storageKey', '') IS NOT NULL
      ) objects
      WHERE storage_key IS NOT NULL`,
      [env.B2_QUARANTINE_BUCKET_NAME, env.B2_BUCKET_NAME],
    );
    return rows;
  }
}
