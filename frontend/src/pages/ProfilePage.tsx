import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Share2, Copy, Mail, Phone, MessageSquare, Twitter, Instagram, Linkedin, Github, Globe, Plus, Trash2, ExternalLink, Star, CheckCircle2, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getUser, updateUserProfile, uploadAvatar, rateUser, AuthUser, applyForVerification, getVerificationStatus, getVerificationFee, VerificationRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Camera, Save, X, Edit2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import LoadingScreen from "@/components/ui/LoadingScreen";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PLATFORMS = [
  { id: "twitter", name: "Twitter", icon: <Twitter className="h-4 w-4" /> },
  { id: "instagram", name: "Instagram", icon: <Instagram className="h-4 w-4" /> },
  { id: "linkedin", name: "LinkedIn", icon: <Linkedin className="h-4 w-4" /> },
  { id: "github", name: "GitHub", icon: <Github className="h-4 w-4" /> },
  { id: "website", name: "Website", icon: <Globe className="h-4 w-4" /> },
  { id: "other", name: "Other", icon: <Globe className="h-4 w-4" /> },
];

const SocialIcon = ({ platform }: { platform: string }) => {
  const p = platform.toLowerCase();
  if (p.includes('twitter')) return <Twitter className="h-4 w-4" />;
  if (p.includes('instagram')) return <Instagram className="h-4 w-4" />;
  if (p.includes('linkedin')) return <Linkedin className="h-4 w-4" />;
  if (p.includes('github')) return <Github className="h-4 w-4" />;
  return <Globe className="h-4 w-4" />;
};

const ProfilePage = () => {
  const { userId } = useParams();
  const { user: currentUser, isLoading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: "",
    bio: "",
    email: "",
    role: "",
    socialLinks: [] as { platform: string; url: string }[]
  });
  const [isRatingDialogOpen, setIsRatingDialogOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false);
  const [verificationRequest, setVerificationRequest] = useState<VerificationRequest | null>(null);
  const [verificationFee, setVerificationFee] = useState(0);
  const [isApplying, setIsApplying] = useState(false);

  const loadUser = async () => {
    setIsLoading(true);
    try {
      if (userId) {
        const userData = await getUser(parseInt(userId));
        setUser(userData);
      } else {
        const userData = await getUser(currentUser.id); // Refresh current user data
        setUser(userData);
        setEditForm({
          displayName: userData.displayName || "",
          bio: userData.bio || "",
          email: userData.email || "",
          role: userData.role || "",
          socialLinks: userData.socialLinks || []
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user");
    } finally {
      setIsLoading(false);
    }
  };

  const loadVerificationData = async () => {
    try {
      const [status, feeData] = await Promise.all([
        getVerificationStatus(),
        getVerificationFee()
      ]);
      setVerificationRequest(status);
      setVerificationFee(feeData.fee);
    } catch (err) {
      console.error('Load verification data error:', err);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      loadUser();
      if (!userId) {
        // Only load verification data for own profile
        loadVerificationData();
      }
    }
  }, [userId, currentUser, authLoading]);

  if (authLoading || (isLoading && !user)) return <LoadingScreen />;

  if (!user || error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{error || "User not found"}</p>
      </div>
    );
  }

  const isOwnProfile = user.id === currentUser?.id;
  const profileLink = `${window.location.origin}/profile/${user.id}`;


  const copyLink = () => {
    navigator.clipboard.writeText(profileLink);
    toast({ title: "Link copied!", description: "Profile link copied to clipboard" });
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const updated = await updateUserProfile(user.id, editForm);
      setUser(updated);
      setIsEditing(false);
      toast({ title: "Profile updated!", description: "Your changes have been saved." });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to update profile", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRateUser = async () => {
    if (!user) return;
    try {
      await rateUser({ reviewedId: user.id, rating: rating });
      toast({ title: "Rating Submitted", description: `You rated ${user.displayName} ${rating} stars.` });
      setIsRatingDialogOpen(false);
      loadUser(); // Refresh to show new rating
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to submit rating", variant: "destructive" });
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Profile pictures must be under 5MB.", variant: "destructive" });
      return;
    }

    try {
      const { avatarUrl } = await uploadAvatar(file);
      setUser({ ...user, avatarUrl });
      toast({ title: "Avatar updated!", description: "Your profile picture has been changed." });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Failed to upload avatar", variant: "destructive" });
    }
  };

  const addSocialLink = () => {
    setEditForm({
      ...editForm,
      socialLinks: [...editForm.socialLinks, { platform: "twitter", url: "" }]
    });
  };

  const removeSocialLink = (index: number) => {
    const newLinks = [...editForm.socialLinks];
    newLinks.splice(index, 1);
    setEditForm({ ...editForm, socialLinks: newLinks });
  };

  const updateSocialLink = (index: number, field: "platform" | "url", value: string) => {
    const newLinks = [...editForm.socialLinks];
    newLinks[index] = { ...newLinks[index], [field]: value };
    setEditForm({ ...editForm, socialLinks: newLinks });
  };

  const handleApplyForVerification = async () => {
    setIsApplying(true);
    try {
      const request = await applyForVerification({});
      setVerificationRequest(request);
      setIsVerificationDialogOpen(false);
      toast({
        title: "Application Submitted!",
        description: "Your verification request has been submitted for review."
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to submit verification request",
        variant: "destructive"
      });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Back */}
        <Link to="/chat" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to chats
        </Link>

        {/* Profile card */}
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="relative w-24 h-24 mx-auto mb-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={user.avatarUrl} />
                <AvatarFallback className="text-2xl bg-muted">{user.displayName ? user.displayName[0] : '?'}</AvatarFallback>
              </Avatar>
              {isOwnProfile && (
                <label className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-1.5 rounded-full cursor-pointer hover:scale-110 transition-transform shadow-lg">
                  <Camera className="h-4 w-4" />
                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                </label>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={editForm.displayName}
                    onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={editForm.role}
                    onValueChange={(value) => setEditForm({ ...editForm, role: value })}
                  >
                    <SelectTrigger id="role" className="bg-secondary border-border">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="vendor">Vendor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={editForm.bio}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                    className="bg-secondary border-border min-h-[100px]"
                    placeholder="Tell us about yourself..."
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Social Links</Label>
                    <Button variant="outline" size="sm" onClick={addSocialLink} className="h-8">
                      <Plus className="h-3 w-3 mr-1" /> Add Link
                    </Button>
                  </div>

                  {editForm.socialLinks.map((link, index) => (
                    <div key={index} className="flex gap-2 items-start bg-secondary/50 p-2 rounded-lg border border-border">
                      <div className="flex-1 space-y-2">
                        <Select
                          value={link.platform}
                          onValueChange={(v) => updateSocialLink(index, "platform", v)}
                        >
                          <SelectTrigger className="bg-secondary border-border h-8 text-xs">
                            <SelectValue placeholder="Platform" />
                          </SelectTrigger>
                          <SelectContent>
                            {PLATFORMS.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="https://..."
                          value={link.url}
                          onChange={(e) => updateSocialLink(index, "url", e.target.value)}
                          className="bg-secondary border-border h-8 text-xs"
                        />
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeSocialLink(index)} className="h-8 w-8 text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {editForm.socialLinks.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2 italic">No social links added yet.</p>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
                    <Save className="mr-2 h-4 w-4" /> {isSaving ? "Saving..." : "Save"}
                  </Button>
                  <Button variant="ghost" className="flex-1" onClick={() => setIsEditing(false)} disabled={isSaving}>
                    <X className="mr-2 h-4 w-4" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="flex items-center gap-2 justify-center">
                  <h2 className="text-xl font-bold text-card-foreground">{user.displayName}</h2>
                  {user.verified && (
                    <img src="/verified-badge.svg" alt="Verified" className="h-9 w-9" title="Verified Account" />
                  )}
                </div>
                <Badge className={`mt-2 ${user.role === "admin" ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"}`}>
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Badge>

                {user.averageRating !== undefined && user.averageRating > 0 && (
                  <div className="mt-3 flex items-center justify-center gap-1 text-sm font-medium">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span>{user.averageRating}</span>
                    <span className="text-muted-foreground text-xs">({user.ratingCount} ratings)</span>
                  </div>
                )}

                {user.bio && (
                  <p className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap">{user.bio}</p>
                )}

                <div className="mt-8 space-y-3">
                  {user.socialLinks && user.socialLinks.map((link, index) => (
                    <a
                      key={index}
                      href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <Button
                        variant="outline"
                        className="w-full h-14 flex items-center justify-between px-6 bg-secondary/50 hover:bg-accent hover:text-accent-foreground border-border hover:border-accent transition-all duration-300 group shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-background group-hover:bg-accent-foreground/10 transition-colors">
                            <SocialIcon platform={link.platform} />
                          </div>
                          <span className="font-semibold capitalize text-base">{link.platform}</span>
                        </div>
                        <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Button>
                    </a>
                  ))}
                  {(!user.socialLinks || user.socialLinks.length === 0) && (
                    <p className="text-sm text-muted-foreground italic py-4">No social links added yet.</p>
                  )}
                </div>

                {/* Contact info - simplified for Linktree view */}
                <div className="mt-10 pt-6 border-t border-border/50">
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground px-4 py-2 bg-secondary/30 rounded-full">
                      <Mail className="h-4 w-4" />
                      <span>{user.email}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${user.status === "active" ? "bg-accent animate-pulse" : "bg-muted-foreground"}`} />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {user.status === "active" ? "Available Now" : "Unavailable"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-10 flex flex-col gap-3">
                  {isOwnProfile && (
                    <>
                      <Button className="w-full shadow-lg shadow-primary/20" onClick={() => setIsEditing(true)}>
                        <Edit2 className="mr-2 h-4 w-4" /> Edit My Profile
                      </Button>
                      <Button variant="ghost" className="w-full text-destructive hover:bg-destructive/10" onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" /> Logout
                      </Button>
                    </>
                  )}
                  {!isOwnProfile && (
                    <>
                      <Link to={`/chat?userId=${user.id}`}>
                        <Button className="w-full shadow-lg shadow-primary/20">
                          <MessageSquare className="mr-2 h-4 w-4" /> Send message
                        </Button>
                      </Link>
                      <Button variant="outline" className="w-full" onClick={() => setIsRatingDialogOpen(true)}>
                        <Star className="mr-2 h-4 w-4 text-yellow-400" /> Rate {user.displayName}
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground" onClick={copyLink}>
                    <Share2 className="mr-2 h-4 w-4" /> {isOwnProfile ? "Share My Profile" : `Share ${user.displayName}'s profile`}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Share section - more compact */}
        <Card className="bg-card/50 backdrop-blur-sm border-border mt-6">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs font-medium text-muted-foreground truncate flex-1">{profileLink}</p>
              <Button variant="secondary" size="sm" onClick={copyLink} className="h-8 shrink-0">
                <Copy className="h-4 w-4 mr-2" /> Copy
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rating Dialog */}
      <Dialog open={isRatingDialogOpen} onOpenChange={setIsRatingDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rate {user.displayName}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-6 py-6">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setRating(s)}
                  className={`p-1 transition-transform hover:scale-110 ${s <= rating ? "text-yellow-400" : "text-muted-foreground"
                    }`}
                >
                  <Star className={`h-10 w-10 ${s <= rating ? "fill-current" : ""}`} />
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">Select a star rating from 1 to 5</p>
            <Button
              className="w-full"
              onClick={handleRateUser}
            >
              Submit Rating
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfilePage;
