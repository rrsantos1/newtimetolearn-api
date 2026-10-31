import {
  PutBucketCorsCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const endpoint = process.env.B2_S3_ENDPOINT;
const region = process.env.B2_REGION;
const bucket = process.env.B2_BUCKET_NAME;
const accessKeyId = process.env.B2_APPLICATION_KEY_ID;
const secretAccessKey = process.env.B2_APPLICATION_KEY;

if (
  !endpoint ||
  !region ||
  !bucket ||
  !accessKeyId ||
  !secretAccessKey
) {
  throw new Error("As variáveis de ambiente do Backblaze estão incompletas.");
}

const client = new S3Client({
  endpoint,
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: true,
});

async function configureBackblazeCors(): Promise<void> {
  try {
    await client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: [
                "http://localhost:3000",
                "https://SEU-FRONTEND.netlify.app",
              ],
              AllowedMethods: ["PUT", "GET", "HEAD"],
              AllowedHeaders: ["content-type"],
              ExposeHeaders: ["ETag"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );

    console.log("Regras CORS atualizadas com sucesso.");
  } catch (error: unknown) {
    console.error("Não foi possível atualizar as regras CORS:", error);
    throw error;
  } finally {
    client.destroy();
  }
}

void configureBackblazeCors();