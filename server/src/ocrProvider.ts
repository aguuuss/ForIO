import { DetectDocumentTextCommand, TextractClient } from "@aws-sdk/client-textract";
import type { Block } from "@aws-sdk/client-textract";
import { createWorker } from "tesseract.js";
import type { SessionUser } from "./types.js";

export type OcrProviderName = "tesseract" | "aws-textract";

export type OcrBlock = {
  id?: string;
  blockType?: string;
  text?: string;
  confidence?: number;
  page?: number;
};

export type OcrResult = {
  text: string;
  lines: string[];
  blocks?: OcrBlock[];
  confidence?: number;
  provider: OcrProviderName;
  usedFallback?: boolean;
};

export interface OcrProvider {
  recognize(image: Buffer): Promise<OcrResult>;
}

export function getOcrProviderName() {
  return (process.env.OCR_PROVIDER ?? "tesseract") as OcrProviderName;
}

function getMissingAwsCredentials() {
  return ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"].filter((key) => !process.env[key]);
}

export function canUseAwsTextract(user?: Pick<SessionUser, "role" | "status"> | null) {
  return user?.status === "active" && user.role === "admin";
}

export function getEffectiveOcrProvider(user?: Pick<SessionUser, "role" | "status"> | null): OcrProviderName {
  const configuredProvider = getOcrProviderName();
  if (configuredProvider !== "aws-textract") {
    return "tesseract";
  }

  if (!canUseAwsTextract(user)) {
    return "tesseract";
  }

  return getMissingAwsCredentials().length === 0 ? "aws-textract" : "tesseract";
}

export function getOcrStatus(user?: Pick<SessionUser, "role" | "status"> | null) {
  const configuredProvider = getOcrProviderName();
  const missingAwsCredentials = getMissingAwsCredentials();
  const canUseAws = canUseAwsTextract(user);
  const effectiveProvider = getEffectiveOcrProvider(user);

  return {
    configuredProvider,
    effectiveProvider,
    provider: effectiveProvider,
    canUseAwsTextract: canUseAws,
    awsReservedToAdmins: true,
    fallbackToTesseract: process.env.OCR_FALLBACK_TO_TESSERACT === "true",
    awsTextractReady: configuredProvider !== "aws-textract" || missingAwsCredentials.length === 0,
    missingAwsCredentials: configuredProvider === "aws-textract" ? missingAwsCredentials : []
  };
}

class TesseractOcrProvider implements OcrProvider {
  async recognize(image: Buffer): Promise<OcrResult> {
    const worker = await createWorker("spa+eng");
    try {
      const result = await worker.recognize(image);
      const text = result.data.text.trim();
      return {
        text,
        lines: text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
        confidence: result.data.confidence,
        provider: "tesseract"
      };
    } finally {
      await worker.terminate();
    }
  }
}

class AwsTextractOcrProvider implements OcrProvider {
  private readonly client: TextractClient;

  constructor() {
    const missing = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"].filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(
        `Faltan credenciales para AWS Textract: ${missing.join(", ")}. Configuralas en .env o variables de entorno.`
      );
    }

    this.client = new TextractClient({
      region: process.env.AWS_REGION
    });
  }

  async recognize(image: Buffer): Promise<OcrResult> {
    try {
      const response = await this.client.send(
        new DetectDocumentTextCommand({
          Document: {
            Bytes: image
          }
        })
      );

      const blocks = (response.Blocks ?? []).map(toOcrBlock);
      const lineBlocks = blocks.filter((block) => block.blockType === "LINE" && block.text);
      const lines = lineBlocks.map((block) => block.text ?? "");
      const text = lines.join("\n").trim();
      const confidence = average(lineBlocks.map((block) => block.confidence).filter((value): value is number => typeof value === "number"));

      return {
        text,
        lines,
        blocks,
        confidence,
        provider: "aws-textract"
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido de AWS Textract.";
      throw new Error(`AWS Textract no pudo procesar la imagen. ${message}`);
    }
  }
}

class FallbackOcrProvider implements OcrProvider {
  constructor(
    private readonly primary: OcrProvider,
    private readonly fallback: OcrProvider
  ) {}

  async recognize(image: Buffer): Promise<OcrResult> {
    try {
      return await this.primary.recognize(image);
    } catch (error) {
      const fallbackResult = await this.fallback.recognize(image);
      return {
        ...fallbackResult,
        usedFallback: true
      };
    }
  }
}

function toOcrBlock(block: Block): OcrBlock {
  return {
    id: block.Id,
    blockType: block.BlockType,
    text: block.Text,
    confidence: block.Confidence,
    page: block.Page
  };
}

function average(values: number[]) {
  if (values.length === 0) {
    return undefined;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function createOcrProviderForUser(user?: Pick<SessionUser, "role" | "status"> | null): OcrProvider {
  const provider = getEffectiveOcrProvider(user);

  if (provider === "tesseract") {
    return new TesseractOcrProvider();
  }

  if (provider === "aws-textract" && canUseAwsTextract(user)) {
    const awsProvider = new AwsTextractOcrProvider();
    if (process.env.OCR_FALLBACK_TO_TESSERACT === "true") {
      return new FallbackOcrProvider(awsProvider, new TesseractOcrProvider());
    }
    return awsProvider;
  }

  throw new Error(`OCR_PROVIDER invalido: ${provider}. Usa "tesseract" o "aws-textract".`);
}
