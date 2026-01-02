import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const OnboardingModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        full_name: "",
        phone: "",
    });
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const checkProfile = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;

            setUserId(session.user.id);

            try {
                const { data, error } = await supabase
                    .from("profiles")
                    .select("full_name, phone")
                    .eq("id", session.user.id)
                    .single();

                if (error && error.code !== "PGRST116") {
                    console.error("Error fetching profile:", error);
                    return;
                }

                // If no profile data or missing fields, open modal
                if (!data || !data.full_name || !data.phone) {
                    setIsOpen(true);
                    // Pre-fill if some data exists
                    if (data) {
                        setFormData({
                            full_name: data.full_name || "",
                            phone: data.phone || "",
                        });
                    }
                }
            } catch (err) {
                console.error("Unexpected error checking profile:", err);
            }
        };

        checkProfile();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                checkProfile();
            } else {
                setIsOpen(false);
                setUserId(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleSubmit = async () => {
        if (!formData.full_name || !formData.phone) {
            toast.error("Please fill in all fields");
            return;
        }

        if (!userId) return;

        setIsLoading(true);
        try {
            const { error } = await supabase
                .from("profiles")
                .upsert({
                    id: userId,
                    full_name: formData.full_name,
                    phone: formData.phone,
                });

            if (error) {
                console.error("Error updating profile:", error);
                toast.error("Failed to save details. Please try again.");
            } else {
                toast.success("Profile updated successfully!");
                setIsOpen(false);
            }
        } catch (err) {
            console.error("Unexpected error saving profile:", err);
            toast.error("An unexpected error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            // Prevent closing if data is missing (force onboarding)
            if (!open && (!formData.full_name || !formData.phone)) {
                // Do nothing, keep open
            } else {
                setIsOpen(open);
            }
        }}>
            <DialogContent className="sm:max-w-[425px]" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>Welcome! Complete your Profile</DialogTitle>
                    <DialogDescription>
                        We need a few details to help you connect with others safely.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="full_name">Full Name</Label>
                        <Input
                            id="full_name"
                            placeholder="John Doe"
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                            id="phone"
                            placeholder="+91 9876543210"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSubmit} disabled={isLoading} className="w-full">
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save & Continue
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default OnboardingModal;
