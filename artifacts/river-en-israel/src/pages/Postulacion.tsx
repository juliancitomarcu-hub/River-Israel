import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mic, Video, Heart, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const schema = z.object({
  nombre: z.string().min(2, "Ingresá tu nombre"),
  ciudad: z.string().min(2, "Ingresá tu ciudad"),
  tipo: z.enum(["Periodista", "Creador", "Fanático"], { required_error: "Elegí un perfil" }),
  texto: z.string().min(50, "El texto debe tener al menos 50 caracteres"),
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
    setEstado("enviando");
    setErrorMsg("");
    try {
      const res = await fetch("/api/postular-redactor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: data.nombre,
          ciudad: data.ciudad,
          tipo: data.tipo,
          texto: data.texto,
          link: data.link || "",
        }),
      });
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

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-300">
                Tu nota, análisis o propuesta *
              </label>
              <p className="text-xs text-gray-600">
                Escribí con tu voz, tu estilo. Solo corregimos la ortografía, nunca cambiamos tus palabras.
              </p>
              <Textarea
                {...register("texto")}
                placeholder="Contá lo que viviste, tu análisis del partido, tu crónica... lo que quieras compartir con la comunidad."
                rows={12}
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-river-red resize-y font-normal text-sm leading-relaxed"
              />
              {errors.texto && <p className="text-red-400 text-xs">{errors.texto.message}</p>}
            </div>

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
