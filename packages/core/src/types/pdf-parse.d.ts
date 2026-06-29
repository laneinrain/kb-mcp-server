declare module "pdf-parse" {
  interface PdfParseResult {
    text?: string;
    numpages?: number;
  }

  export default function pdfParse(
    dataBuffer: Buffer,
    options?: Record<string, unknown>,
  ): Promise<PdfParseResult>;
}
