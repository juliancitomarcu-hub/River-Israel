import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-8xl font-display font-bold text-river-red">404</h1>
        <h2 className="text-2xl font-bold text-river-black">Página no encontrada</h2>
        <p className="text-gray-600">
          Parece que la página que estás buscando se fue al descenso. Volvamos a Primera.
        </p>
        <Link href="/">
          <Button size="lg" className="mt-4">
            Volver al Inicio
          </Button>
        </Link>
      </div>
    </div>
  );
}
