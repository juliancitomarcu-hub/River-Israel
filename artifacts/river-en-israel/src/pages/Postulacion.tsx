import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mic, Video, Heart, Send, CheckCircle2, AlertCircle, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const schema = z.object({
  nombre: z.string().min(2, "Ingresá tu nombre"),
  ciudad: z.string().min(2, "Ingresá tu ciudad"),
  tipo: z.enum(["Periodista", "Creador", "Fanático"], { required_error: "Elegí un perfil" }),
  texto: z.string().optional(),
  link: z.string().url("URL inválida").or(z.literal("")).optional(),
});

type FormData = z.infer<typeof schema>;

const TIPOS = [
  {
    value: "Periodista" as const,
    icon: Mic,
    titulo: "Periodista",
    desc: "Un espacio para difundir tu trabajo con alcance local en Israel.",
  },
  {
    value: "Creador" as const,
    icon: Video,
    titulo: "Creador de Contenido",
    desc: "Compartí tus videos o hilos de análisis. Embebemos tu canal.",
  },
  {
    value: "Fanático" as const,
    icon: Heart,
    titulo: "Fanático",
    desc: "Contanos cómo vivís la pasión millonaria a miles de kilómetros.",
  },
];

export default function Postulacion() {
  const [estado, setEstado] = useState<"idle" | "enviando" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const tipoSeleccionado = watch("tipo");

  async function onSubmit(data: FormData) {
    const textoValido = data.texto && data.texto.trim().length >= 50;
    if (!textoValido && !archivo) {
      setErrorMsg("Escribí tu nota (mínimo 50 caracteres) o adjuntá un archivo PDF/Word");
      setEstado("error");
      return;
    }
    setEstado("enviando");
    setErrorMsg("");
    try {
      const fd = new FormData();
      fd.append("nombre", data.nombre);
      fd.append("ciudad", data.ciudad);
      fd.append("tipo", data.tipo);
      if (data.texto?.trim()) fd.append("texto", data.texto.trim());
      if (data.link) fd.append("link", data.link);
      if (archivo) fd.append("archivo", archivo);

      const res = await fetch("/api/postular-redactor", { method: "POST", body: fd });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error ?? "Error al enviar. Intentá de nuevo.");
        setEstado("error");
      } else {
        setEstado("ok");
      }
    } catch {
      setErrorMsg("Error de conexión. Intentá de nuevo.");
      setEstado("error");
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">

      {/* Hero */}
      <div className="relative bg-gradient-to-b from-river-red/20 via-black/60 to-[#0a0a0a] border-b border-white/5 py-20 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_50%_50%,_#cc0000_0%,_transparent_70%)]" />
        <div className="relative max-w-2xl mx-auto">
          <span className="inline-block text-river-red font-bold text-xs uppercase tracking-[0.3em] mb-5">
            🎙️ Comunidad · River en Israel
          </span>
          <h1 className="font-display font-black text-4xl md:text-6xl text-white leading-tight mb-5">
            ESCRIBÍ EN<br />
            <span className="text-river-red">RIVER EN ISRAEL</span>
          </h1>
          <p className="text-gray-300 text-lg leading-relaxed max-w-xl mx-auto">
            Buscamos voces millonarias en la Tierra Santa. ¿Sos periodista, creador de
            contenido o simplemente un fanático con mucho para decir? Este es tu espacio.
          </p>
        </div>
      </div>

      {/* Perfiles */}
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
          {TIPOS.map((t) => {
            const Icon = t.icon;
            const activo = tipoSeleccionado === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setValue("tipo", t.value, { shouldValidate: true })}
                className={cn(
                  "rounded-2xl p-6 text-left border transition-all duration-200 cursor-pointer",
                  activo
                    ? "bg-river-red/15 border-river-red shadow-[0_0_20px_rgba(204,0,0,0.15)]"
                    : "bg-white/3 border-white/8 hover:border-white/20 hover:bg-white/5"
                )}
              >
                <Icon className={cn("w-7 h-7 mb-3", activo ? "text-river-red" : "text-gray-400")} />
                <p className={cn("font-display font-bold text-lg mb-1", activo ? "text-white" : "text-gray-300")}>
                  {t.titulo}
                </p>
                <p className="text-gray-500 text-sm leading-relaxed">{t.desc}</p>
              </button>
            );
          })}
        </div>
        {errors.tipo && (
          <p className="text-red-400 text-sm -mt-10 mb-8 text-center">{errors.tipo.message}</p>
        )}

        {/* Formulario */}
        {estado === "ok" ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-5">
            <CheckCircle2 className="w-16 h-16 text-green-400" />
            <h2 className="font-display font-bold text-3xl">¡Postulación enviada!</h2>
            <p className="text-gray-400 max-w-md">
              Recibimos tu nota. La revisamos y te contactamos. ¡Gracias por querer ser parte de la redacción!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-300">Nombre y apellido *</label>
                <Input
                  {...register("nombre")}
                  placeholder="Ej: Ariel Sánchez"
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-river-red"
                />
                {errors.nombre && <p className="text-red-400 text-xs">{errors.nombre.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-300">Ciudad *</label>
                <Input
                  {...register("ciudad")}
                  placeholder="Ej: Tel Aviv"
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-river-red"
                />
                {errors.ciudad && <p className="text-red-400 text-xs">{errors.ciudad.message}</p>}
              </div>
            </div>

            {/* Textarea */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-300">
                Tu nota, análisis o propuesta
              </label>
              <p className="text-xs text-gray-600">
                Escribí con tu voz, tu estilo. Solo corregimos la ortografía, nunca cambiamos tus palabras.
              </p>
              <Textarea
                {...register("texto")}
                placeholder="Contá lo que viviste, tu análisis del partido, tu crónica... lo que quieras compartir con la comunidad."
                rows={10}
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-river-red resize-y font-normal text-sm leading-relaxed"
              />
            </div>

            {/* Separador */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-gray-600 font-semibold uppercase tracking-widest">O adjuntá un archivo</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Upload */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-300">
                Adjuntar nota <span className="text-gray-600 font-normal">(PDF o Word — opcional)</span>
              </label>
              {archivo ? (
                <div className="flex items-center gap-3 bg-river-red/10 border border-river-red/30 rounded-xl px-4 py-3">
                  <Paperclip className="w-4 h-4 text-river-red shrink-0" />
                  <span className="text-sm text-white font-medium flex-1 truncate">{archivo.name}</span>
                  <button type="button" onClick={() => setArchivo(null)} className="text-gray-500 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-3 border-2 border-dashed border-white/10 rounded-xl px-5 py-4 cursor-pointer hover:border-river-red/40 hover:bg-river-red/5 transition-colors">
                  <Paperclip className="w-5 h-5 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-400 font-medium">Seleccionar PDF o Word (.docx)</p>
                    <p className="text-xs text-gray-600 mt-0.5">Máximo 10 MB · La IA extrae el texto y corrige solo la ortografía</p>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}
            </div>

            {/* Link */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-300">
                Link a tu canal o redes <span className="text-gray-600 font-normal">(opcional)</span>
              </label>
              <p className="text-xs text-gray-600">
                Si tenés un canal de YouTube, TikTok o hilo de Twitter, lo podemos embeber en tu nota.
              </p>
              <Input
                {...register("link")}
                placeholder="https://youtube.com/@tucanal"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-river-red"
              />
              {errors.link && <p className="text-red-400 text-xs">{errors.link.message}</p>}
            </div>

            {estado === "error" && (
              <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={estado === "enviando"}
                className="bg-river-red hover:bg-river-red/90 text-white font-bold px-8 py-3 rounded-xl text-base flex items-center gap-2 disabled:opacity-60"
              >
                {estado === "enviando" ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Enviar postulación
                  </>
                )}
              </Button>
            </div>

            <p className="text-center text-xs text-gray-600">
              Sumate a la redacción de la Filial Ramat Gan y hacé que tu voz llegue a toda la comunidad de Israel.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
