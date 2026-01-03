import React, { useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface EditDeviceModalProps {
    isOpen: boolean;
    onClose: () => void;
    itemId: string | null;
    onSuccess: () => void;
}

export const EditDeviceModal: React.FC<EditDeviceModalProps> = ({
    isOpen,
    onClose,
    itemId,
    onSuccess,
}) => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        title: "",
        category: "",
        description: "",
        price_per_day: "",
        address_text: "",
        contact_email: "",
        contact_phone: "",
    });

    useEffect(() => {
        if (isOpen && itemId) {
            fetchDeviceDetails(itemId);
        } else {
            setFormData({
                title: "",
                category: "",
                description: "",
                price_per_day: "",
                address_text: "",
                contact_email: "",
                contact_phone: "",
            });
        }
    }, [isOpen, itemId]);

    const fetchDeviceDetails = async (id: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('items')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            if (data) {
                setFormData({
                    title: data.title || "",
                    category: data.category || "",
                    description: data.description || "",
                    price_per_day: data.price_per_day?.toString() || "",
                    address_text: data.address_text || "",
                    contact_email: data.contact_email || "",
                    contact_phone: data.contact_phone || "",
                });
            }
        } catch (error) {
            console.error("Error fetching device details:", error);
            toast.error("Failed to load device details");
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!itemId) return;
        if (!formData.title || !formData.price_per_day) {
            toast.error("Title and Price are required");
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from('items')
                .update({
                    title: formData.title,
                    category: formData.category,
                    description: formData.description,
                    price_per_day: parseFloat(formData.price_per_day),
                    address_text: formData.address_text,
                    contact_email: formData.contact_email,
                    contact_phone: formData.contact_phone,
                    // We don't update validation status or image here to avoid re-verification complexity for now
                })
                .eq('id', itemId);

            if (error) throw error;

            toast.success("Device details updated successfully");
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error updating device:", error);
            toast.error("Failed to update device");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Device Details</DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-title">Device Name</Label>
                            <Input
                                id="edit-title"
                                value={formData.title}
                                onChange={(e) => handleInputChange("title", e.target.value)}
                                placeholder="Device Name"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-category">Category</Label>
                                <Select
                                    value={formData.category}
                                    onValueChange={(val) => handleInputChange("category", val)}
                                >
                                    <SelectTrigger id="edit-category">
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Respiratory">Respiratory</SelectItem>
                                        <SelectItem value="Mobility">Mobility</SelectItem>
                                        <SelectItem value="Beds">Hospital Beds</SelectItem>
                                        <SelectItem value="Monitors">Monitors</SelectItem>
                                        <SelectItem value="Consumables">Consumables</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-price">Price per Day (₹)</Label>
                                <Input
                                    id="edit-price"
                                    type="number"
                                    value={formData.price_per_day}
                                    onChange={(e) => handleInputChange("price_per_day", e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-description">Description</Label>
                            <Textarea
                                id="edit-description"
                                value={formData.description}
                                onChange={(e) => handleInputChange("description", e.target.value)}
                                placeholder="Describe the condition, age, etc."
                                className="min-h-[100px]"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-address">Location (Address Text)</Label>
                            <Input
                                id="edit-address"
                                value={formData.address_text}
                                onChange={(e) => handleInputChange("address_text", e.target.value)}
                                placeholder="e.g. Andheri West, Mumbai"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-email">Contact Email</Label>
                                <Input
                                    id="edit-email"
                                    value={formData.contact_email}
                                    onChange={(e) => handleInputChange("contact_email", e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-phone">Contact Phone</Label>
                                <Input
                                    id="edit-phone"
                                    value={formData.contact_phone}
                                    onChange={(e) => handleInputChange("contact_phone", e.target.value)}
                                />
                            </div>
                        </div>

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    "Save Changes"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
};
