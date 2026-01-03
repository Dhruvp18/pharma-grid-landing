import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, ScanLine, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/config";

interface HandoverModalProps {
    bookingId: string;
    role: 'owner' | 'renter';
    onSuccess?: () => void;
    trigger?: React.ReactNode;
    variant?: 'pickup' | 'return';
}

export function HandoverModal({ bookingId, role, onSuccess, trigger, variant = 'pickup' }: HandoverModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [generatedCode, setGeneratedCode] = useState<string | null>(null);
    const [inputCode, setInputCode] = useState("");

    // BACKEND URL
    const API_URL = API_BASE_URL;

    // Logic: 
    // Pickup: Owner Generates, Renter Scans
    // Return: Renter Generates, Owner Scans
    const isGenerator = (variant === 'pickup' && role === 'owner') || (variant === 'return' && role === 'renter');

    const handleGenerateCode = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/generate-handover`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookingId, handoverType: variant }),
            });

            const data = await response.json();

            if (response.ok) {
                setGeneratedCode(data.qrData);
                toast.success("Handover Code Generated!");
            } else {
                toast.error(data.detail || "Failed to generate code");
            }
        } catch (error) {
            console.error(error);
            toast.error("Network error connecting to backend");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        if (!inputCode || inputCode.length !== 6) {
            toast.error("Please enter a valid 6-digit code");
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/scan-handover`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bookingId,
                    scannedCode: inputCode,
                    handoverType: variant
                }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                toast.success(data.message || "Handover Successful!");
                setIsOpen(false);
                onSuccess?.();
            } else {
                toast.error(data.message || "Invalid Code");
            }
        } catch (error) {
            console.error(error);
            toast.error("Network error verifying code");
        } finally {
            setIsLoading(false);
        }
    };

    const getTitle = () => {
        if (variant === 'pickup') return role === 'owner' ? "Owner Handover (Pickup)" : "Renter Confirmation (Pickup)";
        return role === 'renter' ? "Return Handover" : "Confirm Return";
    };

    const getDescription = () => {
        if (isGenerator) return "Generate a secure code and show it to the other party to confirm handover.";
        return "Ask the other party for the secure code and enter it below to confirm.";
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant={isGenerator ? "default" : "outline"} className="gap-2">
                        {isGenerator ? <QrCode className="w-4 h-4" /> : <ScanLine className="w-4 h-4" />}
                        {isGenerator ? "Start Handover" : "Confirm Handover"}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md text-center">
                <DialogHeader>
                    <DialogTitle className="text-center text-xl">
                        {getTitle()}
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        {getDescription()}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6 flex flex-col items-center justify-center space-y-6">
                    {isGenerator ? (
                        <>
                            {!generatedCode ? (
                                <Button size="lg" onClick={handleGenerateCode} disabled={isLoading}>
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <QrCode className="w-4 h-4 mr-2" />}
                                    Generate 6-Digit Code
                                </Button>
                            ) : (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="bg-slate-100 p-8 rounded-xl border-2 border-dashed border-slate-300">
                                        <span className="text-5xl font-mono font-bold tracking-widest text-primary">
                                            {generatedCode}
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Show this code to the {role === 'owner' ? 'Renter' : 'Owner'}. <br />
                                        Once they enter it, the {variant === 'pickup' ? 'rental' : 'return'} will be confirmed.
                                    </p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="w-full max-w-xs space-y-4">
                            <div className="space-y-2 text-left">
                                <Label htmlFor="code">Enter 6-Digit Code</Label>
                                <Input
                                    id="code"
                                    placeholder="123456"
                                    className="text-center text-2xl tracking-widest h-14 font-mono"
                                    maxLength={6}
                                    value={inputCode}
                                    onChange={(e) => setInputCode(e.target.value)}
                                />
                            </div>
                            <Button className="w-full" size="lg" onClick={handleVerifyCode} disabled={isLoading}>
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                Verify & {variant === 'pickup' ? 'Start Rental' : 'Complete Return'}
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
