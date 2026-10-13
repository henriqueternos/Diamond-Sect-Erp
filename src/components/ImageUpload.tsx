import { useRef, useState } from "react";
import { CloudinaryService } from "../services/CloudinaryService";
import { isCloudinaryConfigured } from "../cloudinary/cloudinaryConfig";

interface Props {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
}

export function ImageUpload({ value, onChange, folder }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const configured = isCloudinaryConfigured();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      onChange(await CloudinaryService.uploadImage(file, folder));
    } catch (err: any) {
      setError(err?.message || "Erro ao enviar a imagem.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap">
        {value ? (
          <img
            src={CloudinaryService.thumb(value, 160)}
            alt="Foto"
            className="w-20 h-20 rounded-lg object-cover border border-white/10"
          />
        ) : (
          <div className="w-20 h-20 rounded-lg border border-dashed border-white/20 flex items-center justify-center text-xs text-mist-500">
            Sem foto
          </div>
        )}
        <div className="flex flex-col gap-2">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <button
            type="button"
            className="btn-secondary"
            disabled={uploading || !configured}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? "Enviando..." : value ? "Trocar foto" : "Enviar foto"}
          </button>
          {value && !uploading && (
            <button type="button" className="text-xs text-red-400 text-left" onClick={() => onChange("")}>
              Remover foto
            </button>
          )}
        </div>
      </div>
      {!configured && (
        <p className="text-[11px] text-amber-400 mt-1">
          Cloudinary ainda não configurado (veja src/cloudinary/cloudinaryConfig.ts).
        </p>
      )}
      {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
    </div>
  );
}
