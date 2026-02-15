import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Share2, Copy, Mail, Phone, MessageSquare } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getUser, updateUserProfile, uploadAvatar, AuthUser } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Camera, Save, X, Edit2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ProfilePage = () => {
  const { userId } = useParams();
  const { user: currentUser, isLoading: authLoading } = useAuth();
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
    role: ""
  });

  useEffect(() => {
    if (!currentUser && !authLoading) {
      navigate("/login");
      return;
    }

    if (currentUser) {
      loadUser();
    }
  }, [userId, currentUser, authLoading, navigate]);

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
          role: userData.role || ""
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

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
                <h2 className="text-xl font-bold text-card-foreground">{user.displayName}</h2>
                <Badge className={`mt-2 ${user.role === "admin" ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"}`}>
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Badge>

                {user.bio && (
                  <p className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap">{user.bio}</p>
                )}

                {/* Contact info */}
                <div className="mt-6 space-y-3 text-left">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-card-foreground">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className={`h-2.5 w-2.5 rounded-full ${user.status === "active" ? "bg-accent" : "bg-muted-foreground"}`} />
                    <span className="text-card-foreground">
                      {user.status === "active" ? "Active" : "Offline"}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 flex flex-col gap-3">
                  {isOwnProfile ? (
                    <Button className="w-full" onClick={() => setIsEditing(true)}>
                      <Edit2 className="mr-2 h-4 w-4" /> Edit Profile
                    </Button>
                  ) : (
                    <Link to="/chat">
                      <Button className="w-full">
                        <MessageSquare className="mr-2 h-4 w-4" /> Message
                      </Button>
                    </Link>
                  )}
                  <Button variant="outline" className="w-full" onClick={copyLink}>
                    <Share2 className="mr-2 h-4 w-4" /> Share Profile
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Share section */}
        <Card className="bg-card border-border mt-4">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-card-foreground mb-3">Profile Link</h3>
            <div className="flex items-center gap-2">
              <Input value={profileLink} readOnly className="bg-secondary border-border text-xs" />
              <Button variant="ghost" size="icon" onClick={copyLink}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;
