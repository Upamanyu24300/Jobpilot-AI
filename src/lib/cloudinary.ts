import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadResumePDF(
  buffer: Buffer,
  fileName: string,
  userId: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const publicId = `resumes/${userId}/${Date.now()}_${fileName.replace(/\.pdf$/i, "")}`;

    cloudinary.uploader
      .upload_stream(
        {
          resource_type: "raw",
          public_id: publicId,
          format: "pdf",
          overwrite: true,
        },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error("Upload failed"));
          resolve(result.secure_url);
        }
      )
      .end(buffer);
  });
}
