import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, MapPin, IndianRupee, Store, MoreVertical, Trash2 } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { DeviceDetailsModal } from "@/components/DeviceDetailsModal";

interface Item {
    id: string;
    title: string;
    image_url: string;
    price_per_day: number;
    address_text: string;
    category: string;
    ai_status: string;
}

const MyEquipments = () => {
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewingItemId, setViewingItemId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const navigate = useNavigate();

    const fetchItems = async () => {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            navigate("/login");
            return;
        }

        const { data } = await supabase
            .from("items")
            .select("*")
            .eq("owner_id", session.user.id)
            .order("created_at", { ascending: false });

        setItems(data as Item[] || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchItems();
    }, [navigate]);

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this listing? This action cannot be undone.")) return;

        try {
            const { error } = await supabase
                .from("items")
                .delete()
                .eq("id", id);

            if (error) throw error;

            toast.success("Item deleted successfully");
            fetchItems();
        } catch (error) {
            console.error("Error deleting item:", error);
            toast.error("Failed to delete item");
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'verified': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <div className="min-h-screen bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-background to-background">
            <Helmet>
                <title>My Equipments | Pharma-Grid</title>
            </Helmet>
            <Navbar />

            <div className="container max-w-6xl pt-8 pb-12 px-4">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">My Equipments</h1>
                        <p className="text-muted-foreground mt-1">Manage all your listed devices and medical aids.</p>
                    </div>
                    <Button onClick={() => navigate("/list-device")}>
                        + Add New Device
                    </Button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-16 bg-white/50 rounded-2xl border border-dashed">
                        <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Store className="w-8 h-8 text-primary" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">No Equipments Listed</h3>
                        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                            You haven't listed any medical equipment yet. Help your community by adding devices you don't use.
                        </p>
                        <Button onClick={() => navigate("/list-device")}>
                            List Your Device Now
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {items.map((item) => (
                            <Card key={item.id} className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-border/50 bg-white/60 backdrop-blur-sm">
                                {/* Image Container */}
                                <div className="h-48 relative overflow-hidden">
                                    <img
                                        src={item.image_url || "https://images.unsplash.com/photo-1584515933487-779824d29309?w=800&auto=format&fit=crop"}
                                        alt={item.title}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                    <div className="absolute top-3 right-3">
                                        <Badge variant="secondary" className={`backdrop-blur-md shadow-sm capitalize ${getStatusColor(item.ai_status)}`}>
                                            {item.ai_status}
                                        </Badge>
                                    </div>
                                    <div className="absolute top-3 left-3">
                                        <Badge variant="outline" className="bg-white/90 backdrop-blur-md shadow-sm">
                                            {item.category}
                                        </Badge>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-semibold text-lg line-clamp-1">{item.title}</h3>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-muted-foreground">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => {
                                                    setViewingItemId(item.id);
                                                    setIsModalOpen(true);
                                                }}>
                                                    View Listing
                                                </DropdownMenuItem>
                                                <DropdownMenuItem disabled>
                                                    Edit Details
                                                </DropdownMenuItem>
                                                <DropdownMenuItem disabled>
                                                    Edit Details
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                                    onClick={() => handleDelete(item.id)}
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Delete Item
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    <div className="flex items-center gap-1.5 text-muted-foreground text-sm mb-4">
                                        <MapPin className="w-3.5 h-3.5" />
                                        <span className="truncate">{item.address_text || "Location hidden"}</span>
                                    </div>

                                    <div className="flex items-center justify-between pt-4 border-t border-border/50">
                                        <div className="flex items-center gap-1 text-lg font-bold text-primary">
                                            <IndianRupee className="w-4 h-4" />
                                            {item.price_per_day} <span className="text-sm font-normal text-muted-foreground">/ day</span>
                                        </div>
                                        <Button variant="secondary" size="sm" onClick={() => {
                                            setViewingItemId(item.id);
                                            setIsModalOpen(true);
                                        }}>
                                            View
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <DeviceDetailsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                itemId={viewingItemId}
                showBookingButton={false}
            />
        </div>
    );
};

export default MyEquipments;
