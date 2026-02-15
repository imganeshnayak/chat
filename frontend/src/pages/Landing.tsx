import { Link } from "react-router-dom";
import { MessageSquare, Shield, Share2, DollarSign, ArrowRight, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: MessageSquare,
    title: "Real-Time Chat",
    desc: "WhatsApp-style messaging with text, images, documents & voice notes.",
  },
  {
    icon: Shield,
    title: "Escrow Payments",
    desc: "Secure milestone-based payments. Release funds by percentage as work progresses.",
  },
  {
    icon: Share2,
    title: "Profile Sharing",
    desc: "Share your professional profile via link or QR code to attract clients.",
  },
  {
    icon: DollarSign,
    title: "Transaction History",
    desc: "Full transparency with detailed payment records for every deal.",
  },
];

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <Send className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold text-foreground">ChatPay</span>
        </div>
        <div className="flex gap-3">
          <Link to="/login">
            <Button variant="ghost" size="sm">Login</Button>
          </Link>
          <Link to="/register">
            <Button size="sm">Get Started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-20 md:py-32 max-w-4xl mx-auto text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
          Chat. Pay. <span className="text-primary">Deliver.</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
          The freelancer marketplace where conversations meet contracts. Secure escrow payments, real-time chat, and seamless project delivery — all in one place.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/register">
            <Button size="lg" className="text-base px-8">
              Start Free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Link to="/login">
            <Button variant="outline" size="lg" className="text-base px-8">
              I have an account
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 text-foreground">
          Everything you need to work with confidence
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {features.map((f) => (
            <div key={f.title} className="bg-card border border-border rounded-xl p-6">
              <f.icon className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-lg font-semibold text-card-foreground mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8 mt-12">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">ChatPay</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 ChatPay. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
