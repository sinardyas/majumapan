declare module 'pdfkit' {
  import { Writable } from 'stream';

  interface PDFDocumentOptions {
    size?: string | [number, number];
    margins?: { top: number; bottom: number; left: number; right: number };
  }

  class PDFDocument extends Writable {
    constructor(options?: PDFDocumentOptions);
    readonly page: { height: number; width: number };
    fontSize(size: number): this;
    font(name: string): this;
    text(text: string, x?: number, y?: number, options?: any): this;
    moveTo(x1: number, y1: number): { lineTo(x2: number, y2: number): this; stroke(): this };
    lineTo(x: number, y: number): this;
    stroke(): this;
    addPage(): this;
    on(event: string, callback: (chunk: Buffer) => void): this;
    removeListener(event: string, callback: (chunk: Buffer) => void): this;
    end(): this;
  }

  export = PDFDocument;
}
