import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Share2, Copy, MessageSquare, Twitter, Instagram, Linkedin, Github, Globe, Plus, Trash2, Star, LogOut, Facebook, Youtube } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getUser, getUserByUsername, updateUserProfile, uploadAvatar, rateUser, AuthUser, applyForVerification, getVerificationStatus, getVerificationFee, VerificationRequest, getRatingEligibility, uploadCoverPhoto } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Camera, Save, X, Edit2, Eye } from "lucide-react";
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
  { id: "facebook", name: "Facebook", icon: <Facebook className="h-4 w-4" /> },
  { id: "twitter", name: "Twitter", icon: <Twitter className="h-4 w-4" /> },
  { id: "instagram", name: "Instagram", icon: <Instagram className="h-4 w-4" /> },
  { id: "youtube", name: "YouTube", icon: <Youtube className="h-4 w-4" /> },
  { id: "linkedin", name: "LinkedIn", icon: <Linkedin className="h-4 w-4" /> },
  { id: "github", name: "GitHub", icon: <Github className="h-4 w-4" /> },
  { id: "website", name: "Website", icon: <Globe className="h-4 w-4" /> },
  { id: "other", name: "Other", icon: <Globe className="h-4 w-4" /> },
];

const SocialIcon = ({ platform, className }: { platform: string; className?: string }) => {
  const p = platform.toLowerCase();
  if (p.includes('facebook')) return <Facebook className={className || "h-4 w-4"} />;
  if (p.includes('twitter')) return <Twitter className={className || "h-4 w-4"} />;
  if (p.includes('instagram')) return <Instagram className={className || "h-4 w-4"} />;
  if (p.includes('youtube')) return <Youtube className={className || "h-4 w-4"} />;
  if (p.includes('linkedin')) return <Linkedin className={className || "h-4 w-4"} />;
  if (p.includes('github')) return <Github className={className || "h-4 w-4"} />;
  return <Globe className={className || "h-4 w-4"} />;
};

const ProfilePage = () => {
  const { username } = useParams();
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
    city: "",
    pincode: "",
    socialLinks: [] as { platform: string; url: string }[]
  });
  const [isRatingDialogOpen, setIsRatingDialogOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [canRateUser, setCanRateUser] = useState(false);
  const [ratingEligibilityReason, setRatingEligibilityReason] = useState("");
  const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false);
  const [verificationRequest, setVerificationRequest] = useState<VerificationRequest | null>(null);
  const [verificationFee, setVerificationFee] = useState(0);
  const [isApplying, setIsApplying] = useState(false);
  const [isViewAllRatingsOpen, setIsViewAllRatingsOpen] = useState(false);
  const [allRatings, setAllRatings] = useState<Array<{ rating: number; comment?: string; reviewerDisplayName: string; createdAt: string }>>([]);

  const loadUser = async () => {
    setIsLoading(true);
    try {
      if (username) {
        const userData = await getUserByUsername(username);
        setUser(userData);
        if (currentUser?.id && userData.id !== currentUser.id) {
          try {
            const eligibility = await getRatingEligibility(userData.id);
            setCanRateUser(eligibility.canRate);
            setRatingEligibilityReason(eligibility.reason || "");
          } catch (eligibilityError) {
            console.error("Rating eligibility error:", eligibilityError);
            setCanRateUser(false);
            setRatingEligibilityReason("Unable to verify rating eligibility.");
          }
        }
      } else {
        const userData = await getUser(currentUser.id); // Refresh current user data
        setUser(userData);
        setEditForm({
          displayName: userData.displayName || "",
          bio: userData.bio || "",
          email: userData.email || "",
          city: userData.city || "",
          pincode: userData.pincode || "",
          socialLinks: userData.socialLinks || []
        });
        setCanRateUser(false);
        setRatingEligibilityReason("");
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
      if (!username) {
        // Only load verification data for own profile
        loadVerificationData();
      }
    }
  }, [username, currentUser, authLoading]);

  // Update meta tags for social sharing
  useEffect(() => {
    if (user) {
      document.title = `${user.displayName || user.username} | Krovaa`;

      // Update OG tags for social sharing
      const updateMetaTag = (property: string, content: string) => {
        let tag = document.querySelector(`meta[property="${property}"]`);
        if (!tag) {
          tag = document.createElement('meta');
          tag.setAttribute('property', property);
          document.head.appendChild(tag);
        }
        tag.setAttribute('content', content);
      };

      updateMetaTag('og:title', `${user.displayName || user.username} | Krovaa`);
      updateMetaTag('og:description', user.bio || `Connect with ${user.displayName || user.username} on Krovaa`);
      updateMetaTag('og:image', user.coverPhotoUrl || user.avatarUrl || '/verified-badge.png');
      updateMetaTag('og:url', `${window.location.origin}/profile/${user.username}`);

      // Twitter tags
      const updateTwitterTag = (name: string, content: string) => {
        let tag = document.querySelector(`meta[name="${name}"]`);
        if (!tag) {
          tag = document.createElement('meta');
          tag.setAttribute('name', name);
          document.head.appendChild(tag);
        }
        tag.setAttribute('content', content);
      };

      updateTwitterTag('twitter:title', `${user.displayName || user.username} | Krovaa`);
      updateTwitterTag('twitter:description', user.bio || `Connect with ${user.displayName || user.username} on Krovaa`);
      updateTwitterTag('twitter:image', user.coverPhotoUrl || user.avatarUrl || '/verified-badge.png');
    }
  }, [user]);

  if (authLoading || (isLoading && !user)) return <LoadingScreen />;

  if (!user || error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{error || "User not found"}</p>
      </div>
    );
  }

  const isOwnProfile = user.id === currentUser?.id;
  const profileLink = `${window.location.origin}/profile/${user.username}`;


  const copyLink = () => {
    navigator.clipboard.writeText(profileLink);
    toast({ title: "Link copied!", description: "Profile link copied to clipboard" });
  };

  const handleSave = async () => {
    if (!user) return;
    const sanitizedForm = {
      ...editForm,
      displayName: editForm.displayName?.trim(),
      bio: editForm.bio?.trim(),
      email: editForm.email?.trim()?.toLowerCase(),
      city: editForm.city?.trim(),
      pincode: editForm.pincode?.trim(),
    };
    try {
      const updated = await updateUserProfile(user.id, sanitizedForm);
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
      await rateUser({ reviewedId: user.id, rating: rating, comment: ratingComment.trim() });
      toast({ title: "Rating Submitted", description: `You rated ${user.displayName} ${rating} stars.` });
      setIsRatingDialogOpen(false);
      setRatingComment("");
      loadUser(); // Refresh to show new rating
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to submit rating", variant: "destructive" });
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleCoverPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Cover photos must be under 5MB.", variant: "destructive" });
      return;
    }

    try {
      const { coverPhotoUrl } = await uploadCoverPhoto(file);
      setUser({ ...user, coverPhotoUrl });
      toast({ title: "Cover photo updated!", description: "Your profile cover has been changed." });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Failed to upload cover photo", variant: "destructive" });
    }
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

  const openViewAllRatings = async () => {
    if (!user) return;
    setIsViewAllRatingsOpen(true);

    try {
      const response = await fetch(`/api/users/${user.id}/ratings`);
      if (response.ok) {
        const data = await response.json();
        setAllRatings(data.ratings.map((r: any) => ({
          rating: r.rating,
          comment: r.comment,
          reviewerDisplayName: r.reviewer.displayName || r.reviewer.username,
          createdAt: r.createdAt,
          reviewerAvatar: r.reviewer.avatarUrl
        })));
      }
    } catch (err) {
      console.error("Failed to fetch ratings:", err);
      toast({ title: "Error", description: "Failed to load ratings.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Back Button */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border/20">
        <div className="max-w-lg mx-auto px-4 py-3">
          <Link to="/chat" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>
      </div>

      <div className="max-w-lg mx-auto">
        {/* Cover Photo Section */}
        <div className="relative h-40 bg-gradient-to-r from-primary/20 to-accent/20 overflow-hidden group">
          {user.coverPhotoUrl && (
            <img
              src={user.coverPhotoUrl}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          )}
          {isOwnProfile && (
            <label className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center cursor-pointer transition-colors">
              <Camera className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              <input type="file" className="hidden" accept="image/*" onChange={handleCoverPhotoUpload} />
            </label>
          )}
        </div>

        {/* Profile Card */}
        <div className="px-4 pb-6">
          <Card className="bg-card border-2 border-border/80 shadow-lg -mt-12 relative z-10">
            <CardContent className="pt-16 pb-6">
              {/* Avatar - Overlaid on Cover */}
              <div className="relative -mt-24 mb-4 flex justify-center">
                <div className="relative">
                  <Avatar className="h-32 w-32 border-4 border-background shadow-lg">
                    <AvatarImage src={user.avatarUrl || undefined} />
                    <AvatarFallback className="text-4xl bg-muted">
                      {user.displayName ? user.displayName[0] : '?'}
                    </AvatarFallback>
                  </Avatar>
                  {isOwnProfile && (
                    <label className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-2 rounded-full cursor-pointer hover:scale-110 transition-transform shadow-lg">
                      <Camera className="h-5 w-5" />
                      <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                    </label>
                  )}
                </div>
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
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={editForm.bio}
                      onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                      className="bg-secondary border-border min-h-[80px]"
                      placeholder="Tell us about yourself..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={editForm.city}
                        onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                        className="bg-secondary border-border"
                        placeholder="Mumbai"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pincode">Pincode</Label>
                      <Input
                        id="pincode"
                        value={editForm.pincode}
                        onChange={(e) => setEditForm({ ...editForm, pincode: e.target.value })}
                        className="bg-secondary border-border"
                        placeholder="400001"
                      />
                    </div>
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
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
                      <Save className="mr-2 h-4 w-4" /> {isSaving ? "Saving..." : "Save"}
                    </Button>
                    <Button variant="ghost" className="flex-1" onClick={() => setIsEditing(false)} disabled={isSaving}>
                      <X className="mr-2 h-4 w-4" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  {/* Name & Verification */}
                  <div>
                    <div className="flex items-center gap-2 justify-center mb-2">
                      <h1 className="text-2xl font-bold text-card-foreground">{user.displayName}</h1>
                      {user.verified && (
                        <img src="/verified-badge.svg" alt="Verified" className="h-6 w-6" title="Verified Account" />
                      )}
                    </div>
                    {(user.city || user.pincode) && (
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">
                        {user.city}{user.city && user.pincode ? ", " : ""}{user.pincode}
                      </p>
                    )}
                  </div>

                  {/* Stats Section */}
                  {user.averageRating !== undefined && user.averageRating > 0 && (
                    <div className="flex items-center justify-center gap-4 p-3 bg-secondary/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <div className="text-left">
                          <p className="text-sm font-bold">{user.averageRating}</p>
                          <p className="text-xs text-muted-foreground">{user.ratingCount} ratings</p>
                        </div>
                      </div>
                      {!isOwnProfile && user.ratingCount > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={openViewAllRatings}
                          className="ml-auto h-8"
                        >
                          <Eye className="h-4 w-4 mr-1" /> View reviews
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Bio */}
                  {user.bio && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap px-2">{user.bio}</p>
                  )}

                  {/* Status */}
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <span className={`h-2 w-2 rounded-full ${user.status === "active" ? "bg-accent animate-pulse" : "bg-muted-foreground"}`} />
                    <span className="text-xs font-medium text-muted-foreground uppercase">
                      {user.status === "active" ? "Available Now" : "Unavailable"}
                    </span>
                  </div>

                  {/* Social Links */}
                  {user.socialLinks && user.socialLinks.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      {user.socialLinks.map((link, index) => (
                        <a
                          key={index}
                          href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="transition-transform hover:scale-110 active:scale-95"
                          title={link.platform.charAt(0).toUpperCase() + link.platform.slice(1)}
                        >
                          <div className="h-10 w-10 flex items-center justify-center bg-secondary/50 hover:bg-primary/[0.08] text-foreground hover:text-primary border border-border/50 hover:border-primary/30 rounded-lg transition-all duration-300 shadow-sm">
                            <SocialIcon platform={link.platform} className="h-4 w-4" />
                          </div>
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-6 space-y-3">
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
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setIsRatingDialogOpen(true)}
                          disabled={!canRateUser}
                        >
                          <Star className="mr-2 h-4 w-4 text-yellow-400" /> Rate {user.displayName}
                        </Button>
                        {!canRateUser && (
                          <p className="text-xs text-muted-foreground text-center px-2">
                            {ratingEligibilityReason || "You can rate only after chatting and completing a deal with this user."}
                          </p>
                        )}
                      </>
                    )}
                    <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground" onClick={copyLink}>
                      <Share2 className="mr-2 h-4 w-4" /> {isOwnProfile ? "Share My Profile" : "Share Profile"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Rating Dialog */}
      <Dialog open={isRatingDialogOpen} onOpenChange={setIsRatingDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rate {user?.displayName}</DialogTitle>
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
            <div className="w-full space-y-2">
              <Label htmlFor="rating-comment">Comment</Label>
              <Textarea
                id="rating-comment"
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                className="bg-secondary border-border min-h-[90px]"
                placeholder="Share your experience..."
              />
              <p className="text-xs text-muted-foreground">A short comment is required to submit a rating.</p>
            </div>
            <Button
              className="w-full"
              onClick={handleRateUser}
              disabled={!canRateUser || ratingComment.trim().length === 0}
            >
              Submit Rating
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View All Ratings Dialog */}
      <Dialog open={isViewAllRatingsOpen} onOpenChange={setIsViewAllRatingsOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reviews for {user?.displayName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {allRatings.length > 0 ? (
              allRatings.map((rating, idx) => (
                <div key={idx} className="p-3 bg-secondary/20 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{rating.reviewerDisplayName}</span>
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < rating.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                            }`}
                        />
                      ))}
                    </div>
                  </div>
                  {rating.comment && (
                    <p className="text-sm text-muted-foreground">{rating.comment}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(rating.createdAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No reviews yet</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfilePage;
