export interface Review {
    id: string;
    booking_id: string;
    reviewer_id: string;
    item_id: string;
    owner_id: string;
    rating: number;
    comment: string;
    created_at: string;
    profiles?: {
        full_name: string;
        avatar_url: string | null;
    };
    items?: {
        title: string;
    };
}
