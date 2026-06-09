/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare module 'parquetjs' {
  export class ParquetSchema {
    constructor(schema: any);
  }

  export class ParquetReader {
    static openFile(filePath: string): Promise<ParquetReader>;
    getCursor(): ParquetCursor;
    close(): Promise<void>;
    schema: any;
    metadata: any;
  }

  export class ParquetCursor {
    next(): Promise<any>;
    close(): Promise<void>;
  }

  export class ParquetWriter {
    static openFile(schema: ParquetSchema, filePath: string): Promise<ParquetWriter>;
    appendRow(row: any): Promise<void>;
    close(): Promise<void>;
  }
}
