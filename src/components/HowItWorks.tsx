import { Search, ShieldCheck, Handshake, RotateCcw, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const HowItWorks = () => {
    const navigate = useNavigate();

    const steps = [
        {
            icon: Search,
            title: "1. Locate Equipment",
            description: "Search for oxygen concentrators, hospital beds, or wheelchairs available in your immediate neighborhood.",
            color: "text-blue-500",
            bg: "bg-blue-50",
        },
        {
            icon: ShieldCheck,
            title: "2. AI Verification",
            description: "Every listing is scanned by our 'Vision Guard' AI to ensure the device is genuine and improved by community ratings.",
            color: "text-emerald-500",
            bg: "bg-emerald-50",
        },
        {
            icon: Handshake,
            title: "3. Secure Handover",
            description: "Book the item and meet the owner. Use our unique OTP handshake system to confirm pickup and start the rental.",
            color: "text-purple-500",
            bg: "bg-purple-50",
        },
        {
            icon: RotateCcw,
            title: "4. Easy Return",
            description: "Done using it? Request a return. Once the owner scans your return code, your deposit is instantly refunded.",
            color: "text-orange-500",
            bg: "bg-orange-50",
        },
    ];

    return (
        <section id="how-it-works" className="py-20 bg-background relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-100/20 rounded-full blur-3xl" />
            </div>

            <div className="container max-w-6xl mx-auto px-4 relative z-10">
                <div className="text-center mb-16 space-y-4">
                    <h2 className="text-3xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600">
                        Simple. Secure. Lifesaving.
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Pharma-Grid bridges the gap between those who have medical equipment and those who need it urgently.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
                    {/* Connector Line (Desktop) */}
                    <div className="hidden lg:block absolute top-12 left-[10%] w-[80%] h-0.5 bg-gradient-to-r from-blue-100 via-purple-100 to-orange-100 -z-10" />

                    {steps.map((step, index) => (
                        <div
                            key={index}
                            className="relative group bg-card border border-border/50 p-6 rounded-2xl hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                        >
                            <div className={`w-14 h-14 ${step.bg} ${step.color} rounded-xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                                <step.icon className="w-7 h-7" />
                            </div>

                            <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                {step.description}
                            </p>

                            {/* Step Number Watermark */}
                            <div className="absolute top-4 right-4 text-6xl font-black text-gray-50 opacity-[0.05] select-none pointer-events-none">
                                {index + 1}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-16 text-center">
                    <Button
                        size="lg"
                        className="rounded-full px-8 h-12 text-base shadow-lg shadow-primary/20"
                        onClick={() => navigate('/map')}
                    >
                        Start Renting Now <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                </div>
            </div>
        </section>
    );
};

export default HowItWorks;
