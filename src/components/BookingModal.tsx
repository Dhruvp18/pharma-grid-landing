import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, differenceInDays } from "date-fns";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface BookingModalProps {
    item: any;
    trigger?: React.ReactNode;
    onSuccess?: () => void;
}

export function BookingModal({ item, trigger, onSuccess }: BookingModalProps) {
    const [date, setDate] = useState<{ from: Date; to: Date } | undefined>();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const calculateTotal = () => {
        if (!date?.from || !date?.to) return 0;
        const days = differenceInDays(date.to, date.from) + 1; // Include start day
        return days * item.price_per_day;
    };

    const handleBooking = async () => {
        if (!date?.from || !date?.to) {
            toast.error("Please select a date range");
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
                status: 'requested'
            });

            if (error) throw error;

            toast.success("Booking requested successfully!");
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
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">Select Dates</h4>
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

                    {date?.from && date?.to && (
                        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Rate</span>
                                <span>₹{item.price_per_day} / day</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>Duration</span>
                                <span>{differenceInDays(date.to, date.from) + 1} days</span>
                            </div>
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
