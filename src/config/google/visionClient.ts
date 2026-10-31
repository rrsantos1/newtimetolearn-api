import fs from "node:fs";
import path from "node:path";
import vision from "@google-cloud/vision";

interface GoogleServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

function parseCredentials(
  jsonString: string
): GoogleServiceAccountCredentials {
  const parsed: unknown = JSON.parse(jsonString.replace(/^\uFEFF/, ""));

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("client_email" in parsed) ||
    typeof parsed.client_email !== "string" ||
    !("private_key" in parsed) ||
    typeof parsed.private_key !== "string"
  ) {
    throw new Error("Credenciais do Google Vision inválidas.");
  }

  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key,
  };
}

function getCredentials(): GoogleServiceAccountCredentials {
  const configuredCredentials = process.env.GOOGLE_CREDENTIALS;

  if (configuredCredentials) {
    if (configuredCredentials.trim().startsWith("{")) {
      return parseCredentials(configuredCredentials);
    }

    const credentialsPath = path.resolve(configuredCredentials);

    if (!fs.existsSync(credentialsPath)) {
      throw new Error(
        `Arquivo de credenciais do Google Vision não encontrado: ${credentialsPath}`
      );
    }

    return parseCredentials(
      fs.readFileSync(credentialsPath, "utf8")
    );
  }

  const localCredentialsPath = path.resolve(
    process.cwd(),
    "src/config/google/timetolearn-vision-api-fe659a4b44d8.json"
  );

  if (!fs.existsSync(localCredentialsPath)) {
    throw new Error(
      "Configure GOOGLE_CREDENTIALS com o caminho ou conteúdo JSON das credenciais do Google Vision."
    );
  }

  return parseCredentials(
    fs.readFileSync(localCredentialsPath, "utf8")
  );
}

export const visionClient = new vision.ImageAnnotatorClient({
  credentials: getCredentials(),
});