import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import Home from "@/pages/Home";
import Redactor from "@/pages/Redactor";
import Noticia from "@/pages/Noticia";
import Fixture from "@/pages/Fixture";
import MundialFixture from "@/pages/MundialFixture";
import MundialHome from "@/pages/MundialHome";
import Equipo from "@/pages/Equipo";
import Historia from "@/pages/Historia";
import Postulacion from "@/pages/Postulacion";
import Hebreo from "@/pages/Hebreo";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function Router() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/scaloneta" component={MundialHome} />
          <Route path="/redactor" component={Redactor} />
          <Route path="/noticia/:id" component={Noticia} />
          <Route path="/fixture" component={Fixture} />
          <Route path="/mundial/fixture" component={MundialFixture} />
          <Route path="/equipo" component={Equipo} />
          <Route path="/historia" component={Historia} />
          <Route path="/postula" component={Postulacion} />
          <Route path="/hebreo" component={Hebreo} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
