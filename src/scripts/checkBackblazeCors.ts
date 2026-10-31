import {
  GetBucketCorsCommand,
  S3Client,
  S3ServiceException,
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

async function checkBackblazeCors(): Promise<void> {
  try {
    const response = await client.send(
      new GetBucketCorsCommand({
        Bucket: bucket,
      }),
    );

    console.log(
      "Regras CORS do bucket:",
      JSON.stringify(response.CORSRules ?? [], null, 2),
    );
  } catch (error: unknown) {
    if (error instanceof S3ServiceException) {
      console.error("Erro ao consultar CORS:", {
        name: error.name,
        message: error.message,
        httpStatusCode: error.$metadata.httpStatusCode,
      });
      return;
    }

    console.error("Erro inesperado ao consultar CORS:", error);
  } finally {
    client.destroy();
  }
}

void checkBackblazeCors();