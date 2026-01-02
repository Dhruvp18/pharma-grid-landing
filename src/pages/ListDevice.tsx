import { useState, useRef, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
    ShieldCheck,
    Upload,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Loader2,
    ChevronRight,
    ChevronLeft,
    MapPin,
    Locate,
} from "lucide-react";

import * as tt from '@tomtom-international/web-sdk-maps';
import * as ttServices from '@tomtom-international/web-sdk-services';
import '@tomtom-international/web-sdk-maps/dist/maps.css';

import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const ListDevice = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [dragActive, setDragActive] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        title: "",
        category: "",
        description: "",
        price: "",
        location: "",
    });

    // Audit State
    const [auditResult, setAuditResult] = useState<any>(null);

    const handleInputChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    // --- Step 2: File Upload & Audit ---
    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFiles(e.dataTransfer.files);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            handleFiles(e.target.files);
        }
    };

    const handleFiles = (newFiles: FileList) => {
        setFiles((prev) => [...prev, ...Array.from(newFiles)]);
        // If we received "needs_more_info" before, we might want to clear it or keep it until re-scan
    };

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const runAudit = async () => {
        if (files.length === 0) {
            toast.error("Please upload at least one image.");
            return;
        }

        setIsLoading(true);
        const data = new FormData();
        files.forEach((file) => {
            data.append("images", file);
        });

        try {
            const response = await fetch("http://localhost:3000/audit-item", {
                method: "POST",
                body: data,
            });
            const result = await response.json();

            if (response.ok) {
                setAuditResult(result);
                if (result.status === "verified") {
                    toast.success("Device Verified Successfully!");
                } else if (result.status === "rejected") {
                    toast.error("Device Rejected by Vision Guard.");
                } else if (result.status === "needs_more_info") {
                    toast.warning("Additional evidence required.");
                }
            } else {
                toast.error(result.error || "Audit failed");
            }
        } catch (error) {
            console.error("Audit error:", error);
            toast.error("Failed to connect to Vision Guard.");
        } finally {
            setIsLoading(false);
        }
    };

    // --- Step 3: Publish ---
    const handlePublish = async () => {
        if (!formData.price || !formData.location) {
            toast.error("Please fill in all pricing and location details.");
            return;
        }

        setIsLoading(true);
        const data = new FormData();
        data.append("title", formData.title);
        data.append("category", formData.category);
        data.append("description", formData.description);
        data.append("price", formData.price);
        data.append("location", formData.location);
        if (locationCoords) {
            data.append("lat", locationCoords.lat.toString());
            data.append("lng", locationCoords.lng.toString());
        }
        data.append("verified", "true"); // Assuming we only allow publish if verified
        data.append("safety_score", auditResult?.safety_score?.toString() || "0");
        if (auditResult?.reason) data.append("reason", auditResult.reason);

        // Add Owner ID from Session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
            data.append("owner_id", session.user.id);
            if (session.user.email) data.append("user_email", session.user.email);
            if (session.user.user_metadata?.full_name) data.append("user_name", session.user.user_metadata.full_name);

            // --- CRITICAL FIX: Ensure Profile Exists ---
            // We upsert the profile from the frontend because we have the User's Auth Session.
            // The backend (using Anon Key) cannot write to 'profiles' due to RLS.
            try {
                const { error: profileError } = await supabase.from("profiles").upsert({
                    id: session.user.id,
                    // email: session.user.email, // REMOVED: Schema does not have email column
                });
                if (profileError) {
                    console.error("Profile Sync Error:", profileError);
                    // We don't block here, we hope for the best, or maybe the table doesn't exist?
                    // But usually this fixes the FK issue.
                }
            } catch (err) {
                console.error("Profile Sync Exception:", err);
            }

        } else {
            toast.error("You must be logged in to publish.");
            setIsLoading(false);
            return;
        }

        // Re-send images to be saved/handled by backend creation endpoint
        files.forEach((file) => {
            data.append("images", file);
        });

        try {
            const response = await fetch("http://localhost:3000/create-listing", {
                method: "POST",
                body: data,
            });
            const result = await response.json();

            if (response.ok) {
                toast.success("Listing Published Successfully!");
                navigate("/");
            } else {
                toast.error(result.error || "Failed to publish listing");
            }
        } catch (error) {
            console.error("Publish error:", error);
            toast.error("Failed to publish listing.");
        } finally {
            setIsLoading(false);
        }
    };

    // --- Render Steps ---
    const renderStep1 = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="title">Device Name</Label>
                    <Input
                        id="title"
                        placeholder="e.g. Philips EverFlo Oxygen Concentrator"
                        value={formData.title}
                        onChange={(e) => handleInputChange("title", e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                        value={formData.category}
                        onValueChange={(val) => handleInputChange("category", val)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Respiratory">Respiratory</SelectItem>
                            <SelectItem value="Mobility">Mobility (Wheelchairs/Walkers)</SelectItem>
                            <SelectItem value="Beds">Hospital Beds</SelectItem>
                            <SelectItem value="Monitors">Monitors & Electronics</SelectItem>
                            <SelectItem value="Consumables">Consumables (Unopened)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="description">Description (Age, Condition, etc.)</Label>
                    <Textarea
                        id="description"
                        placeholder="Bought in 2024, barely used. Comes with original box..."
                        className="h-32"
                        value={formData.description}
                        onChange={(e) => handleInputChange("description", e.target.value)}
                    />
                </div>
            </div>

            <div className="flex justify-end">
                <Button
                    onClick={() => {
                        if (formData.title && formData.category && formData.description) {
                            setStep(2);
                        } else {
                            toast.error("Please fill in all details");
                        }
                    }}
                    className="w-full sm:w-auto"
                >
                    Next: AI Verification <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-6 animate-fade-in">
            {/* Upload Zone */}
            <div
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${dragActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <Input
                    type="file"
                    multiple
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={handleChange}
                    accept="image/*"
                />
                <div className="flex flex-col items-center gap-2 pointer-events-none">
                    <div className="p-4 rounded-full bg-secondary text-primary">
                        <Upload className="w-8 h-8" />
                    </div>
                    <h3 className="font-semibold text-lg">Drop photos here</h3>
                    <p className="text-sm text-muted-foreground">
                        Take clear photos of the device, labels, and any defects.
                    </p>
                </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {files.map((file, idx) => (
                        <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                            <img
                                src={URL.createObjectURL(file)}
                                alt="preview"
                                className="w-full h-full object-cover"
                            />
                            <button
                                onClick={() => removeFile(idx)}
                                className="absolute top-1 right-1 p-1 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <XCircle className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Audit Result Display */}
            {auditResult && (
                <div className={`p-4 rounded-xl border ${auditResult.status === 'verified' ? 'bg-emerald-50 border-emerald-200' :
                    auditResult.status === 'rejected' ? 'bg-red-50 border-red-200' :
                        'bg-amber-50 border-amber-200'
                    }`}>
                    <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-full ${auditResult.status === 'verified' ? 'bg-emerald-100 text-emerald-600' :
                            auditResult.status === 'rejected' ? 'bg-red-100 text-red-600' :
                                'bg-amber-100 text-amber-600'
                            }`}>
                            {auditResult.status === 'verified' && <ShieldCheck className="w-6 h-6" />}
                            {auditResult.status === 'rejected' && <XCircle className="w-6 h-6" />}
                            {auditResult.status === 'needs_more_info' && <AlertTriangle className="w-6 h-6" />}
                        </div>
                        <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-lg capitalize">{auditResult.status.replace(/_/g, " ")}</h4>
                                {auditResult.safety_score !== undefined && (
                                    <Badge variant={auditResult.safety_score > 7 ? "default" : "secondary"}>
                                        Safety Score: {auditResult.safety_score}/10
                                    </Badge>
                                )}
                            </div>

                            <p className="text-sm text-foreground/80">{auditResult.reason}</p>

                            {auditResult.missing_evidence && (
                                <div className="p-3 bg-white/50 rounded-lg text-sm font-medium text-amber-800">
                                    🔍 Needed: {auditResult.missing_evidence}
                                </div>
                            )}

                            {auditResult.flaws_found && auditResult.flaws_found.length > 0 && (
                                <div className="text-sm">
                                    <span className="font-semibold text-red-600">Flaws detected:</span>  {auditResult.flaws_found.join(", ")}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep(1)}>
                    <ChevronLeft className="w-4 h-4 mr-2" /> Back
                </Button>

                {(!auditResult || auditResult.status === "needs_more_info") && (
                    <Button onClick={runAudit} disabled={isLoading || files.length === 0}>
                        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                        {auditResult?.status === "needs_more_info" ? "Scan Additional Photos" : "Run Vision Guard Scan"}
                    </Button>
                )}

                {auditResult?.status === "verified" && (
                    <Button onClick={() => setStep(3)} className="bg-emerald hover:bg-emerald/90">
                        Next: Set Pricing <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                )}
            </div>
        </div>
    );

    // Map State
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<tt.Map | null>(null);
    const marker = useRef<tt.Marker | null>(null);
    const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
    const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY;

    const [isGeocoding, setIsGeocoding] = useState(false);

    const handleLocationSearch = async () => {
        if (!formData.location || !map.current || !marker.current || !TOMTOM_API_KEY) return;

        setIsGeocoding(true);
        try {
            const response = await ttServices.services.fuzzySearch({
                key: TOMTOM_API_KEY,
                query: formData.location,
            });

            if (response.results && response.results.length > 0) {
                const result = response.results[0];
                const newPos = { lat: result.position.lat, lng: result.position.lng };

                setLocationCoords(newPos);
                map.current.flyTo({ center: newPos, zoom: 14 } as any);
                marker.current.setLngLat(newPos);
                toast.success(`Location updated to: ${result.address.freeformAddress}`);
            } else {
                toast.error("Location not found. Please try a more specific address.");
            }
        } catch (error) {
            console.error("Geocoding error:", error);
            toast.error("Failed to find location.");
        } finally {
            setIsGeocoding(false);
        }
    };

    // Initialize Map on Step 3
    useEffect(() => {
        if (step === 3 && mapContainer.current && !map.current && TOMTOM_API_KEY) {
            const mumbai = { lat: 19.0760, lng: 72.8777 };

            map.current = tt.map({
                key: TOMTOM_API_KEY,
                container: mapContainer.current,
                style: 'https://api.tomtom.com/map/1/style/22.2.1-9/basic_main.json',
                center: [mumbai.lng, mumbai.lat],
                zoom: 12,
                dragPan: true,
                dragRotate: true,
            });

            map.current.addControl(new tt.NavigationControl(), 'top-right');

            // Initial Marker
            const markerElement = document.createElement('div');
            markerElement.className = 'marker-icon';
            markerElement.style.backgroundImage = 'url(https://api.tomtom.com/maps-sdk-for-web/cdn/static/s/images/marker-icon.png)';
            markerElement.style.width = '30px';
            markerElement.style.height = '30px';
            markerElement.style.backgroundSize = 'cover';
            markerElement.style.cursor = 'grab';

            marker.current = new tt.Marker({
                draggable: true,
                element: markerElement
            })
                .setLngLat([mumbai.lng, mumbai.lat])
                .addTo(map.current);

            // Set initial coords
            setLocationCoords(mumbai);

            // Listen for drag
            marker.current.on('dragend', () => {
                const lngLat = marker.current?.getLngLat();
                if (lngLat) {
                    setLocationCoords({ lat: lngLat.lat, lng: lngLat.lng });
                    // Reverse geocoding could go here to update the text input
                }
            });
        }
    }, [step, TOMTOM_API_KEY]);


    const renderStep3 = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="price">Daily Rental Price (₹)</Label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                        <Input
                            id="price"
                            type="number"
                            className="pl-8"
                            placeholder="e.g. 500"
                            value={formData.price}
                            onChange={(e) => handleInputChange("price", e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="location">Address Text</Label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            id="location"
                            className="pl-9 pr-8"
                            placeholder="e.g. Andheri West, Mumbai"
                            value={formData.location}
                            onChange={(e) => handleInputChange("location", e.target.value)}
                            onBlur={handleLocationSearch}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleLocationSearch();
                                }
                            }}
                            disabled={isGeocoding}
                        />
                        {isGeocoding && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Map Picker */}
            <div className="space-y-2">
                <Label>Pin Precise Location</Label>
                <div className="h-64 w-full rounded-xl overflow-hidden border border-border relative">
                    <div ref={mapContainer} className="absolute inset-0" />
                    {!locationCoords && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                            Loading Map...
                        </div>
                    )}
                </div>
                <p className="text-xs text-muted-foreground">Drag the marker to the exact pickup spot.</p>
            </div>

            <div className="bg-secondary/50 p-4 rounded-lg space-y-3">
                <h4 className="font-semibold">Summary</h4>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Item Verified</span>
                    <span className="text-emerald font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Yes</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Vision Guard Score</span>
                    <span className="font-medium">{auditResult?.safety_score}/10</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Listing Fee</span>
                    <span className="font-medium text-emerald">Free</span>
                </div>
            </div>

            <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep(2)}>
                    <ChevronLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button onClick={handlePublish} disabled={isLoading} className="w-full sm:w-auto">
                    {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Publish Listing"}
                </Button>
            </div>
        </div>
    );

    return (
        <>
            <Helmet>
                <title>List Your Device | Pharma-Grid</title>
            </Helmet>

            <div className="min-h-screen bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background pt-24 pb-12 px-4">
                <Navbar />

                <div className="max-w-3xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-10 space-y-2">
                        <h1 className="text-4xl font-bold tracking-tight text-gradient">List Your Equipment</h1>
                        <p className="text-muted-foreground text-lg">Help your neighbors by renting out your idle medical devices.</p>
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center justify-center mb-8 gap-4">
                        {[1, 2, 3].map((s) => (
                            <div key={s} className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                    }`}>
                                    {s}
                                </div>
                                {s < 3 && <div className={`w-12 h-0.5 rounded-full ${step > s ? "bg-primary" : "bg-muted"}`} />}
                            </div>
                        ))}
                    </div>

                    {/* Main Card */}
                    <div className="glass-card rounded-2xl p-6 md:p-10 animate-fade-in-up">
                        {step === 1 && renderStep1()}
                        {step === 2 && renderStep2()}
                        {step === 3 && renderStep3()}
                    </div>
                </div>
            </div>
        </>
    );
};

export default ListDevice;
