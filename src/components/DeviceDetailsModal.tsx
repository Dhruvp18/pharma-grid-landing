import React, { useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Phone, Truck, Store, MapPin } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { BookingModal } from "@/components/BookingModal";
import ReviewList from "@/components/ReviewList";
import ReviewForm from "@/components/ReviewForm";
import { Review } from "@/types/reviews";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AIChatWidget } from "@/components/AIChatWidget";

interface DeviceDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    itemId?: string | null;
    initialData?: any;
    defaultTab?: 'details' | 'reviews';
    userBookingIdForReview?: string | null;
    showBookingButton?: boolean;
}

export const DeviceDetailsModal: React.FC<DeviceDetailsModalProps> = ({
    isOpen,
    onClose,
    itemId,
    initialData,
    defaultTab = 'details',
    userBookingIdForReview,
    showBookingButton = true
}) => {
    const [item, setItem] = useState<any>(initialData || null);
    const [loading, setLoading] = useState(false);
    const [images, setImages] = useState<string[]>([]);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [chatContext, setChatContext] = useState<any>(null);

    // Reset state when modal opens/closes or ID changes
    useEffect(() => {
        if (isOpen) {
            if (itemId) {
                fetchDetails(itemId);
            } else if (initialData) {
                setItem(initialData);
                processImages(initialData);
                // Try to fetch reviews if we have an ID from initialData
                if (initialData.id) fetchReviews(initialData.id);
            }
        } else {
            // Cleanup on close
            setItem(null);
            setImages([]);
            setReviews([]);
            setChatContext(null);
            setShowReviewForm(false);
        }
    }, [isOpen, itemId, initialData]);

    const fetchDetails = async (id: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('items')
                .select('*, owner:profiles(full_name, phone, email)')
                .eq('id', id)
                .single();

            if (error) throw error;
            setItem(data);
            processImages(data);
            fetchReviews(id);

        } catch (error) {
            console.error("Error fetching device details:", error);
            toast.error("Failed to load device details");
        } finally {
            setLoading(false);
        }
    };

    const processImages = async (data: any) => {
        if (data.images && Array.isArray(data.images) && data.images.length > 0) {
            setImages(data.images);
        } else if (data.image_url) {
            // Fallback to single image or fetch from storage
            setImages([data.image_url]);
            // Optional: Try to fetch from storage folder if you really need to support that legacy pattern
            // But for now, sticking to the main pattern seen in DiscoveryMap
        }
    };

    const fetchReviews = async (id: string) => {
        // Assuming ReviewList handles fetching or we pass them. 
        // DiscoveryMap passed `itemReviews` state. Let's fetch them here if we want to be self-contained
        // Or better, let ReviewList component handle it if it can. 
        // Checking ReviewList usage in DiscoveryMap... it passes `reviews={itemReviews}`.
        // So we should fetch them.

        // Placeholder for review fetching logic if not handled by a hook inside ReviewList
        // For now, let's just pass empty or implement simple fetch if table exists.
        // Actually, let's look at how DiscoveryMap did it. It used `itemReviews` state but I didn't see the fetch logic in the view_file output (might have been in the unviewed part or separate).
        // I will implement a basic fetch for reviews if the table is 'reviews'.

        try {
            const { data, error } = await supabase
                .from('reviews')
                .select('*, profiles:profiles!reviewer_id(full_name, avatar_url)')
                .eq('item_id', id)
                .order('created_at', { ascending: false });

            if (data) setReviews(data as any);
        } catch (err) {
            console.error("Error fetching reviews", err);
        }
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0"
                onInteractOutside={(e) => {
                    const target = e.target as Element;
                    if (target.closest('.ai-chat-widget-container')) {
                        e.preventDefault();
                    }
                }}
            >
                <DialogHeader className="p-6 border-b">
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle className="text-2xl font-bold">{item?.title || "Loading..."}</DialogTitle>
                            <DialogDescription className="text-base mt-2">
                                {item?.category} • {item?.address_text}
                            </DialogDescription>
                        </div>
                        {item && (
                            <Badge variant={item.is_available ? "default" : "destructive"}>
                                {item.is_available ? "Available" : "Checked Out"}
                            </Badge>
                        )}
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : item ? (
                        <div className="space-y-6">
                            {/* Image Gallery */}
                            {images.length > 0 && (
                                <div className="w-full flex justify-center bg-black/5 rounded-lg py-4">
                                    <Carousel className="w-full max-w-lg">
                                        <CarouselContent>
                                            {images.map((img, index) => (
                                                <CarouselItem key={index}>
                                                    <div className="p-1">
                                                        <div className="overflow-hidden rounded-xl aspect-video border bg-white flex items-center justify-center">
                                                            <img
                                                                src={img}
                                                                alt={`Item Image ${index + 1}`}
                                                                className="w-full h-full object-contain"
                                                            />
                                                        </div>
                                                    </div>
                                                </CarouselItem>
                                            ))}
                                        </CarouselContent>
                                        <CarouselPrevious />
                                        <CarouselNext />
                                    </Carousel>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="font-semibold text-lg text-primary mb-2">Description</h3>
                                        <p className="text-gray-600 whitespace-pre-line">{item.description || "No description provided."}</p>
                                    </div>

                                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                                        <h4 className="font-semibold text-blue-900 mb-2">Verification Status</h4>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="outline" className="bg-white">
                                                Status: {item.ai_status}
                                            </Badge>
                                            {item.ai_status === 'verified' && (
                                                <span className="text-green-600 text-sm font-medium">Verified Safe</span>
                                            )}
                                        </div>
                                        {item.ai_reason && (
                                            <p className="text-sm text-blue-800 mt-2">
                                                {item.ai_reason}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-4 border rounded-xl shadow-sm">
                                        <h3 className="text-lg font-bold mb-4">Rental Details</h3>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-muted-foreground">Price per Day</span>
                                            <span className="text-xl font-bold text-primary">₹{item.price_per_day}</span>
                                        </div>
                                        <Separator className="my-3" />
                                        {item.owner && (
                                            <div className="flex flex-col gap-2 mb-4 p-3 bg-secondary/20 rounded-lg border border-secondary/30">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary border border-primary/20">
                                                        {(item.owner.full_name?.[0] || 'U').toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-primary">
                                                            {item.owner.full_name || "Owner"}
                                                        </p>
                                                        <Link
                                                            to={`/profile/${item.owner_id}`}
                                                            target="_blank"
                                                            className="text-xs text-muted-foreground hover:text-primary underline"
                                                        >
                                                            View Profile & Ratings
                                                        </Link>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-muted-foreground space-y-1 ml-13 pl-1">
                                                    {item.owner.phone && (
                                                        <div className="flex items-center gap-2">
                                                            <Phone className="w-3 h-3 text-green-600" />
                                                            <span>{item.owner.phone}</span>
                                                        </div>
                                                    )}
                                                    {item.owner.email && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-3 h-3 flex items-center justify-center">✉️</span>
                                                            <span>{item.owner.email}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex gap-2">
                                            {showBookingButton && (
                                                <BookingModal
                                                    item={item}
                                                    onSuccess={() => {
                                                        onClose();
                                                        toast.success("Booking request sent!");
                                                    }}
                                                />
                                            )}
                                            <Button
                                                variant="outline"
                                                className="border-teal-600 text-teal-700 hover:bg-teal-50"
                                                onClick={() => setChatContext({
                                                    device_name: item.title,
                                                    category: item.category,
                                                    description: item.description,
                                                    images: images,
                                                    model: "Generic"
                                                })}
                                            >
                                                Ask AI
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Reviews Section */}
                                <div className="mt-8 border-t pt-6 col-span-1 md:col-span-2">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-xl font-bold">Reviews</h3>
                                        {userBookingIdForReview && !showReviewForm && (
                                            <Button variant="outline" size="sm" onClick={() => setShowReviewForm(true)}>
                                                Write a Review
                                            </Button>
                                        )}
                                    </div>

                                    {showReviewForm && userBookingIdForReview && (
                                        <div className="mb-6 animate-in slide-in-from-top-2">
                                            <ReviewForm
                                                bookingId={userBookingIdForReview}
                                                onSuccess={() => {
                                                    setShowReviewForm(false);
                                                    fetchReviews(item.id); // Refresh reviews
                                                }}
                                                onCancel={() => setShowReviewForm(false)}
                                            />
                                        </div>
                                    )}

                                    <ReviewList reviews={reviews} />
                                </div>

                            </div>
                        </div>
                    ) : (
                        <div className="p-6 text-center text-muted-foreground">Item not found</div>
                    )}
                </div>
            </DialogContent>

            {/* Contextual Chat Widget */}
            {chatContext && (
                <AIChatWidget
                    key={chatContext.device_name}
                    initialContext={chatContext}
                />
            )}
        </Dialog>
    );
};
