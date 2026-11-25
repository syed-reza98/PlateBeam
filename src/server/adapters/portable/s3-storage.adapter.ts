import { createHash, createHmac } from 'node:crypto';
import type {
  StorageBucket,
  StoragePort,
  UploadObjectInput,
  UploadObjectResult,
} from '../../ports/storage.port';

interface S3Config {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketPrefix: string;
  publicBaseUrl?: string;
}

function getS3Config(): S3Config {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'S3_ENDPOINT, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY are required for S3StorageAdapter',
    );
  }
  return {
    endpoint: endpoint.replace(/\/+$/, ''),
    region: process.env.S3_REGION ?? 'auto',
    accessKeyId,
    secretAccessKey,
    bucketPrefix: process.env.S3_BUCKET_PREFIX ?? 'platebeam',
    publicBaseUrl: process.env.S3_PUBLIC_URL?.replace(/\/+$/, ''),
  };
}

function sha256Hex(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

function getSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service = 's3',
): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

function formatAmzDates(now = new Date()) {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  };
}

function encodeS3Path(path: string): string {
  return path
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

/**
 * S3-compatible object storage adapter (AWS S3, Cloudflare R2, MinIO)
 * using native Fetch + AWS Signature V4.
 */
export class S3StorageAdapter implements StoragePort {
  private resolveBucketName(cfg: S3Config, bucket: StorageBucket): string {
    return `${cfg.bucketPrefix}-${bucket}`;
  }

  private async signedFetch(
    method: 'PUT' | 'DELETE',
    bucket: StorageBucket,
    key: string,
    body?: Uint8Array,
    contentType?: string,
    cacheControl?: string,
  ): Promise<void> {
    const cfg = getS3Config();
    const bucketName = this.resolveBucketName(cfg, bucket);
    const cleanKey = key.replace(/^\/+/, '');
    const targetUrl = new URL(
      `${cfg.endpoint}/${bucketName}/${encodeS3Path(cleanKey)}`,
    );

    const { amzDate, dateStamp } = formatAmzDates();
    const payloadHash = sha256Hex(body ?? '');
    const headers: Record<string, string> = {
      host: targetUrl.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    };
    if (contentType) headers['content-type'] = contentType;
    if (cacheControl) headers['cache-control'] = cacheControl;

    const sortedKeys = Object.keys(headers).sort();
    const canonicalHeaders = sortedKeys
      .map((k) => `${k}:${headers[k].trim()}\n`)
      .join('');
    const signedHeaders = sortedKeys.join(';');

    const canonicalRequest = [
      method,
      targetUrl.pathname,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join('\n');

    const signingKey = getSigningKey(cfg.secretAccessKey, dateStamp, cfg.region);
    const signature = createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex');

    headers.authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const fetchBody = body ? new Uint8Array(body).buffer : undefined;
    const res = await fetch(targetUrl.toString(), {
      method,
      headers,
      body: fetchBody,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`S3 ${method} failed (${res.status}): ${errText}`);
    }
  }

  async uploadMenuAsset(
    input: Omit<UploadObjectInput, 'bucket'>,
  ): Promise<UploadObjectResult> {
    const cfg = getS3Config();
    const objectKey = `${input.tenantId}/${input.key}`.replace(/\/+/g, '/');
    await this.signedFetch(
      'PUT',
      'menu-media',
      objectKey,
      input.body,
      input.contentType,
      input.cacheControl ?? 'public, max-age=3600',
    );

    const bucketName = this.resolveBucketName(cfg, 'menu-media');
    const publicUrl = cfg.publicBaseUrl
      ? `${cfg.publicBaseUrl}/${bucketName}/${objectKey}`
      : `${cfg.endpoint}/${bucketName}/${objectKey}`;

    return {
      bucket: 'menu-media',
      key: objectKey,
      publicUrl,
    };
  }

  async uploadInvoicePdf(
    input: Omit<UploadObjectInput, 'bucket'>,
  ): Promise<UploadObjectResult> {
    const objectKey = `${input.tenantId}/${input.key}`.replace(/\/+/g, '/');
    await this.signedFetch(
      'PUT',
      'invoices',
      objectKey,
      input.body,
      input.contentType,
      input.cacheControl ?? 'private, max-age=3600',
    );

    return {
      bucket: 'invoices',
      key: objectKey,
    };
  }

  async getSignedUrl(input: {
    bucket: StorageBucket;
    key: string;
    expiresInSeconds?: number;
  }): Promise<string> {
    const cfg = getS3Config();
    const bucketName = this.resolveBucketName(cfg, input.bucket);
    const cleanKey = input.key.replace(/^\/+/, '');
    const targetUrl = new URL(
      `${cfg.endpoint}/${bucketName}/${encodeS3Path(cleanKey)}`,
    );

    const { amzDate, dateStamp } = formatAmzDates();
    const credentialScope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
    const expires = Math.min(Math.max(input.expiresInSeconds ?? 3600, 1), 604800);

    const params = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${cfg.accessKeyId}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expires),
      'X-Amz-SignedHeaders': 'host',
    });

    const sortedQuery = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const canonicalRequest = [
      'GET',
      targetUrl.pathname,
      sortedQuery,
      `host:${targetUrl.host}\n`,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join('\n');

    const signingKey = getSigningKey(cfg.secretAccessKey, dateStamp, cfg.region);
    const signature = createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex');

    return `${targetUrl.origin}${targetUrl.pathname}?${sortedQuery}&X-Amz-Signature=${signature}`;
  }

  async deleteObject(input: {
    bucket: StorageBucket;
    key: string;
  }): Promise<void> {
    await this.signedFetch('DELETE', input.bucket, input.key);
  }
}
