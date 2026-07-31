import { useState } from "react";
import { motion } from "framer-motion";
import { Send, User, Mail, Phone, MapPin, MessageSquare, CheckCircle2, AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function Postulacion() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !email.trim()) {
      setErrorMsg("Nombre y email son obligatorios.");
      setEstado("error");
      return;
    }
    setEstado("enviando");
    setErrorMsg("");
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/suscribir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, email, telefono, ciudad, mensaje }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error ?? "Error al enviar");
        setEstado("error");
      } else {
        setEstado("ok");
        setNombre("");
        setEmail("");
        setTelefono("");
        setCiudad("");
        setMensaje("");
      }
    } catch {
      setErrorMsg("Error de conexión");
      setEstado("error");
    }
  };

  const fadeIn = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] newspaper-texture pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-12 pb-8 border-b-4 border-tinta">
          <Link href="/">
            <span className="inline-block text-xs text-gris-meta hover:text-river-red font-bold uppercase tracking-wider mb-4 cursor-pointer transition-colors">
              ← Volver a la portada
            </span>
          </Link>
          <h1 className="font-display text-5xl md:text-7xl text-tinta mb-4">
            SUMATE A LA FILIAL
          </h1>
          <p className="text-gris-meta text-lg max-w-2xl mx-auto leading-relaxed">
            Completá el formulario y formá parte de la comunidad de River en Israel. 
            Partidos, eventos, asados millonarios y mucho más.
          </p>
        </div>

        {/* Imagen de identidad */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={fadeIn}
          className="mb-12"
        >
          <div className="relative h-64 border-4 border-tinta overflow-hidden">
            <img
              src={`${import.meta.env.BASE_URL}filial-logo.jpeg`}
              alt="Filial River Plate Israel"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-tinta/70 to-transparent flex items-end p-6">
              <p className="font-display text-3xl text-white">
                FILIAL RAMAT GAN "EL TUCU SAJNIN"
              </p>
            </div>
          </div>
        </motion.div>

        {/* Formulario */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={fadeIn}
          className="bg-white border-4 border-tinta p-8"
        >
          {estado === "ok" ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-20 h-20 text-green-600 mx-auto mb-6" />
              <h2 className="font-display text-4xl text-tinta mb-4">¡BIENVENIDO!</h2>
              <p className="text-gris-meta text-lg mb-8">
                Recibimos tu postulación. Pronto nos pondremos en contacto para sumarte a los eventos y el grupo de WhatsApp.
              </p>
              <button
                onClick={() => setEstado("idle")}
                className="bg-river-red hover:bg-river-red-hover text-white font-bold px-8 py-3 uppercase tracking-wide transition-colors"
              >
                Enviar otra postulación
              </button>
            </div>
          ) : (
            <form onSubmit={enviar} className="space-y-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-tinta uppercase tracking-wider mb-2">
                  <User className="w-4 h-4 text-river-red" />
                  Nombre completo *
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  maxLength={100}
                  placeholder="Tu nombre"
                  className="w-full bg-gris-suave border-2 border-gris-borde focus:border-river-red px-4 py-3 text-tinta placeholder:text-gris-meta transition-colors outline-none"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-tinta uppercase tracking-wider mb-2">
                  <Mail className="w-4 h-4 text-river-red" />
                  Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={100}
                  placeholder="tu@email.com"
                  className="w-full bg-gris-suave border-2 border-gris-borde focus:border-river-red px-4 py-3 text-tinta placeholder:text-gris-meta transition-colors outline-none"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-tinta uppercase tracking-wider mb-2">
                  <Phone className="w-4 h-4 text-river-red" />
                  Teléfono (opcional)
                </label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  maxLength={50}
                  placeholder="+972..."
                  className="w-full bg-gris-suave border-2 border-gris-borde focus:border-river-red px-4 py-3 text-tinta placeholder:text-gris-meta transition-colors outline-none"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-tinta uppercase tracking-wider mb-2">
                  <MapPin className="w-4 h-4 text-river-red" />
                  Ciudad (opcional)
                </label>
                <input
                  type="text"
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  maxLength={100}
                  placeholder="Ramat Gan, Tel Aviv, Jerusalén..."
                  className="w-full bg-gris-suave border-2 border-gris-borde focus:border-river-red px-4 py-3 text-tinta placeholder:text-gris-meta transition-colors outline-none"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-tinta uppercase tracking-wider mb-2">
                  <MessageSquare className="w-4 h-4 text-river-red" />
                  Mensaje (opcional)
                </label>
                <textarea
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  maxLength={500}
                  rows={4}
                  placeholder="Contanos por qué querés sumarte a la filial, cuánto hace que sos de River, etc."
                  className="w-full bg-gris-suave border-2 border-gris-borde focus:border-river-red px-4 py-3 text-tinta placeholder:text-gris-meta transition-colors outline-none resize-y"
                />
              </div>

              {estado === "error" && (
                <div className="flex items-start gap-2 bg-red-50 border-2 border-red-600 p-4 text-red-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold">{errorMsg || "No se pudo enviar. Probá de nuevo."}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={estado === "enviando"}
                className="w-full inline-flex items-center justify-center gap-2 bg-river-red hover:bg-river-red-hover text-white font-bold py-4 text-lg uppercase tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
                {estado === "enviando" ? "Enviando..." : "Enviar postulación"}
              </button>

              <p className="text-xs text-gris-meta text-center font-mono">
                * Campos obligatorios
              </p>
            </form>
          )}
        </motion.div>

        {/* CTA WhatsApp */}
        <div className="mt-12 bg-tinta border-4 border-river-red p-8 text-center text-white">
          <p className="font-display text-2xl mb-2">¿PREFERÍS SUMARTE DIRECTO?</p>
          <p className="text-white/80 mb-6 text-sm">
            Unite al canal de WhatsApp para recibir las novedades al instante.
          </p>
          <a
            href="https://whatsapp.com/channel/0029VbCkS5VHrDZiSDf9g01s"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-river-red hover:bg-river-red-hover text-white font-bold px-8 py-3 transition-colors uppercase tracking-wide"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Canal de WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
