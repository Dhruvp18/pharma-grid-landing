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
    variant?: 'pickup' | 'return'; // New prop
    onSuccess?: () => void;
    trigger?: React.ReactNode;
}

export function HandoverModal({ bookingId, role, variant = 'pickup', onSuccess, trigger }: HandoverModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [generatedCode, setGeneratedCode] = useState<string | null>(null);
    const [inputCode, setInputCode] = useState("");

    // BACKEND URL - Assuming standard setup or environment variable
    const API_URL = API_BASE_URL;

    const handleGenerateCode = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/generate-handover`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookingId }),
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
                    scannedCode: inputCode
                }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                toast.success("Handover Successful! Rental Started.");
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

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant={role === 'owner' ? "default" : "outline"} className="gap-2">
                        {role === 'owner' ? <QrCode className="w-4 h-4" /> : <ScanLine className="w-4 h-4" />}
                        {variant === 'pickup'
                            ? (role === 'owner' ? "Start Handover" : "Confirm Handover")
                            : (role === 'owner' ? "Confirm Return" : "Start Return")}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md text-center">
                <DialogHeader>
                    <DialogTitle className="text-center text-xl">
                        {variant === 'pickup' ? (role === 'owner' ? "Owner Handover" : "Renter Confirmation")
                            : (role === 'owner' ? "Confirm Item Return (Owner)" : "Return Item (Renter)")}
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        {variant === 'pickup'
                            ? (role === 'owner'
                                ? "Generate a secure code and show it to the renter upon meeting."
                                : "Ask the owner for the secure code and enter it below to start your rental.")
                            : (role === 'owner'
                                ? "Enter the code provided by the renter to confirm you have received the item back."
                                : "Generate a code and show it to the owner when returning the item.")}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6 flex flex-col items-center justify-center space-y-6">
                    {/* Logic Swap: 
                        Pickup: Owner Generates (Show QR), Renter Scans (Input) 
                        Return: Renter Generates (Show QR), Owner Scans (Input)
                    */}
                    {(variant === 'pickup' && role === 'owner') || (variant === 'return' && role === 'renter') ? (
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
                                        Show this code to the {role === 'owner' ? 'renter' : 'owner'}. <br />
                                        Once they enter it, the {variant === 'pickup' ? 'booking will become active' : 'return will be confirmed'}.
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
                                Verify & Start Rental
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
