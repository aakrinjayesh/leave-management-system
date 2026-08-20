const crypto = require("crypto");
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const env = require("../config/env");

const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

// Same bucket serves every environment - this prefix is what keeps
// dev/local uploads visually and structurally separate from prod ones.
const ENV_PREFIX = env.NODE_ENV === "production" ? "prod" : "dev";

const PUBLIC_URL_PREFIX = `https://${env.AWS_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/`;

// Uploads a multer memory-storage file (needs `file.buffer`, so the multer
// config using this must use multer.memoryStorage(), not diskStorage) to S3
// and returns its permanent public URL - the bucket is public-read, so this
// URL works forever without needing to be presigned.
const uploadToS3 = async (file, folder = "misc") => {
  const key = `aakrin-lms/${ENV_PREFIX}/${folder}/${crypto.randomUUID()}-${file.originalname}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: env.AWS_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      // Preserves the employee's original filename (rather than the
      // uuid-prefixed S3 key) as the suggested filename when a download
      // endpoint redirects the browser straight to this object.
      ContentDisposition: `attachment; filename="${file.originalname}"`,
    })
  );

  return { url: `${PUBLIC_URL_PREFIX}${key}`, key };
};

// Distinguishes an S3-hosted file (uploaded after the S3 migration) from a
// legacy local filename (uploaded before it, still sitting in backend/uploads)
// - download endpoints use this to decide whether to redirect to S3 or fall
// back to serving the old file straight off disk.
const isS3Url = (value) => typeof value === "string" && value.startsWith(PUBLIC_URL_PREFIX);

// Best-effort delete (e.g. when a document is replaced or removed) - a
// missing/already-gone object, or a url that isn't ours, shouldn't fail the
// request that's replacing/removing it.
const deleteFromS3 = async (url) => {
  if (!url || !url.startsWith(PUBLIC_URL_PREFIX)) return;

  const key = url.slice(PUBLIC_URL_PREFIX.length);
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: env.AWS_BUCKET_NAME, Key: key }));
  } catch (err) {
    console.error("S3 delete failed:", err);
  }
};

module.exports = { uploadToS3, deleteFromS3, isS3Url };
