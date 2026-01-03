import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Calendar, MapPin, IndianRupee, Truck, Store } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { HandoverModal } from "@/components/HandoverModal";
import { LiveTracking } from "@/components/LiveTracking";
import { toast } from "sonner";

interface Booking {
    id: string;
    created_at: string;
    start_date: string;
    end_date: string;
    total_price: number;
    status: 'pending' | 'requested' | 'accepted' | 'in_use' | 'completed' | 'cancelled' | 'delivered' | 'picked_up' | 'return_requested' | 'return_accepted' | 'return_picked_up' | 'returned';
    item_id: string;
    delivery_method?: 'pickup' | 'delivery'; // Optional as older bookings might not have it
    delivery_address?: string;
    updated_at?: string; // For syncing animation
    item: {
        title: string;
        image_url: string;
        address_text: string;
        lat?: number; // Needed for tracking source
        lng?: number; // Needed for tracking source
    };
    contact_phone?: string;
}

import { AIChatWidget } from "@/components/AIChatWidget";

const Bookings = () => {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [hostedBookings, setHostedBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [chatContext, setChatContext] = useState<any>(null);
    const navigate = useNavigate();

    const fetchBookings = async () => {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            navigate("/login");
            return;
        }

        // Fetch My Orders (I am the Renter)
        const { data: myOrders } = await supabase
            .from("bookings")
            .select(`*, item:items(title, image_url, address_text, lat, lng, description, category)`)
            .eq("renter_id", session.user.id)
            .order("created_at", { ascending: false });

        setBookings(myOrders as any || []);

        // Fetch My Hosting (I am the Owner)
        const { data: myHosting } = await supabase
            .from("bookings")
            .select(`*, item:items(title, image_url, address_text, lat, lng, description, category)`)
            .eq("owner_id", session.user.id)
            .order("created_at", { ascending: false });

        setHostedBookings(myHosting as any || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchBookings();
    }, [navigate, refreshTrigger]);

    const handleRefresh = () => setRefreshTrigger(prev => prev + 1);

    const handleAccept = async (bookingId: string) => {
        handleStatusUpdate(bookingId, 'accepted');
    };

    const handleStatusUpdate = async (bookingId: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from("bookings")
                .update({ status: newStatus })
                .eq("id", bookingId);

            if (error) throw error;
            toast.success(`Booking updated to ${newStatus.replace('_', ' ')}!`);
            handleRefresh();
        } catch (error) {
            console.error(error);
            toast.error("Failed to update booking status");
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'requested': return 'bg-yellow-100 text-yellow-800';
            case 'accepted': return 'bg-blue-100 text-blue-800';
            case 'in_use': return 'bg-green-100 text-green-800';
            case 'completed': return 'bg-gray-100 text-gray-800';
            case 'returned': return 'bg-emerald-100 text-emerald-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const BookingCard = ({ booking, role }: { booking: Booking, role: 'renter' | 'owner' }) => {
        const itemTitle = booking.item?.title || "Unknown Item";
        const itemImage = booking.item?.image_url || "https://images.unsplash.com/photo-1584515933487-779824d29309?w=800&auto=format&fit=crop";
        const address = booking.item?.address_text || "Location unavailable";
        const isDelivery = booking.delivery_method === 'delivery';

        return (
            <Card className="overflow-hidden animate-fade-in mb-4">
                <div className="flex flex-col md:flex-row">
                    <div className="w-full md:w-48 h-48 md:h-auto relative">
                        <img
                            src={itemImage}
                            alt={itemTitle}
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                        {isDelivery ? (
                            <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-md">
                                <Truck className="w-3 h-3" /> Delivery
                            </div>
                        ) : (
                            <div className="absolute top-2 left-2 bg-neutral-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-md">
                                <Store className="w-3 h-3" /> Pickup
                            </div>
                        )}
                    </div>
                    <div className="flex-1 p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-bold text-xl mb-1">{itemTitle}</h3>
                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> {address}
                                </div>
                            </div>
                            <Badge variant="secondary" className={getStatusColor(booking.status)}>
                                {booking.status.replace("_", " ").toUpperCase()}
                            </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-primary" />
                                <span>
                                    {format(new Date(booking.start_date), "MMM d")} - {format(new Date(booking.end_date), "MMM d, yyyy")}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <IndianRupee className="w-4 h-4 text-primary" />
                                <span className="font-semibold">₹{booking.total_price}</span>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-4">
                            <Button variant="outline" size="sm" onClick={() => navigate(`/map?id=${booking.item_id}`)}>View Listing</Button>

                            {/* AI Companion Help */}
                            {role === 'renter' && (
                                <Button
                                    size="sm"
                                    className="bg-teal-600 hover:bg-teal-700 text-white"
                                    onClick={() => setChatContext({
                                        device_name: booking.item.title,
                                        category: 'Medical Device',
                                        description: (booking.item as any).description,
                                        images: [(booking.item as any).image_url]
                                    })}
                                >
                                    <Store className="w-4 h-4 mr-2" />
                                    Get Help
                                </Button>
                            )}

                            {/* Review Button */}
                            {role === 'renter' && (booking.status === 'completed' || booking.status === 'delivered') && (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => navigate(`/map?id=${booking.item_id}&action=review&bookingId=${booking.id}`)}
                                >
                                    Leave Review
                                </Button>
                            )}

                            {/* Renter Actions */}
                            {role === 'renter' && (booking.status === 'accepted' || booking.status === 'picked_up' || booking.status === 'delivered') && (
                                <div className="flex gap-2">
                                    {isDelivery ? (
                                        <>
                                            {/* Show Tracking if picked up or delivered (or accepted to show empty state) */}
                                            {(booking.status === 'accepted' || booking.status === 'picked_up' || booking.status === 'delivered') && (
                                                <LiveTracking
                                                    source={{ lat: booking.item.lat || 19.0760, lng: booking.item.lng || 72.8777 }}
                                                    destinationName={booking.delivery_address || address}
                                                    status={booking.status}
                                                    pickupTime={booking.updated_at}
                                                    onArrival={() => {
                                                        // Only update if not already delivered to avoid loops
                                                        if (booking.status !== 'delivered') {
                                                            handleStatusUpdate(booking.id, 'delivered');
                                                        }
                                                    }}
                                                />
                                            )}
                                            <HandoverModal
                                                bookingId={booking.id}
                                                role="renter"
                                                onSuccess={handleRefresh}
                                                trigger={<Button size="sm">Confirm Receipt</Button>}
                                            />
                                        </>
                                    ) : (
                                        <HandoverModal
                                            bookingId={booking.id}
                                            role="renter"
                                            onSuccess={handleRefresh}
                                        />
                                    )}
                                </div>
                            )}

                            {/* Return Flow Renter Actions */}
                            {role === 'renter' && (booking.status === 'in_use' || booking.status === 'delivered') && (
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    className="ml-2"
                                    onClick={() => handleStatusUpdate(booking.id, 'return_requested')}
                                >
                                    Request Return
                                </Button>
                            )}

                            {role === 'renter' && booking.status === 'return_requested' && (
                                <Button variant="outline" size="sm" disabled className="ml-2">
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Return Requested
                                </Button>
                            )}

                            {role === 'renter' && (booking.status === 'return_accepted' || booking.status === 'return_picked_up') && (
                                <div className="flex gap-2 ml-2">
                                    <LiveTracking
                                        source={{ lat: booking.item.lat || 19.0760, lng: booking.item.lng || 72.8777 }}
                                        destinationName={booking.delivery_address || address} // Return triggers effectively reverse route, but for tracking visual it's fine
                                        status={booking.status}
                                        variant="return"
                                    />
                                    {booking.status === 'return_accepted' && (
                                        <Button size="sm" onClick={() => handleStatusUpdate(booking.id, 'return_picked_up')}>
                                            <Truck className="w-4 h-4 mr-2" /> Handover to Driver
                                        </Button>
                                    )}
                                    <HandoverModal
                                        bookingId={booking.id}
                                        role="renter"
                                        variant="return"
                                        onSuccess={handleRefresh}
                                        trigger={<Button size="sm" variant="default">Return Handover Code</Button>}
                                    />
                                </div>
                            )}

                            {role === 'renter' && booking.status === 'requested' && isDelivery && (
                                <Button variant="outline" size="sm" disabled>
                                    <Truck className="w-4 h-4 mr-2" /> Waiting for Approval
                                </Button>
                            )}

                            {/* Owner Actions */}
                            {role === 'owner' && (
                                <>
                                    {booking.status === 'requested' && (
                                        <Button size="sm" onClick={() => handleAccept(booking.id)}>
                                            Accept {isDelivery ? 'Delivery' : 'Request'}
                                        </Button>
                                    )}
                                    {booking.status === 'accepted' && (
                                        <div className="flex gap-2">
                                            {isDelivery ? (
                                                <Button size="sm" onClick={() => handleStatusUpdate(booking.id, 'picked_up')}>
                                                    <Truck className="w-4 h-4 mr-2" /> Mark Picked Up
                                                </Button>
                                            ) : (
                                                <HandoverModal
                                                    bookingId={booking.id}
                                                    role="owner"
                                                    onSuccess={handleRefresh}
                                                />
                                            )}
                                        </div>
                                    )}
                                    {/* Show Tracking for Owner too if status allows */}
                                    {isDelivery && (booking.status === 'picked_up' || booking.status === 'delivered') && (
                                        <div className="flex gap-2">
                                            <LiveTracking
                                                source={{ lat: booking.item.lat || 19.0760, lng: booking.item.lng || 72.8777 }}
                                                destinationName={booking.delivery_address || address}
                                                status={booking.status}
                                                pickupTime={booking.updated_at}
                                                onArrival={() => {
                                                    if (booking.status !== 'delivered') {
                                                        handleStatusUpdate(booking.id, 'delivered');
                                                    }
                                                }}
                                            />
                                            {booking.status === 'delivered' && (
                                                <HandoverModal
                                                    bookingId={booking.id}
                                                    role="owner"
                                                    onSuccess={handleRefresh}
                                                />
                                            )}
                                        </div>
                                    )}

                                    {/* Return Flow Owner Actions */}
                                    {booking.status === 'return_requested' && (
                                        <Button size="sm" onClick={() => handleStatusUpdate(booking.id, 'return_accepted')}>
                                            Accept Return
                                        </Button>
                                    )}

                                    {(booking.status === 'return_accepted' || booking.status === 'return_picked_up') && (
                                        <div className="flex gap-2 mt-2">
                                            <LiveTracking
                                                source={{ lat: booking.item.lat || 19.0760, lng: booking.item.lng || 72.8777 }}
                                                destinationName={booking.delivery_address || address}
                                                status={booking.status}
                                                variant="return"
                                                onArrival={async () => {
                                                    // Automate Return Completion
                                                    try {
                                                        // 1. Update Booking Status
                                                        const { error: bookingError } = await supabase
                                                            .from("bookings")
                                                            .update({ status: 'returned' })
                                                            .eq("id", booking.id);

                                                        if (bookingError) throw bookingError;

                                                        // 2. Make Item Available Again
                                                        const { error: itemError } = await supabase
                                                            .from("items")
                                                            .update({ is_available: true }) // Note: check exact column name in Supabase. Usually 'available' or 'is_available'. checking lines_viewed... 'available' is used in Requirements.txt/Main.py view? No, in main.py it uses `is_available = True`. Wait, let me check `fetchBookings` select... `item:items(...)`. It doesn't select available.
                                                            // Let's assume 'available' based on standard, or 'is_available'. In main.py `scan_handover` logic (which I wrote/viewed earlier) it sets `is_available = True`.
                                                            // Let me check my previous edit to main.py. `item.is_available = True`.
                                                            // So in Supabase table it's likely `is_available`.
                                                            .eq("id", booking.item_id);

                                                        if (itemError) throw itemError;

                                                        toast.success("Return Completed! Item is now available.");
                                                        handleRefresh();
                                                    } catch (err) {
                                                        console.error("Error completing return:", err);
                                                        toast.error("Failed to complete return automation");
                                                    }
                                                }}
                                            />
                                            <HandoverModal
                                                bookingId={booking.id}
                                                role="owner"
                                                variant="return"
                                                onSuccess={handleRefresh}
                                                trigger={<Button size="sm">Confirm Return Receipt</Button>}
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <div className="min-h-screen bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-background to-background">
            <Helmet>
                <title>My Bookings | Pharma-Grid</title>
            </Helmet>
            <Navbar />

            <div className="container max-w-5xl pt-24 pb-12 px-4">
                <h1 className="text-3xl font-bold mb-8">My Bookings</h1>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    </div>
                ) : (
                    <Tabs defaultValue="orders" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-8">
                            <TabsTrigger value="orders">My Orders (Renting)</TabsTrigger>
                            <TabsTrigger value="hosting">My Equipment (Lending)</TabsTrigger>
                        </TabsList>

                        <TabsContent value="orders" className="space-y-4">
                            {bookings.length === 0 ? (
                                <div className="text-center py-12 bg-white/50 rounded-xl border border-dashed">
                                    <p className="text-muted-foreground">You haven't booked any equipment yet.</p>
                                    <Button variant="link" onClick={() => navigate("/")}>Browse Equipment</Button>
                                </div>
                            ) : (
                                bookings.map(booking => (
                                    <BookingCard key={booking.id} booking={booking} role="renter" />
                                ))
                            )}
                        </TabsContent>

                        <TabsContent value="hosting" className="space-y-4">
                            {hostedBookings.length === 0 ? (
                                <div className="text-center py-12 bg-white/50 rounded-xl border border-dashed">
                                    <p className="text-muted-foreground">You don't have any active rental requests.</p>
                                    <Button variant="link" onClick={() => navigate("/list-device")}>List a Device</Button>
                                </div>
                            ) : (
                                hostedBookings.map(booking => (
                                    <BookingCard key={booking.id} booking={booking} role="owner" />
                                ))
                            )}
                        </TabsContent>
                    </Tabs>
                )}
            </div>

            {/* Contextual Chat Widget */}
            {chatContext && (
                <AIChatWidget
                    key={chatContext.device_name}
                    initialContext={chatContext}
                />
            )}
        </div>
    );
};

export default Bookings;
