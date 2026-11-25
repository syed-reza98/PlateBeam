import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  StorageBucket,
  StoragePort,
  UploadObjectInput,
  UploadObjectResult,
} from '../../ports/storage.port';

export class SupabaseStorageAdapter implements StoragePort {
  private client: SupabaseClient | null = null;

  private getClient(): SupabaseClient {
    if (!this.client) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const secretKey =
        process.env.SUPABASE_SECRET_KEY ??
        process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !secretKey) {
        throw new Error(
          'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required for SupabaseStorageAdapter',
        );
      }
      this.client = createClient(url, secretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return this.client;
  }

  private async upload(
    bucket: StorageBucket,
    input: Omit<UploadObjectInput, 'bucket'>,
  ): Promise<UploadObjectResult> {
    const supabase = this.getClient();
    const objectKey = `${input.tenantId}/${input.key}`.replace(/\/+/g, '/');

    const { error } = await supabase.storage
      .from(bucket)
      .upload(objectKey, input.body, {
        contentType: input.contentType,
        cacheControl: input.cacheControl ?? '3600',
        upsert: true,
      });

    if (error) {
      throw new Error(`Supabase storage upload failed: ${error.message}`);
    }

    const publicUrl =
      bucket === 'menu-media'
        ? supabase.storage.from(bucket).getPublicUrl(objectKey).data.publicUrl
        : undefined;

    return {
      bucket,
      key: objectKey,
      publicUrl,
    };
  }

  async uploadMenuAsset(
    input: Omit<UploadObjectInput, 'bucket'>,
  ): Promise<UploadObjectResult> {
    return this.upload('menu-media', input);
  }

  async uploadInvoicePdf(
    input: Omit<UploadObjectInput, 'bucket'>,
  ): Promise<UploadObjectResult> {
    return this.upload('invoices', input);
  }

  async getSignedUrl(input: {
    bucket: StorageBucket;
    key: string;
    expiresInSeconds?: number;
  }): Promise<string> {
    const supabase = this.getClient();
    const { data, error } = await supabase.storage
      .from(input.bucket)
      .createSignedUrl(input.key, input.expiresInSeconds ?? 3600);

    if (error || !data?.signedUrl) {
      throw new Error(
        `Supabase storage signed URL failed: ${error?.message ?? 'unknown error'}`,
      );
    }

    return data.signedUrl;
  }

  async deleteObject(input: {
    bucket: StorageBucket;
    key: string;
  }): Promise<void> {
    const supabase = this.getClient();
    const { error } = await supabase.storage
      .from(input.bucket)
      .remove([input.key]);

    if (error) {
      throw new Error(`Supabase storage delete failed: ${error.message}`);
    }
  }
}
