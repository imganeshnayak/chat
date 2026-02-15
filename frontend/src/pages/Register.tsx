import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Send } from "lucide-react";
import TelegramLogin from "@/components/TelegramLogin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

const Register = () => {
  const navigate = useNavigate();
  const { register, isLoading } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await register(username, email, password, displayName);
      navigate("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <Send className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold text-foreground">ChatPay</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-card-foreground mb-1">Create Account</h2>
            <p className="text-sm text-muted-foreground font-medium text-primary">Primary Signup Method:</p>
            <TelegramLogin />
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground tracking-widest">Or register with email</span>
            </div>
          </div>

          {error && <div className="mb-4 p-3 bg-destructive text-destructive-foreground rounded-lg text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label className="text-card-foreground">Username</Label>
              <Input
                className="mt-1.5 bg-secondary border-border"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="text-card-foreground">Display Name</Label>
              <Input
                className="mt-1.5 bg-secondary border-border"
                placeholder="Your Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-card-foreground">Email</Label>
              <Input
                className="mt-1.5 bg-secondary border-border"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="text-card-foreground">Password</Label>
              <Input
                className="mt-1.5 bg-secondary border-border"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Sign Up"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground mt-4 text-center">
            By signing up, you agree to ChatPay's Terms of Service and Privacy Policy
          </p>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
