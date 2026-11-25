/**
 * Hexagonal StoragePort contract.
 * Implemented by SupabaseStorageAdapter or S3StorageAdapter.
 */

export type StorageBucket = 'menu-media' | 'invoices' | 'receipts';

export interface UploadObjectInput {
  tenantId: string;
  bucket: StorageBucket;
  key: string;
  contentType: string;
  body: Uint8Array | Buffer;
  cacheControl?: string;
}

export interface UploadObjectResult {
  bucket: StorageBucket;
  key: string;
  publicUrl?: string;
}

export interface StoragePort {
  uploadMenuAsset(
    input: Omit<UploadObjectInput, 'bucket'>,
  ): Promise<UploadObjectResult>;

  uploadInvoicePdf(
    input: Omit<UploadObjectInput, 'bucket'>,
  ): Promise<UploadObjectResult>;

  getSignedUrl(input: {
    bucket: StorageBucket;
    key: string;
    expiresInSeconds?: number;
  }): Promise<string>;

  deleteObject(input: { bucket: StorageBucket; key: string }): Promise<void>;
}
