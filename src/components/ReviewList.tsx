import { Review } from "@/types/reviews";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ReviewListProps {
    reviews: Review[];
    isLoading?: boolean;
    compact?: boolean;
}

const ReviewList = ({ reviews, isLoading, compact = false }: ReviewListProps) => {
    if (isLoading) {
        return <div className="space-y-4 animate-pulse">
            {[1, 2].map((i) => (
                <div key={i} className="flex gap-4 p-4 border rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-gray-200"></div>
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 w-1/4 rounded"></div>
                        <div className="h-4 bg-gray-200 w-3/4 rounded"></div>
                    </div>
                </div>
            ))}
        </div>;
    }

    if (reviews.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground bg-secondary/20 rounded-lg">
                <Star className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p>No reviews yet.</p>
            </div>
        );
    }

    return (
        <div className={`space-y-4 ${compact ? 'max-h-[300px] overflow-y-auto' : ''}`}>
            {reviews.map((review) => (
                <div key={review.id} className="bg-card border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8 md:w-10 md:h-10 border">
                                <AvatarImage src={review.profiles?.avatar_url || ""} />
                                <AvatarFallback>{review.profiles?.full_name?.charAt(0) || "U"}</AvatarFallback>
                            </Avatar>
                            <div>
                                <h4 className="font-semibold text-sm md:text-base">{review.profiles?.full_name || "Anonymous User"}</h4>
                                <p className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded-full">
                            <Star className="w-3 h-3 md:w-4 md:h-4 fill-yellow-500 text-yellow-500 mr-1" />
                            <span className="font-bold text-sm text-yellow-700 dark:text-yellow-500">{review.rating}</span>
                        </div>
                    </div>

                    {review.items?.title && (
                        <div className="mb-2 text-xs text-muted-foreground bg-secondary/50 inline-block px-2 py-1 rounded">
                            Review for: <span className="font-medium">{review.items.title}</span>
                        </div>
                    )}

                    <p className="text-sm md:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                        {review.comment}
                    </p>
                </div>
            ))}
        </div>
    );
};

export default ReviewList;
