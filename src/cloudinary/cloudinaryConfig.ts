// ============================================================
// CLOUDINARY — armazenamento das fotos (produtos e clientes)
// ============================================================
// Cole abaixo os dois dados da sua conta Cloudinary:
//  1) CLOUD_NAME: aparece no Dashboard do Cloudinary ("Cloud name").
//  2) UPLOAD_PRESET: nome do "Upload preset" criado como *Unsigned*
//     (Settings > Upload > Upload presets).
// NUNCA coloque API Secret aqui: este arquivo vai para o navegador.
export const CLOUDINARY_CLOUD_NAME = "ns8muyzr";
export const CLOUDINARY_UPLOAD_PRESET = "diamond_sect";

export const CLOUDINARY_MAX_MB = 8;

export function isCloudinaryConfigured(): boolean {
  return (
    !!CLOUDINARY_CLOUD_NAME &&
    !!CLOUDINARY_UPLOAD_PRESET &&
    !CLOUDINARY_CLOUD_NAME.startsWith("COLE_") &&
    !CLOUDINARY_UPLOAD_PRESET.startsWith("COLE_")
  );
}
