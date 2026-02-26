import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Send, Mail, CheckCircle2, Loader2, Eye, EyeOff } from "lucide-react";
import TelegramLogin from "@/components/TelegramLogin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { validatePassword } from "@/lib/passwordValidation";
import PasswordStrength from "@/components/auth/PasswordStrength";

type Step = "form" | "otp";

const Register = () => {
  const navigate = useNavigate();
  const { register, isLoading } = useAuth();
  const [step, setStep] = useState<Step>("form");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [agreeToPrivacy, setAgreeToPrivacy] = useState(false);
  const { user } = useAuth();

  // Step 1: Send OTP to email
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate password strength
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.isValid) {
      setError(passwordCheck.message || "Please use a stronger password");
      return;
    }

    setIsSendingOtp(true);
    try {
      await apiFetch("/api/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ email, username }),
      });
      setOtpSent(true);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Step 2: Verify OTP and register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await register(username.trim(), email.trim().toLowerCase(), password, displayName.trim(), otp);
      navigate("/chat", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  };

  const handleResendOtp = async () => {
    setError("");
    setIsSendingOtp(true);
    try {
      await apiFetch("/api/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend OTP");
    } finally {
      setIsSendingOtp(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <Send className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold text-foreground">Krovaa</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          {step === "form" ? (
            <>
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

              {error && <div className="mb-4 p-3 bg-destructive/20 text-destructive-foreground border border-destructive/30 rounded-lg text-sm">{error}</div>}

              <form onSubmit={handleSendOtp} className="space-y-3">
                <div>
                  <Label className="text-card-foreground">Username</Label>
                  <Input className="mt-1.5 bg-secondary border-border" placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
                </div>
                <div>
                  <Label className="text-card-foreground">Display Name</Label>
                  <Input className="mt-1.5 bg-secondary border-border" placeholder="Your Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
                <div>
                  <Label className="text-card-foreground">Email</Label>
                  <Input className="mt-1.5 bg-secondary border-border" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                  <Label className="text-card-foreground">Password</Label>
                  <div className="relative">
                    <Input
                      className="mt-1.5 bg-secondary border-border pr-10"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <PasswordStrength password={password} />
                </div>
                <Button type="submit" className="w-full" disabled={isSendingOtp || !agreeToTerms || !agreeToPrivacy}>
                  {isSendingOtp ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending OTP...</> : "Continue →"}
                </Button>

                <div className="space-y-3 mt-4">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="terms"
                      checked={agreeToTerms}
                      onChange={(e) => setAgreeToTerms(e.target.checked)}
                      className="mt-1 cursor-pointer"
                    />
                    <label htmlFor="terms" className="text-xs text-muted-foreground cursor-pointer">
                      I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Terms and Conditions</a>
                    </label>
                  </div>
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="privacy"
                      checked={agreeToPrivacy}
                      onChange={(e) => setAgreeToPrivacy(e.target.checked)}
                      className="mt-1 cursor-pointer"
                    />
                    <label htmlFor="privacy" className="text-xs text-muted-foreground cursor-pointer">
                      I agree to the <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Privacy Policy</a>
                    </label>
                  </div>
                </div>
              </form>
            </>
          ) : (
            <>
              {/* OTP Step */}
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Mail className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-card-foreground mb-1">Check your email</h2>
                <p className="text-sm text-muted-foreground">
                  We sent a 6-digit code to<br />
                  <strong className="text-foreground">{email}</strong>
                </p>
              </div>

              {error && <div className="mb-4 p-3 bg-destructive/20 text-destructive-foreground border border-destructive/30 rounded-lg text-sm">{error}</div>}

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label className="text-card-foreground">Enter OTP Code</Label>
                  <Input
                    className="mt-1.5 bg-secondary border-border text-center text-2xl font-mono tracking-widest"
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={otp.length !== 6 || isLoading}>
                  {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account...</> : <><CheckCircle2 className="w-4 h-4 mr-2" />Verify & Create Account</>}
                </Button>
              </form>

              <div className="mt-4 text-center space-y-2">
                <button
                  onClick={handleResendOtp}
                  disabled={isSendingOtp}
                  className="text-sm text-primary hover:underline disabled:opacity-50"
                >
                  {isSendingOtp ? "Resending..." : "Resend OTP"}
                </button>
                <br />
                <button onClick={() => { setStep("form"); setOtp(""); setError(""); }} className="text-xs text-muted-foreground hover:underline">
                  ← Change email
                </button>
              </div>
            </>
          )}

          <p className="text-xs text-muted-foreground mt-4 text-center">
            By signing up, you agree to Krovaa's Terms of Service and Privacy Policy
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
