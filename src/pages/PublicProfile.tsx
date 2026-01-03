import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, MapPin, Calendar, ShieldCheck, Store, Loader2 } from "lucide-react";
import ReviewList from "@/components/ReviewList";
import { Review } from "@/types/reviews";
import { format } from "date-fns";
import { Helmet } from "react-helmet-async";

interface ProfileData {
    id: string;
    full_name: string;
    avatar_url: string | null;
    created_at: string;
}

interface ProfileStats {
    rating: number;
    total_reviews: number;
}

const PublicProfile = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [stats, setStats] = useState<ProfileStats>({ rating: 0, total_reviews: 0 });
    const [reviews, setReviews] = useState<Review[]>([]);
    const [items, setItems] = useState<any[]>([]); // Using any for simplicity for now, ideally Item interface
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (id) {
            fetchProfileData();
        }
    }, [id]);

    const fetchProfileData = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Profile & Stats from our new API
            const response = await fetch(`http://127.0.0.1:8000/profile/${id}`);
            if (!response.ok) throw new Error("Failed to fetch profile");
            const data = await response.json();

            setProfile(data.profile);
            setStats({
                rating: data.rating,
                total_reviews: data.total_reviews
            });

            // 2. Fetch Reviews
            const reviewsResponse = await fetch(`http://127.0.0.1:8000/reviews/owner/${id}`);
            if (reviewsResponse.ok) {
                const reviewsData = await reviewsResponse.json();
                setReviews(reviewsData);
            }

            // 3. Fetch Listings (Direct Supabase)
            const { data: itemsData } = await supabase
                .from("items")
                .select("*")
                .eq("owner_id", id)
                .eq("is_available", true); // Only active listings

            if (itemsData) setItems(itemsData);

        } catch (error) {
            console.error("Profile fetch error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background">
                <Navbar />
                <div className="flex justify-center items-center h-[80vh]">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen bg-background">
                <Navbar />
                <div className="flex flex-col justify-center items-center h-[80vh] text-center">
                    <h2 className="text-2xl font-bold mb-2">User Not Found</h2>
                    <p className="text-muted-foreground">The profile you are looking for does not exist.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background/50">
            <Helmet>
                <title>{profile.full_name || "Profile"} | Pharma-Grid</title>
            </Helmet>
            <Navbar />

            <main className="container max-w-5xl py-24 px-4">
                {/* Header Profile Card */}
                <div className="bg-card border rounded-3xl p-6 md:p-10 shadow-sm mb-8 flex flex-col md:flex-row items-center md:items-start gap-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-primary/10 to-blue-200/20 -z-10" />

                    <Avatar className="w-24 h-24 md:w-32 md:h-32 border-4 border-background shadow-lg">
                        <AvatarImage src={profile.avatar_url || ""} />
                        <AvatarFallback className="text-2xl md:text-4xl bg-primary/5 text-primary">
                            {profile.full_name?.charAt(0) || "U"}
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 text-center md:text-left space-y-2 mt-2">
                        <h1 className="text-2xl md:text-3xl font-bold">{profile.full_name || "Pharma User"}</h1>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-muted-foreground text-sm">
                            <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                Member since {new Date(profile.created_at || Date.now()).getFullYear()}
                            </span>
                            <span className="flex items-center gap-1">
                                <ShieldCheck className="w-4 h-4 text-green-600" />
                                ID Verified
                            </span>
                        </div>

                        <div className="flex items-center justify-center md:justify-start gap-2 pt-2">
                            <div className="flex items-center bg-yellow-100 dark:bg-yellow-900/30 px-3 py-1.5 rounded-full">
                                <Star className="w-4 h-4 md:w-5 md:h-5 fill-yellow-500 text-yellow-500 mr-1.5" />
                                <span className="font-bold text-lg text-yellow-700 dark:text-yellow-500">{stats.rating}</span>
                                <span className="text-muted-foreground ml-1 text-sm">({stats.total_reviews} reviews)</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 min-w-[150px]">
                        <div className="bg-primary/5 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-primary">{items.length}</p>
                            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Active Listings</p>
                        </div>
                    </div>
                </div>

                {/* Content Tabs */}
                <Tabs defaultValue="listings" className="space-y-6">
                    <TabsList className="grid w-full md:w-[400px] grid-cols-2">
                        <TabsTrigger value="listings">Listings</TabsTrigger>
                        <TabsTrigger value="reviews">Reviews</TabsTrigger>
                    </TabsList>

                    <TabsContent value="listings" className="animate-in fade-in-50 duration-500">
                        {items.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed rounded-xl">
                                <Store className="w-10 h-10 mx-auto text-muted-foreground mb-3 opacity-20" />
                                <p className="text-muted-foreground">No active listings at the moment.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {items.map((item) => (
                                    <div
                                        key={item.id}
                                        className="group bg-card rounded-2xl overflow-hidden border hover:shadow-lg transition-all cursor-pointer"
                                        onClick={() => navigate(`/map?id=${item.id}`)}
                                    >
                                        <div className="aspect-[4/3] overflow-hidden relative bg-gray-100">
                                            <img
                                                src={item.image_url || "https://images.unsplash.com/photo-1584515933487-779824d29309?w=400&auto=format&fit=crop"}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                alt={item.title}
                                            />
                                            <div className="absolute top-2 right-2">
                                                <Badge variant="secondary" className="backdrop-blur-sm shadow-sm">{item.category}</Badge>
                                            </div>
                                        </div>
                                        <div className="p-4">
                                            <h3 className="font-semibold truncate mb-1">{item.title}</h3>
                                            <div className="flex items-center text-sm text-muted-foreground mb-3">
                                                <MapPin className="w-3.5 h-3.5 mr-1" />
                                                <span className="truncate">{item.address_text || "Mumbai"}</span>
                                            </div>
                                            <div className="flex items-center justify-between font-medium">
                                                <span className="text-primary">₹{item.price_per_day}/day</span>
                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Available</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="reviews" className="animate-in fade-in-50 duration-500">
                        <Card>
                            <CardContent className="p-6">
                                <ReviewList reviews={reviews} />
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
};

export default PublicProfile;
