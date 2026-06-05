import { DetectDocumentTextCommand, TextractClient } from "@aws-sdk/client-textract";
import type { Block } from "@aws-sdk/client-textract";
import { createWorker } from "tesseract.js";

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
  provider: "tesseract" | "aws-textract";
};

export interface OcrProvider {
  recognize(image: Buffer): Promise<OcrResult>;
}

export function getOcrProviderName() {
  return process.env.OCR_PROVIDER ?? "tesseract";
}

export function getOcrStatus() {
  const provider = getOcrProviderName();
  const missingAwsCredentials = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"].filter((key) => !process.env[key]);
  const ocrAccessTokenRequired = provider === "aws-textract";

  return {
    provider,
    fallbackToTesseract: process.env.OCR_FALLBACK_TO_TESSERACT === "true",
    awsTextractReady: provider !== "aws-textract" || missingAwsCredentials.length === 0,
    missingAwsCredentials: provider === "aws-textract" ? missingAwsCredentials : [],
    ocrAccessTokenRequired,
    ocrAccessTokenConfigured: !ocrAccessTokenRequired || Boolean(process.env.OCR_ACCESS_TOKEN?.trim())
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
        text: fallbackResult.text,
        lines: fallbackResult.lines,
        blocks: fallbackResult.blocks,
        confidence: fallbackResult.confidence
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

export function createOcrProvider(): OcrProvider {
  const provider = getOcrProviderName();

  if (provider === "tesseract") {
    return new TesseractOcrProvider();
  }

  if (provider === "aws-textract") {
    const awsProvider = new AwsTextractOcrProvider();
    if (process.env.OCR_FALLBACK_TO_TESSERACT === "true") {
      return new FallbackOcrProvider(awsProvider, new TesseractOcrProvider());
    }
    return awsProvider;
  }

  throw new Error(`OCR_PROVIDER invalido: ${provider}. Usa "tesseract" o "aws-textract".`);
}
