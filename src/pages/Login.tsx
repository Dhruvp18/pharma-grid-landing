import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";

const Login = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // Check if user is already logged in
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                navigate("/");
            }
        };
        checkUser();
    }, [navigate]);

    const handleGoogleLogin = async () => {
        try {
            setIsLoading(true);
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: `${window.location.origin}/`,
                },
            });

            if (error) {
                throw error;
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to login with Google");
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <div className="container flex items-center justify-center min-h-[calc(100vh-80px)] pt-8">
                <div className="w-full max-w-md p-8 space-y-6 glass-card rounded-2xl animate-fade-in-up">
                    <div className="text-center space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight">Welcome Back</h1>
                        <p className="text-muted-foreground">Sign in to list devices and view equipment.</p>
                    </div>

                    <div className="space-y-4">
                        <Button
                            variant="outline"
                            className="w-full h-12 text-base font-medium relative"
                            onClick={handleGoogleLogin}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                <img
                                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                                    alt="Google"
                                    className="mr-3 h-5 w-5"
                                />
                            )}
                            Continue with Google
                        </Button>
                    </div>

                    <p className="text-center text-sm text-muted-foreground">
                        By continuing, you agree to our Terms of Service and Privacy Policy.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
