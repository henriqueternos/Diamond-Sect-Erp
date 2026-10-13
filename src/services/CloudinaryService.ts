import {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_UPLOAD_PRESET,
  CLOUDINARY_MAX_MB,
  isCloudinaryConfigured,
} from "../cloudinary/cloudinaryConfig";

export const CloudinaryService = {
  /** Envia a imagem ao Cloudinary e devolve a URL https segura. */
  async uploadImage(file: File, folder?: string): Promise<string> {
    if (!isCloudinaryConfigured()) {
      throw new Error("Cloudinary não configurado. Preencha src/cloudinary/cloudinaryConfig.ts.");
    }
    if (!file.type.startsWith("image/")) throw new Error("Selecione um arquivo de imagem.");
    if (file.size > CLOUDINARY_MAX_MB * 1024 * 1024) {
      throw new Error(`Imagem muito grande (máximo ${CLOUDINARY_MAX_MB} MB).`);
    }
    const body = new FormData();
    body.append("file", file);
    body.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    if (folder) body.append("folder", folder);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: "POST",
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.secure_url) {
      throw new Error(data?.error?.message || "Falha ao enviar a imagem.");
    }
    return data.secure_url as string;
  },

  /** Versão reduzida para miniaturas (usa transformação do Cloudinary). */
  thumb(url?: string, size = 96): string {
    if (!url) return "";
    return url.includes("/upload/")
      ? url.replace("/upload/", `/upload/c_fill,w_${size},h_${size},q_auto,f_auto/`)
      : url;
  },
};
