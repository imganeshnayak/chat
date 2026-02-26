import { Link, useNavigate } from "react-router-dom";
import {
  MessageSquare, Shield, Share2, DollarSign,
  ArrowRight, Send, CheckCircle2, Zap,
  Star, Users, TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

const features = [
  {
    icon: MessageSquare,
    title: "Real-Time Chat",
    desc: "WhatsApp-style messaging with text, images, documents & voice notes.",
    color: "text-accent",
    bg: "bg-accent/10",
  },
  {
    icon: Shield,
    title: "Escrow Payments",
    desc: "Secure milestone-based payments. Release funds by percentage as work progresses.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: Share2,
    title: "Profile Sharing",
    desc: "Share your professional profile via link or QR code to attract more clients.",
    color: "text-coral",
    bg: "bg-coral/10",
  },
  {
    icon: DollarSign,
    title: "Transparent Deals",
    desc: "Full transparency with detailed payment records for every transaction.",
    color: "text-accent",
    bg: "bg-accent/10",
  },
];

const stats = [
  { value: "12K+", label: "Freelancers", icon: Users },
  { value: "$4.2M", label: "Secured via Escrow", icon: TrendingUp },
  { value: "4.9★", label: "Average Rating", icon: Star },
];

const testimonials = [
  {
    quote: "Krovaa completely changed how I handle client payments. No more chasing invoices.",
    name: "Sarah K.",
    role: "UI/UX Designer",
    initials: "SK",
  },
  {
    quote: "The escrow system gives both me and my clients peace of mind on every project.",
    name: "Marcus T.",
    role: "Full-Stack Developer",
    initials: "MT",
  },
  {
    quote: "I love how everything — conversation, contracts, payments — lives in one place.",
    name: "Priya N.",
    role: "Brand Strategist",
    initials: "PN",
  },
];

const Landing = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user) {
      user.role === "admin" ? navigate("/admin") : navigate("/chat");
    }
  }, [user, isLoading, navigate]);

  if (isLoading || user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">

      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[15%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[140px]" />
        <div className="absolute top-[30%] -right-[8%] w-[35%] h-[40%] rounded-full bg-accent/8 blur-[120px]" />
        <div className="absolute bottom-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-coral/5 blur-[100px]" />
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl border-b border-border/40 bg-background/75">
        <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <Link to="/" className="flex items-center gap-2.5 group cursor-pointer">
            <div className="bg-primary p-1.5 rounded-xl transition-all duration-300 group-hover:shadow-lg group-hover:shadow-primary/30 group-hover:scale-105">
              <Send className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              Krovaa
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors duration-200">Features</a>
            <a href="#testimonials" className="hover:text-foreground transition-colors duration-200">Testimonials</a>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden sm:block">
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground transition-colors">
                Sign In
              </Button>
            </Link>
            <Link to="/register">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/30 hover:scale-[1.02]">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-24 pb-20 md:pt-36 md:pb-28 px-6">
        <div className="max-w-5xl mx-auto text-center">

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary border border-border/60 text-xs font-semibold text-accent tracking-wide uppercase mb-10 shadow-sm">
            <Zap className="h-3.5 w-3.5 fill-current" />
            The Future of Freelancing
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-[5.5rem] font-extrabold leading-[1.05] tracking-tight mb-8">
            Chat. Pay.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-coral to-accent">
              Deliver.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
            The marketplace where{" "}
            <span className="text-foreground font-medium">conversations meet contracts</span>.
            Secure escrow payments and real-time chat — built for modern professionals.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Link to="/register">
              <Button
                size="lg"
                className="h-13 px-10 text-base bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.03] active:scale-100 transition-all shadow-xl shadow-primary/25"
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button
                size="lg"
                variant="ghost"
                className="h-13 px-8 text-base border border-border hover:border-primary/40 hover:bg-secondary transition-all"
              >
                Sign In
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            {[
              "No credit card required",
              "Free forever plan",
              "Cancel anytime",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border border border-border rounded-2xl bg-card shadow-sm overflow-hidden">
            {stats.map(({ value, label, icon: Icon }) => (
              <div key={label} className="flex flex-col items-center py-8 px-6 gap-2 group hover:bg-secondary/50 transition-colors duration-200">
                <Icon className="h-5 w-5 text-muted-foreground mb-1 group-hover:text-primary transition-colors" />
                <span className="text-3xl font-extrabold tracking-tight text-foreground">{value}</span>
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-6 relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">Platform Features</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to succeed</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              One platform, zero friction. From first message to final payment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <div
                key={i}
                className="group relative p-7 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg hover:shadow-primary/5"
              >
                {/* Subtle top accent line */}
                <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className={`mb-5 p-3 rounded-xl ${f.bg} w-fit group-hover:scale-110 transition-transform duration-300`}>
                  <f.icon className={`h-6 w-6 ${f.color}`} />
                </div>
                <h3 className="text-base font-bold mb-2 text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">How It Works</p>
            <h2 className="text-3xl md:text-4xl font-bold">Three steps to your next deal</h2>
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-10">
            {/* Connector line (desktop) */}
            <div className="hidden md:block absolute top-9 left-[calc(16.6%+1rem)] right-[calc(16.6%+1rem)] h-px bg-gradient-to-r from-border via-primary/40 to-border" />

            {[
              { step: "01", title: "Create & Share", desc: "Set up your profile and share it with potential clients via link or QR code." },
              { step: "02", title: "Chat & Agree", desc: "Discuss the project in real-time and lock in the terms directly in chat." },
              { step: "03", title: "Deliver & Get Paid", desc: "Complete milestones, release escrow funds, and build your reputation." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col items-center text-center relative">
                <div className="w-16 h-16 rounded-full bg-secondary border-2 border-border flex items-center justify-center mb-6 shadow-sm z-10 relative">
                  <span className="text-primary font-extrabold text-lg">{step}</span>
                </div>
                <h3 className="text-lg font-bold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="py-24 px-6 bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">Testimonials</p>
            <h2 className="text-3xl md:text-4xl font-bold">Loved by freelancers worldwide</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map(({ quote, name, role, initials }) => (
              <div
                key={name}
                className="p-7 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-md flex flex-col gap-5"
              >
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-accent fill-current" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">"{quote}"</p>
                <div className="flex items-center gap-3 pt-2 border-t border-border">
                  <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{name}</p>
                    <p className="text-xs text-muted-foreground">{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ── CTA ── */}
      <section className="px-6 py-28">
        <div className="max-w-4xl mx-auto rounded-3xl border border-border bg-card relative overflow-hidden text-center p-10 md:p-20 shadow-xl">
          {/* Background decoration */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-primary/8 blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-52 h-52 rounded-full bg-accent/8 blur-[70px] pointer-events-none" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary border border-border text-xs font-semibold text-accent tracking-wide uppercase mb-8">
              <Zap className="h-3 w-3 fill-current" />
              Free to start
            </div>

            <h2 className="text-3xl md:text-5xl font-extrabold mb-5 tracking-tight">
              Ready to secure your next deal?
            </h2>
            <p className="text-muted-foreground mb-10 text-base max-w-lg mx-auto leading-relaxed">
              Join thousands of freelancers using Krovaa to get paid faster, work safer, and build lasting client relationships.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register">
                <Button
                  size="lg"
                  className="h-13 px-10 text-base bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.03] transition-all shadow-xl shadow-primary/25"
                >
                  Create Your Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-13 px-8 text-base hover:bg-secondary transition-colors"
                >
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-sidebar-background px-6 pt-14 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            {/* Brand Logo with Link */}
            <Link to="/" className="col-span-1 md:col-span-2 flex flex-col gap-4">
              <div className="flex items-center gap-2.5">
                <div className="bg-primary p-1.5 rounded-xl">
                  <Send className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold">Krovaa</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                The world's first chat-first escrow platform — built for the modern gig economy.
              </p>
            </Link>

            {/* Links */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Product</p>
              <div className="flex flex-col gap-3 text-sm text-muted-foreground">
                <a href="#features" className="hover:text-foreground transition-colors w-fit">Features</a>
                <a href="#" className="hover:text-foreground transition-colors w-fit">Security</a>
                <a href="#" className="hover:text-foreground transition-colors w-fit">Changelog</a>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Company</p>
              <div className="flex flex-col gap-3 text-sm text-muted-foreground">
                <a href="#" className="hover:text-foreground transition-colors w-fit">About</a>
                <a href="#" className="hover:text-foreground transition-colors w-fit">Blog</a>
                <Link to="/privacy" className="hover:text-foreground transition-colors w-fit">Privacy</Link>
                <Link to="/terms" className="hover:text-foreground transition-colors w-fit">Terms</Link>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-8 border-t border-border">
            <p className="text-xs text-muted-foreground">
              © 2026 Krovaa, Inc. Engineered for Security.
            </p>
            <div className="flex gap-6 text-xs text-muted-foreground">
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
              <button onClick={() => {
                localStorage.removeItem("cookie_consent");
                window.location.reload();
              }} className="hover:text-foreground transition-colors">Cookie Settings</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;