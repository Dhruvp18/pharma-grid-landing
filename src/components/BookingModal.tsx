import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, differenceInDays } from "date-fns";
import { Calendar as CalendarIcon, Loader2, Truck, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface BookingModalProps {
    item: any;
    trigger?: React.ReactNode;
    onSuccess?: () => void;
}

export function BookingModal({ item, trigger, onSuccess }: BookingModalProps) {
    const [date, setDate] = useState<{ from: Date; to: Date } | undefined>();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
    const [address, setAddress] = useState("");
    const navigate = useNavigate();

    const calculateTotal = () => {
        if (!date?.from || !date?.to) return 0;
        const days = differenceInDays(date.to, date.from) + 1; // Include start day
        let total = days * item.price_per_day;
        if (deliveryMethod === 'delivery') total += 150; // Flat delivery fee
        return total;
    };

    const handleBooking = async () => {
        if (!date?.from || !date?.to) {
            toast.error("Please select a date range");
            return;
        }

        if (deliveryMethod === 'delivery' && !address) {
            toast.error("Please enter a delivery address");
            return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            toast.error("Please login to book items");
            navigate("/login");
            return;
        }

        if (session.user.id === item.owner_id) {
            toast.error("You cannot book your own item");
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await supabase.from("bookings").insert({
                item_id: item.id,
                renter_id: session.user.id,
                owner_id: item.owner_id,
                start_date: date.from.toISOString(),
                end_date: date.to.toISOString(),
                total_price: calculateTotal(),
                status: 'requested',
                delivery_method: deliveryMethod, // Assuming column exists
                delivery_address: address || null
            });

            if (error) {
                // Determine if error is due to missing column
                console.error("Booking Error Detail:", error);
                if (error.message?.includes("column") || error.code === "42703") {
                    // Fallback: Store in a 'metadata' column if it exists, or just omit extra fields
                    // For now, let's assume we can try without them if it fails, but user wants features.
                    // I'll throw custom error to UI.
                    throw new Error("Database schema missing 'delivery_method'. Please ask admin to run migration.");
                }
                throw error;
            }


            // Update item availability
            const { error: updateError } = await supabase
                .from('items')
                .update({ is_available: false })
                .eq('id', item.id);

            if (updateError) {
                console.error("Failed to update item availability:", updateError);
                toast.error("Booking confirmed, but failed to update item status.");
            }

            toast.success(deliveryMethod === 'delivery' ? "Delivery Requested!" : "Pickup Requested!");
            setIsOpen(false);
            onSuccess?.();
            navigate("/bookings");
        } catch (error: any) {
            console.error("Booking error:", error);
            toast.error(error.message || "Failed to create booking");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || <Button size="lg" className="w-full">Request Booking</Button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Book {item.title}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* Date Selection */}
                    <div className="space-y-2">
                        <Label>Select Dates</Label>
                        <div className={cn("grid gap-2")}>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="date"
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !date && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date?.from ? (
                                            date.to ? (
                                                <>
                                                    {format(date.from, "LLL dd, y")} -{" "}
                                                    {format(date.to, "LLL dd, y")}
                                                </>
                                            ) : (
                                                format(date.from, "LLL dd, y")
                                            )
                                        ) : (
                                            <span>Pick a date range</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={date?.from}
                                        selected={date}
                                        onSelect={(range: any) => setDate(range)}
                                        numberOfMonths={2}
                                        disabled={(date) => date < new Date()}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* Delivery Method Selection */}
                    <div className="space-y-3 pt-2">
                        <Label>Delivery Method</Label>
                        <RadioGroup
                            defaultValue="pickup"
                            className="grid grid-cols-2 gap-4"
                            onValueChange={(val: 'pickup' | 'delivery') => setDeliveryMethod(val)}
                        >
                            <div>
                                <RadioGroupItem value="pickup" id="pickup" className="peer sr-only" />
                                <Label
                                    htmlFor="pickup"
                                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary cursor-pointer"
                                >
                                    <Store className="mb-2 h-6 w-6" />
                                    Pickup (Free)
                                </Label>
                            </div>
                            <div>
                                <RadioGroupItem value="delivery" id="delivery" className="peer sr-only" />
                                <Label
                                    htmlFor="delivery"
                                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary cursor-pointer"
                                >
                                    <Truck className="mb-2 h-6 w-6" />
                                    Delivery (+₹150)
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Address Input (Only if Delivery) */}
                    {deliveryMethod === 'delivery' && (
                        <div className="space-y-2 animate-fade-in">
                            <Label htmlFor="address">Delivery Address</Label>
                            <Input
                                id="address"
                                placeholder="Enter full address"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                            />
                        </div>
                    )}

                    {/* Cost Summary */}
                    {date?.from && date?.to && (
                        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Rate</span>
                                <span>₹{item.price_per_day} x {differenceInDays(date.to, date.from) + 1} days</span>
                            </div>
                            {deliveryMethod === 'delivery' && (
                                <div className="flex justify-between text-sm">
                                    <span>Delivery Fee</span>
                                    <span>₹150</span>
                                </div>
                            )}
                            <div className="flex justify-between font-bold text-lg pt-2 border-t">
                                <span>Total</span>
                                <span className="text-primary">₹{calculateTotal()}</span>
                            </div>
                        </div>
                    )}

                    <Button onClick={handleBooking} disabled={isLoading || !date?.from || !date?.to} className="w-full">
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm Booking
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
