import { Search, MapPin, ShieldCheck, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const HeroSection = () => {
  const trustSignals = [
    { icon: Sparkles, label: "AI Verified" },
    { icon: ShieldCheck, label: "Insured" },
    { icon: Clock, label: "24/7 Support" },
  ];

  return (
    <section className="relative pt-32 pb-16 md:pt-40 md:pb-24 px-4 overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-teal-light/50 via-background to-background pointer-events-none" />
      
      {/* Floating decorative elements */}
      <div className="absolute top-32 left-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-float" />
      <div className="absolute top-48 right-10 w-48 h-48 bg-coral/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />

      <div className="relative max-w-5xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-teal-light px-4 py-2 rounded-full mb-8 animate-fade-in">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse-soft" />
          <span className="text-sm font-medium text-primary">
            Trusted by 10,000+ families across India
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-foreground leading-tight mb-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          Vital Equipment.{" "}
          <br className="hidden sm:block" />
          Delivered by{" "}
          <span className="text-primary">Neighbors.</span>
        </h1>

        {/* Sub-headline */}
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          Rent Oxygen, Wheelchairs, and Beds instantly. Verified by AI, tracked in real-time.
        </p>

        {/* Search Component */}
        <div className="max-w-3xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <div className="glass-card rounded-2xl p-2 md:p-3 shadow-soft-xl">
            <div className="flex flex-col md:flex-row gap-3">
              {/* What do you need */}
              <div className="flex-1 flex items-center gap-3 px-5 py-4 bg-background rounded-xl">
                <Search className="w-5 h-5 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="What do you need?"
                  className="w-full bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
                />
              </div>

              {/* Divider */}
              <div className="hidden md:block w-px bg-border" />

              {/* Location */}
              <div className="flex-1 flex items-center gap-3 px-5 py-4 bg-background rounded-xl">
                <MapPin className="w-5 h-5 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Where are you?"
                  className="w-full bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
                />
              </div>

              {/* Search Button */}
              <Button variant="hero" size="lg" className="md:px-8">
                <Search className="w-5 h-5" />
                <span className="hidden sm:inline">Search</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Trust Signals */}
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 animate-fade-in" style={{ animationDelay: "0.4s" }}>
          {trustSignals.map((signal, index) => (
            <div key={index} className="flex items-center gap-2 text-muted-foreground">
              <signal.icon className="w-5 h-5 text-primary" />
              <span className="font-medium">{signal.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
