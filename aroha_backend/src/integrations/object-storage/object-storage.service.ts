import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import objectStorageConfig from "../../config/object-storage.config";
import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { MediaDisclosureService, type MediaViewer } from "./media-disclosure.service";

export interface PresignedUploadInstruction {
  uploadUrl: string;
  expiresAt: Date;
  headers: Record<string, string>;
}

export interface HeadedObject {
  sizeBytes: number | null;
  mimeType: string | null;
  metadata: Record<string, string>;
}

@Injectable()
export class ObjectStorageService {
  private readonly client: S3Client;

  constructor(
    @Inject(objectStorageConfig.KEY)
    private readonly config: ConfigType<typeof objectStorageConfig>,
    private readonly disclosure: MediaDisclosureService,
  ) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
    });
  }

  async createPresignedPutObject(input: {
    bucket: string;
    objectKey: string;
    mimeType: string;
    uploadToken: string;
    userId: string;
    sha256: string | null;
    expiresInSeconds: number;
  }): Promise<PresignedUploadInstruction> {
    const command = new PutObjectCommand({
      Bucket: input.bucket,
      Key: input.objectKey,
      ContentType: input.mimeType,
      Metadata: {
        "aroha-upload-token": input.uploadToken,
        "aroha-user-id": input.userId,
        ...(input.sha256 ? { "aroha-sha256": input.sha256 } : {}),
      },
    });
    const signedHeaders = new Set([
      "content-type",
      "x-amz-meta-aroha-upload-token",
      "x-amz-meta-aroha-user-id",
      ...(input.sha256 ? ["x-amz-meta-aroha-sha256"] : []),
    ]);
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: input.expiresInSeconds,
      signableHeaders: signedHeaders,
      unhoistableHeaders: signedHeaders,
    });
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);

    return {
      uploadUrl,
      expiresAt,
      headers: {
        "Content-Type": input.mimeType,
        "x-amz-meta-aroha-upload-token": input.uploadToken,
        "x-amz-meta-aroha-user-id": input.userId,
        ...(input.sha256
          ? {
              "x-amz-meta-aroha-sha256": input.sha256,
            }
          : {}),
      },
    };
  }

  async headObject(input: {
    bucket: string;
    objectKey: string;
  }): Promise<HeadedObject> {
    const result = await this.client.send(
      new HeadObjectCommand({
        Bucket: input.bucket,
        Key: input.objectKey,
      }),
    );

    return {
      sizeBytes: result.ContentLength ?? null,
      mimeType: result.ContentType ?? null,
      metadata: result.Metadata ?? {},
    };
  }

  async listObjects(input: { bucket: string; prefix: string; continuationToken?: string }) {
    const result = await this.client.send(new ListObjectsV2Command({
      Bucket: input.bucket, Prefix: input.prefix, ContinuationToken: input.continuationToken,
    }));
    return {
      objects: (result.Contents ?? []).filter(item => item.Key && item.LastModified)
        .map(item => ({ objectKey: item.Key!, lastModified: item.LastModified! })),
      nextToken: result.NextContinuationToken,
    };
  }

  async createPresignedGetObject(input: {
    bucket: string;
    objectKey: string;
    expiresInSeconds?: number;
    disclosure?: MediaViewer;
    noStore?: boolean;
  }): Promise<string> {
    if (input.disclosure && !(await this.canDiscloseMedia(input.disclosure))) {
      // Fail closed to an anonymous image slot, never an original URL. The
      // mobile relationship control supplies its themed locked-photo treatment.
      return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAarVyFEAAAAASUVORK5CYII=";
    }
    // Demo profiles intentionally use externally hosted images. Uploaded
    // photos always use a private S3/MinIO bucket and are signed below.
    if (input.bucket === "external" && /^https?:\/\//i.test(input.objectKey)) {
      return input.objectKey;
    }

    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: input.bucket,
        Key: input.objectKey,
        ...(input.noStore ? { ResponseCacheControl: "private, no-store" } : {}),
      }),
      { expiresIn: input.expiresInSeconds ?? 15 * 60 },
    );
  }

  canDiscloseMedia(viewer: MediaViewer): Promise<boolean> { return this.disclosure.mayDisclose(viewer); }

  async downloadObjectToFile(input: {
    bucket: string;
    objectKey: string;
    destinationPath: string;
    maxBytes?: number;
  }): Promise<void> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: input.bucket, Key: input.objectKey }),
    );
    if (!result.Body) {
      throw new Error("Object storage returned an empty body");
    }
    let bytes = 0;
    await pipeline(
      Readable.from(result.Body as AsyncIterable<Uint8Array>),
      new Transform({ transform(chunk: Buffer, _encoding, callback) {
        bytes += chunk.length;
        callback(input.maxBytes !== undefined && bytes > input.maxBytes ? new Error("Object exceeds download limit") : null, chunk);
      } }),
      createWriteStream(input.destinationPath),
    );
  }

  async readObjectStream(input: { bucket: string; objectKey: string; range?: string }) {
    return this.client.send(new GetObjectCommand({
      Bucket: input.bucket,
      Key: input.objectKey,
      Range: input.range,
    }));
  }

  async putFile(input: {
    bucket: string;
    objectKey: string;
    sourcePath: string;
    mimeType: string;
  }): Promise<number> {
    const file = await stat(input.sourcePath);
    await this.client.send(
      new PutObjectCommand({
        Bucket: input.bucket,
        Key: input.objectKey,
        Body: createReadStream(input.sourcePath),
        ContentLength: file.size,
        ContentType: input.mimeType,
      }),
    );
    return file.size;
  }

  async deleteObject(input: { bucket: string; objectKey: string }): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: input.bucket, Key: input.objectKey }),
    );
  }

  buildReadObjectUrl(input: {
    bucket: string;
    objectKey: string;
  }): string {
    // Dev-seed escape hatch: if the bucket is the sentinel "external", the
    // objectKey is already an https:// URL (e.g. an Unsplash photo) and we
    // return it as-is. This lets seeded demo profiles render real photos
    // without round-tripping through S3 / MinIO. The upload flow never
    // produces this bucket, so prod traffic is unaffected.
    if (input.bucket === "external" && /^https?:\/\//i.test(input.objectKey)) {
      return input.objectKey;
    }

    const endpoint = this.config.endpoint.trim();
    if (endpoint.length === 0) {
      throw new Error("Object storage endpoint is not configured");
    }

    const url = new URL(endpoint);
    const encodedKey = input.objectKey
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const normalizedBasePath = url.pathname.replace(/\/+$/, "");

    if (this.config.forcePathStyle) {
      url.pathname = `${normalizedBasePath}/${encodeURIComponent(
        input.bucket,
      )}/${encodedKey}`;
    } else {
      url.hostname = `${input.bucket}.${url.hostname}`;
      url.pathname = `${normalizedBasePath}/${encodedKey}`;
    }

    url.search = "";
    url.hash = "";
    return url.toString();
  }
}
