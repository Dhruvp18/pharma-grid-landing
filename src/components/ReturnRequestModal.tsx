import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, AlertTriangle, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/config";
import { supabase } from "@/integrations/supabase/client";

interface ReturnRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    bookingId: string;
    itemId: string;
    onSuccess: () => void;
}

export const ReturnRequestModal = ({ isOpen, onClose, bookingId, itemId, onSuccess }: ReturnRequestModalProps) => {
    const [step, setStep] = useState<"upload" | "result">("upload");
    const [files, setFiles] = useState<File[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [auditResult, setAuditResult] = useState<any>(null);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFiles(Array.from(e.dataTransfer.files));
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFiles(Array.from(e.target.files));
        }
    };

    const runReturnAudit = async () => {
        if (files.length === 0) {
            toast.error("Please upload photos of the item condition.");
            return;
        }

        setIsAnalyzing(true);
        const data = new FormData();
        data.append("item_id", itemId);
        files.forEach((file) => {
            data.append("images", file);
        });

        try {
            const response = await fetch(`${API_BASE_URL}/audit-return`, {
                method: "POST",
                body: data,
            });
            const result = await response.json();

            if (response.ok) {
                setAuditResult(result);
                setStep("result");
            } else {
                toast.error(result.error || "Analysis failed");
            }
        } catch (error) {
            console.error("Audit error:", error);
            toast.error("Failed to connect to Return Auditor.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const confirmReturnRequest = async () => {
        try {
            // Update booking status
            const { error } = await supabase
                .from("bookings")
                .update({ status: 'return_requested' })
                .eq("id", bookingId);

            if (error) throw error;

            toast.success("Return Requested Successfully!");
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            toast.error("Failed to submit return request");
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !isAnalyzing && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Return Item Inspection</DialogTitle>
                </DialogHeader>

                {step === "upload" ? (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Before returning, please upload current photos of the item.
                            Our AI will compare them with the original condition logic to check for new damages.
                        </p>

                        <div
                            className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all ${dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                        >
                            <Input
                                type="file"
                                multiple
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={handleFileChange}
                                accept="image/*"
                            />
                            <div className="flex flex-col items-center gap-2 pointer-events-none">
                                <div className="p-3 rounded-full bg-secondary text-primary">
                                    <Upload className="w-6 h-6" />
                                </div>
                                <h3 className="font-semibold text-sm">Drop photos here</h3>
                            </div>
                        </div>

                        {files.length > 0 && (
                            <div className="grid grid-cols-3 gap-2">
                                {files.map((file, idx) => (
                                    <div key={idx} className="relative aspect-square rounded overflow-hidden border">
                                        <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="preview" />
                                        <button onClick={() => removeFile(idx)} className="absolute top-0 right-0 bg-red-500 text-white rounded-bl p-0.5">
                                            <XCircle className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <Button onClick={runReturnAudit} disabled={isAnalyzing || files.length === 0} className="w-full">
                            {isAnalyzing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing Condition...</> : "Analyze & Verify"}
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className={`p-4 rounded-xl border ${auditResult?.status === 'clear' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-start gap-4">
                                <div className={`p-2 rounded-full ${auditResult?.status === 'clear' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                    {auditResult?.status === 'clear' ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                                </div>
                                <div className="flex-1 space-y-2">
                                    <h4 className="font-bold text-lg">{auditResult?.status === 'clear' ? 'Condition Verified' : 'Damage Detected'}</h4>
                                    <p className="text-sm text-foreground/80">{auditResult?.analysis}</p>

                                    {auditResult?.status === 'damage_reported' && (
                                        <div className="bg-white/60 p-2 rounded border border-red-100 mt-2">
                                            <p className="font-semibold text-red-700 text-sm">New Flaws: {auditResult?.new_damage_found?.join(", ")}</p>
                                            {auditResult?.suggested_deduction > 0 && (
                                                <p className="font-bold text-red-800 mt-1">Suggested Deduction: ₹{auditResult.suggested_deduction}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <p className="text-xs text-muted-foreground text-center">
                            By proceeding, you agree to the condition report.
                            {auditResult?.suggested_deduction > 0 ? " The owner will be notified of the damage and may claim the deduction." : ""}
                        </p>

                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => setStep("upload")} className="flex-1">Back</Button>
                            <Button onClick={confirmReturnRequest} className="flex-1">Confirm Return Request</Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
