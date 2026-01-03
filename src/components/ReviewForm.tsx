import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ReviewFormProps {
    bookingId: string;
    onSuccess?: () => void;
    onCancel?: () => void;
}

const ReviewForm = ({ bookingId, onSuccess, onCancel }: ReviewFormProps) => {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const [hoverRating, setHoverRating] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (rating === 0) {
            toast.error("Please select a rating");
            return;
        }

        setIsSubmitting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast.error("You must be logged in to review");
                return;
            }

            // Using our new backend endpoint to ensure proper linking
            // Or simpler direct supabase insert if RLS allows. 
            // Implementation plan said backend endpoint, but let's try direct to match existing patterns
            // Actually main.py has @app.post("/reviews"), let's use that for "business logic" safety 
            // OR stick to Supabase client if we trust RLS.
            // Let's use the valid Supabase client method but call the table directly if simple, 
            // BUT we implemented the endpoint in main.py to handle the logic of finding item_id/owner_id from booking.
            // So we should call the API or replicate logic here. 
            // Calling API is cleaner given the backend work we just did.

            // Wait, we can also just select the booking here and then insert. 
            // Let's use the API endpoint we created: POST /reviews

            const response = await fetch("http://127.0.0.1:8000/reviews", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    booking_id: bookingId,
                    rating,
                    comment,
                    reviewer_id: session.user.id
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to submit review");
            }

            toast.success("Review submitted successfully!");
            onSuccess?.();

        } catch (error: any) {
            console.error("Review error:", error);
            toast.error(error.message || "Failed to submit review");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-4 p-4 border rounded-lg bg-secondary/10">
            <h3 className="font-semibold text-lg">Write a Review</h3>

            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        className="transition-transform hover:scale-110 focus:outline-none"
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRating(star)}
                    >
                        <Star
                            className={`w-8 h-8 ${star <= (hoverRating || rating)
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-gray-300"
                                }`}
                        />
                    </button>
                ))}
            </div>

            <Textarea
                placeholder="Share your experience with this device and owner..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[100px]"
            />

            <div className="flex justify-end gap-2">
                {onCancel && (
                    <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
                        Cancel
                    </Button>
                )}
                <Button onClick={handleSubmit} disabled={isSubmitting || rating === 0}>
                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Submit Review
                </Button>
            </div>
        </div>
    );
};

export default ReviewForm;
