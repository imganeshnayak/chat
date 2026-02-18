import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare, Users, DollarSign, Shield, Search,
  Eye, Ban, AlertTriangle, ChevronRight, TrendingUp,
  Activity, UserCheck, Trash2, CheckCircle2, LogOut, Wallet, Bell, Send,
  IndianRupee, Settings, Loader2
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAdminStats,
  getAdminUsers,
  getAdminChats,
  getAdminEscrowDeals,
  getActivityLogs,
  updateUserStatus,
  updateUserRole,
  deleteUser,
  getAdminReports,
  updateReportStatus,
  getVerificationRequests,
  approveVerificationRequest,
  rejectVerificationRequest,
  getAdminPayouts,
  updatePayoutStatus,
  broadcastNotification,
  getNotifications,
  getSystemSettings,
  updateSystemSettings,
  Notification,
  VerificationRequest,
  AdminStats,
  AdminUser,
  AdminReport,
  PayoutRequest
} from "@/lib/api";

type AdminTab = "overview" | "users" | "chats" | "escrow" | "activity" | "reports" | "verifications" | "payouts" | "broadcast" | "settings";

const AdminDashboard = () => {
  const { toast } = useToast();
  const { user, isLoading: authLoading, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [escrowDeals, setEscrowDeals] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastType, setBroadcastType] = useState<"info" | "warning" | "success" | "alert">("info");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastColor, setBroadcastColor] = useState("#4f46e5");
  const [sentNotifications, setSentNotifications] = useState<Notification[]>([]);
  const [systemSettings, setSystemSettings] = useState<Record<string, string>>({ verification_fee: "" });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    if (!user && !authLoading) {
      navigate("/login");
      return;
    }
    if (user && user.role !== "admin") {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access the admin panel",
        variant: "destructive"
      });
      navigate("/chat");
      return;
    }
    if (user) {
      loadData();
    }
  }, [user, authLoading, navigate]);

  // Load broadcast history when broadcast tab is opened
  useEffect(() => {
    if (activeTab === "broadcast" && user) {
      getNotifications().then(setSentNotifications).catch(() => { });
    }
  }, [activeTab, user]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const statsData = await getAdminStats();
      setStats(statsData);

      if (activeTab === "users") {
        const usersData = await getAdminUsers({ search: searchQuery, status: statusFilter === "all" ? "" : statusFilter });
        setUsers(usersData.users);
      } else if (activeTab === "chats") {
        const chatsData = await getAdminChats();
        setChats(chatsData.chats);
      } else if (activeTab === "escrow") {
        const escrowData = await getAdminEscrowDeals({ status: statusFilter === "all" ? "" : statusFilter });
        setEscrowDeals(escrowData.deals);
      } else if (activeTab === "activity") {
        const activityData = await getActivityLogs({ limit: 50 });
        setActivities(activityData.activities);
      } else if (activeTab === "reports") {
        const reportsData = await getAdminReports();
        setReports(reportsData.reports);
      } else if (activeTab === "verifications") {
        const verificationsData = await getVerificationRequests(statusFilter === "all" ? "" : statusFilter);
        setVerificationRequests(verificationsData);
      } else if (activeTab === "payouts") {
        const payoutsData = await getAdminPayouts(1, 20, statusFilter === "all" ? "" : statusFilter);
        setPayouts(payoutsData.payouts);
      } else if (activeTab === "settings") {
        const settingsData = await getSystemSettings();
        setSystemSettings(settingsData);
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [activeTab, searchQuery, statusFilter]);

  const handleUpdateStatus = async (userId: number, status: string) => {
    try {
      await updateUserStatus(userId, status);
      toast({ title: "Success", description: `User status updated to ${status}` });
      loadData();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update status",
        variant: "destructive"
      });
    }
  };

  const handleUpdateRole = async (userId: number, role: string) => {
    try {
      await updateUserRole(userId, role);
      toast({ title: "Success", description: `User role updated to ${role}` });
      loadData();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update role",
        variant: "destructive"
      });
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return;
    }
    try {
      await deleteUser(userId);
      toast({ title: "Success", description: "User deleted successfully" });
      loadData();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete user",
        variant: "destructive"
      });
    }
  };

  const handleUpdateReportStatus = async (reportId: number, status: string) => {
    try {
      await updateReportStatus(reportId, status);
      toast({ title: "Report Updated", description: `Report status changed to ${status}.` });
      loadData();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update report",
        variant: "destructive"
      });
    }
  };

  const handleApproveVerification = async (requestId: number) => {
    try {
      await approveVerificationRequest(requestId);
      toast({ title: "Verification Approved", description: "User has been verified successfully." });
      loadData();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to approve verification",
        variant: "destructive"
      });
    }
  };

  const handleRejectVerification = async (requestId: number) => {
    const adminNote = prompt("Enter reason for rejection (optional):");
    try {
      await rejectVerificationRequest(requestId, adminNote || undefined);
      toast({ title: "Verification Rejected", description: "Request has been rejected." });
      loadData();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to reject verification",
        variant: "destructive"
      });
    }
  };

  const handleUpdatePayoutStatus = async (payoutId: number, status: string) => {
    const adminNote = status === 'processing' || status === 'completed'
      ? prompt("Enter transaction reference/note (optional):")
      : (status === 'cancelled' ? prompt("Enter cancellation reason:") : undefined);

    if (status === 'cancelled' && !adminNote) return;

    try {
      await updatePayoutStatus(payoutId, {
        status,
        adminNote: adminNote || undefined
      });
      toast({ title: "Payout Updated", description: `Payout marked as ${status}` });
      loadData();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update payout",
        variant: "destructive"
      });
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await updateSystemSettings(systemSettings);
      toast({ title: "Settings Saved", description: "Global configuration updated successfully." });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save settings",
        variant: "destructive"
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: TrendingUp },
    { id: "users" as const, label: "Users", icon: Users, count: stats?.totalUsers },
    { id: "chats" as const, label: "Chats", icon: MessageSquare, count: stats?.totalChats },
    { id: "escrow" as const, label: "Escrow", icon: IndianRupee, count: stats?.totalEscrowDeals },
    { id: "verifications" as const, label: "Verifications", icon: CheckCircle2 },
    { id: "payouts" as const, label: "Payouts", icon: Wallet },
    { id: "reports" as const, label: "Reports", icon: AlertTriangle },
    { id: "activity" as const, label: "Activity", icon: Activity },
    { id: "broadcast" as const, label: "Broadcast", icon: Bell },
    { id: "settings" as const, label: "Settings", icon: Settings },
  ];

  if (isLoading && !stats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading admin panel...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <div className="hidden md:flex flex-col w-64 border-r border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-8">
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold text-card-foreground">Admin Panel</span>
        </div>
        <nav className="space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary"
                }`}
            >
              <tab.icon className="h-4 w-4" />
              <span className="flex-1 text-left">{tab.label}</span>
              {tab.count !== undefined && (
                <Badge variant="secondary" className="text-xs">{tab.count}</Badge>
              )}
            </button>
          ))}
        </nav>
        <div className="mt-auto space-y-2">
          <Link to="/chat">
            <Button variant="outline" size="sm" className="w-full">Back to App</Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex z-10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center py-3 text-xs ${activeTab === tab.id ? "text-primary" : "text-muted-foreground"
              }`}
          >
            <tab.icon className="h-5 w-5 mb-1" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-foreground capitalize">{activeTab}</h1>
            {activeTab !== "overview" && (
              <div className="flex gap-2">
                {(activeTab === "users" || activeTab === "escrow" || activeTab === "verifications" || activeTab === "payouts") && (
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {activeTab === "verifications" ? (
                        <>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                          {activeTab === "escrow" && <SelectItem value="completed">Completed</SelectItem>}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                )}
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9 bg-secondary border-border"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <ScrollArea className="h-[calc(100vh-140px)]">
            {activeTab === "overview" && stats && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-card-foreground">{stats.totalUsers}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        <UserCheck className="inline h-3 w-3 mr-1" />
                        {stats.activeUsers} active
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Messages</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-card-foreground">{stats.totalMessages}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Across {stats.totalChats} chats
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Escrow Deals</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-card-foreground">{stats.totalEscrowDeals}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats.activeEscrowDeals} active
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-card-foreground">
                        ₹{stats.totalEscrowValue.toLocaleString('en-IN')}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        In escrow
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-card-foreground">Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{stats.recentActivity} actions in the last 24 hours</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "users" && (
              <div className="space-y-3">
                {users.map((user) => (
                  <Card key={user.id} className="bg-card border-border">
                    <CardContent className="py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatarUrl} />
                          <AvatarFallback>{user.displayName?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-card-foreground">{user.displayName}</p>
                          <div className="flex gap-2 items-center text-xs text-muted-foreground">
                            <span>@{user.username}<span>•</span></span>
                            <span>{user._count.sentMessages} messages</span>
                            <span>•</span>
                            <span>{user._count.clientDeals + user._count.vendorDeals} deals</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <Select
                          value={user.role}
                          onValueChange={(role) => handleUpdateRole(user.id, role)}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="client">Client</SelectItem>
                            <SelectItem value="vendor">Vendor</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select
                          value={user.status}
                          onValueChange={(status) => handleUpdateStatus(user.id, status)}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="suspended">Suspended</SelectItem>
                            <SelectItem value="banned">Banned</SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {activeTab === "chats" && (
              <div className="space-y-3">
                {chats.map((chat) => (
                  <Card key={chat.chatId} className="bg-card border-border">
                    <CardContent className="py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                          {chat.participants.map((p: any) => (
                            <Avatar key={p.id} className="h-8 w-8 border-2 border-card">
                              <AvatarImage src={p.avatarUrl} />
                              <AvatarFallback>{p.displayName?.[0] || '?'}</AvatarFallback>
                            </Avatar>
                          ))}
                        </div>
                        <div>
                          <p className="font-medium text-card-foreground text-sm">
                            {chat.participants.map((p: any) => p.displayName).join(" & ")}
                          </p>
                          <p className="text-xs text-muted-foreground">{chat.messageCount} messages</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="View chat"
                          onClick={() => navigate(`/admin/chats/${chat.chatId}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {activeTab === "escrow" && (
              <div className="space-y-3">
                {escrowDeals.map((deal) => (
                  <Card key={deal.id} className="bg-card border-border">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium text-card-foreground">{deal.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {deal.client.displayName} → {deal.vendor.displayName}
                          </p>
                        </div>
                        <Badge className={deal.status === "active" ? "bg-accent text-accent-foreground" : deal.status === "completed" ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}>
                          {deal.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">
                          ₹{deal.totalAmount.toLocaleString('en-IN')} total
                        </span>
                        <span className="text-primary font-semibold">{deal.releasedPercent.toFixed(1)}% released</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${deal.releasedPercent}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {activeTab === "activity" && (
              <div className="space-y-2">
                {activities.map((activity) => (
                  <Card key={activity.id} className="bg-card border-border">
                    <CardContent className="py-3 flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={activity.user.avatarUrl} />
                        <AvatarFallback>{activity.user.displayName?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm text-card-foreground">
                          <span className="font-medium">{activity.user.displayName}</span> {activity.action}
                        </p>
                        {activity.details && (
                          <p className="text-xs text-muted-foreground">{activity.details}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(activity.createdAt).toLocaleTimeString()}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {activeTab === "reports" && (
              <div className="space-y-3">
                {reports.length === 0 ? (
                  <div className="text-center py-10">
                    <AlertTriangle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No reports found.</p>
                  </div>
                ) : (
                  reports.map((report) => (
                    <Card key={report.id} className="bg-card border-border">
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-destructive/10 rounded-full">
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                            </div>
                            <div>
                              <p className="font-medium text-card-foreground">
                                Reported: {report.reported.displayName} (@{report.reported.username})
                              </p>
                              <p className="text-xs text-muted-foreground">
                                By: {report.reporter.displayName} (@{report.reporter.username})
                              </p>
                            </div>
                          </div>
                          <Badge variant={report.status === "pending" ? "destructive" : "secondary"}>
                            {report.status}
                          </Badge>
                        </div>
                        <div className="bg-secondary/50 p-3 rounded-md mb-4">
                          <p className="text-sm text-card-foreground italic">"{report.reason}"</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            Reported on {new Date(report.createdAt).toLocaleDateString()}
                          </span>
                          <div className="flex gap-2">
                            {report.status === "pending" && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => handleUpdateReportStatus(report.id, "resolved")}
                                >
                                  Resolve
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-muted-foreground"
                                  onClick={() => handleUpdateReportStatus(report.id, "dismissed")}
                                >
                                  Dismiss
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}

            {activeTab === "verifications" && (
              <div className="space-y-3">
                {verificationRequests.length === 0 ? (
                  <div className="text-center py-10">
                    <CheckCircle2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No verification requests found.</p>
                  </div>
                ) : (
                  verificationRequests.map((request) => (
                    <Card key={request.id} className="bg-card border-border">
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={request.user?.avatarUrl} />
                              <AvatarFallback>{request.user?.displayName?.[0] || '?'}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-card-foreground">
                                {request.user?.displayName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                @{request.user?.username} • {request.user?.email}
                              </p>
                            </div>
                          </div>
                          <Badge
                            className={
                              request.status === "pending" ? "bg-yellow-500/10 text-yellow-500" :
                                request.status === "approved" ? "bg-green-500/10 text-green-500" :
                                  "bg-red-500/10 text-red-500"
                            }
                          >
                            {request.status}
                          </Badge>
                        </div>
                        <div className="bg-secondary/50 p-3 rounded-md mb-4">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Payment Amount:</span>
                            <span className="font-medium text-card-foreground">₹{request.paymentAmount}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Submitted:</span>
                            <span className="text-card-foreground">
                              {new Date(request.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        {request.adminNote && (
                          <div className="p-3 bg-red-500/10 rounded-md mb-4">
                            <p className="text-sm font-medium text-red-500">Admin Note:</p>
                            <p className="text-sm text-muted-foreground mt-1">{request.adminNote}</p>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            Request ID: #{request.id}
                          </span>
                          <div className="flex gap-2">
                            {request.status === "pending" && (
                              <>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => handleApproveVerification(request.id)}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => handleRejectVerification(request.id)}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}

            {activeTab === "payouts" && (
              <div className="space-y-4">
                <div className="flex gap-4 mb-6">
                  <Card className="flex-1 bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Pending Requests</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats?.pendingPayouts || 0}</div>
                    </CardContent>
                  </Card>
                  <Card className="flex-1 bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Payouts</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">₹{(stats?.totalPayoutValue || 0).toLocaleString()}</div>
                    </CardContent>
                  </Card>
                </div>

                {payouts.length === 0 ? (
                  <div className="text-center py-12 bg-card rounded-lg border border-border">
                    <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <h3 className="text-lg font-medium text-foreground">No Payout Requests</h3>
                    <p className="text-muted-foreground">There are no payout requests to show.</p>
                  </div>
                ) : (
                  payouts.map((payout) => (
                    <Card key={payout.id} className="bg-card border-border">
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xl font-bold text-primary">₹{payout.amount.toLocaleString()}</span>
                              <Badge variant={
                                payout.status === 'completed' ? 'default' :
                                  payout.status === 'pending' ? 'secondary' :
                                    payout.status === 'failed' || payout.status === 'cancelled' ? 'destructive' : 'outline'
                              } className={payout.status === 'pending' ? 'bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20' : ''}>
                                {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>Requested by <b>{payout.user?.displayName}</b></span>
                              <span>•</span>
                              <span>{new Date(payout.requestedAt).toLocaleDateString()}</span>
                            </div>
                            <div className="mt-2 p-3 bg-secondary/30 rounded-md text-sm">
                              <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                                <span className="text-muted-foreground">Payment Method:</span>
                                <Badge variant="outline" className="w-fit uppercase">
                                  {payout.paymentMethod || 'bank'}
                                </Badge>

                                {payout.paymentMethod === 'upi' ? (
                                  <>
                                    <span className="text-muted-foreground">UPI ID:</span>
                                    <span className="font-mono">{payout.upiVpa}</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-muted-foreground">Bank Account:</span>
                                    <span className="font-mono">{payout.bankAccount}</span>
                                    <span className="text-muted-foreground">IFSC:</span>
                                    <span className="font-mono">{payout.ifscCode}</span>
                                  </>
                                )}

                                <span className="text-muted-foreground">Account Name:</span>
                                <span className="font-medium">{payout.accountName}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 min-w-[140px] justify-center">
                            {payout.status === 'pending' && (
                              <>
                                <Button size="sm" onClick={() => handleUpdatePayoutStatus(payout.id, 'processing')}>
                                  Mark Processing
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleUpdatePayoutStatus(payout.id, 'cancelled')}>
                                  Cancel & Refund
                                </Button>
                              </>
                            )}
                            {payout.status === 'processing' && (
                              <>
                                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleUpdatePayoutStatus(payout.id, 'completed')}>
                                  Mark Completed
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleUpdatePayoutStatus(payout.id, 'failed')}>
                                  Mark Failed
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
            {activeTab === "broadcast" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Bell className="h-5 w-5 text-primary" />
                      Broadcast to All Users
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Send a notification to every user instantly</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Send Form */}
                  <Card className="lg:col-span-1 h-fit">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" /> New Broadcast</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-1 block">Type</label>
                        <div className="flex gap-2 flex-wrap">
                          {(["info", "warning", "success", "alert"] as const).map(t => (
                            <button
                              key={t}
                              onClick={() => setBroadcastType(t)}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${broadcastType === t
                                ? t === "info" ? "bg-blue-500/20 border-blue-500 text-blue-400"
                                  : t === "warning" ? "bg-yellow-500/20 border-yellow-500 text-yellow-400"
                                    : t === "success" ? "bg-green-500/20 border-green-500 text-green-400"
                                      : "bg-red-500/20 border-red-500 text-red-400"
                                : "border-border text-muted-foreground hover:border-primary/50"
                                }`}
                            >
                              {t === "info" ? "🔵" : t === "warning" ? "🟡" : t === "success" ? "🟢" : "🔴"}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Theme Color</label>
                        <div className="flex gap-2 flex-wrap">
                          {[
                            { name: "Indigo", hex: "#4f46e5" },
                            { name: "Emerald", hex: "#10b981" },
                            { name: "Amber", hex: "#f59e0b" },
                            { name: "Rose", hex: "#f43f5e" },
                            { name: "Violet", hex: "#8b5cf6" },
                            { name: "Cyan", hex: "#06b6d4" },
                            { name: "Slate", hex: "#475569" },
                          ].map(c => (
                            <button
                              key={c.hex}
                              type="button"
                              onClick={() => setBroadcastColor(c.hex)}
                              className={`h-8 w-8 rounded-full border-2 transition-all hover:scale-110 ${broadcastColor === c.hex ? "border-white ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-transparent"}`}
                              style={{ backgroundColor: c.hex }}
                              title={c.name}
                            />
                          ))}
                          <div className="relative flex items-center gap-2 ml-2">
                            <Input
                              type="color"
                              value={broadcastColor}
                              onChange={(e) => setBroadcastColor(e.target.value)}
                              className="h-8 w-8 p-0 border-none bg-transparent cursor-pointer overflow-hidden rounded-full shadow-sm"
                            />
                            <span className="text-[10px] font-mono text-muted-foreground uppercase">{broadcastColor}</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Title</label>
                        <Input
                          placeholder="e.g. System Maintenance"
                          value={broadcastTitle}
                          onChange={e => setBroadcastTitle(e.target.value)}
                          maxLength={100}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Message</label>
                        <Textarea
                          placeholder="Write your message..."
                          value={broadcastMessage}
                          onChange={e => setBroadcastMessage(e.target.value)}
                          rows={4}
                          maxLength={500}
                        />
                        <p className="text-xs text-muted-foreground mt-1 text-right">{broadcastMessage.length}/500</p>
                      </div>
                      <Button
                        className="w-full"
                        disabled={!broadcastTitle.trim() || !broadcastMessage.trim() || isBroadcasting}
                        onClick={async () => {
                          setIsBroadcasting(true);
                          try {
                            await broadcastNotification({
                              title: broadcastTitle.trim(),
                              message: broadcastMessage.trim(),
                              type: broadcastType,
                              color: broadcastColor
                            });
                            toast({ title: "📢 Broadcast Sent!", description: `All users have been notified.` });
                            setBroadcastTitle("");
                            setBroadcastMessage("");
                            // Refresh history
                            const notifs = await getNotifications();
                            setSentNotifications(notifs);
                          } catch (err) {
                            toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to send", variant: "destructive" });
                          } finally {
                            setIsBroadcasting(false);
                          }
                        }}
                      >
                        {isBroadcasting ? "Sending..." : "📢 Send Broadcast"}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* History */}
                  <div className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                        <Activity className="h-4 w-4" /> Broadcast History
                      </h3>
                      <button
                        className="text-xs text-primary hover:underline"
                        onClick={async () => { const n = await getNotifications(); setSentNotifications(n); }}
                      >Refresh</button>
                    </div>
                    {sentNotifications.length === 0 ? (
                      <div className="text-center py-12 bg-card rounded-lg border border-border">
                        <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        No broadcasts sent yet
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {sentNotifications.map(n => (
                          <Card key={n.id} className="p-4 bg-card border-border">
                            <div className="flex items-start gap-3">
                              <span
                                className="h-6 w-6 rounded-full shrink-0 mt-0.5 border border-white/20 shadow-sm"
                                style={{ backgroundColor: n.color || (n.type === 'info' ? '#3b82f6' : n.type === 'warning' ? '#f59e0b' : n.type === 'success' ? '#10b981' : '#ef4444') }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                  <p className="font-semibold text-card-foreground">{n.title}</p>
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(n.createdAt).toLocaleString()}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                                <p className="text-[10px] text-muted-foreground mt-2 border-t border-border pt-2">
                                  Sent by Admin ID: {n.sentBy}
                                </p>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "settings" && (
              <div className="space-y-6">
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Platform Settings</h2>
                  <p className="text-muted-foreground text-sm flex items-center gap-2">
                    <Activity className="h-3 w-3" /> Manage global configurations and transaction fees
                  </p>
                </div>

                <div className="grid gap-6 max-w-2xl">
                  <Card className="bg-card/50 border-border/50 backdrop-blur-md shadow-xl overflow-hidden rounded-2xl border">
                    <CardHeader className="bg-secondary/20 border-b border-border/50 py-5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-bold">Verification System</CardTitle>
                          <p className="text-xs text-muted-foreground">Configure verification badge costs</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="space-y-3">
                        <label className="text-sm font-semibold text-foreground/80 block">Verification Fee (INR)</label>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <IndianRupee className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          </div>
                          <Input
                            type="number"
                            className="pl-10 h-12 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 rounded-xl transition-all"
                            value={systemSettings.verification_fee}
                            onChange={(e) => setSystemSettings(prev => ({ ...prev, verification_fee: e.target.value }))}
                            placeholder="e.g. 600"
                          />
                        </div>
                        <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
                          <p className="text-xs text-primary/80 leading-relaxed italic">
                            💡 This fee is charged one-time when a user applies for a Blue Verification Badge.
                          </p>
                        </div>
                      </div>

                      <Button
                        onClick={handleSaveSettings}
                        className="w-full h-11 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all font-semibold"
                        disabled={isSavingSettings}
                      >
                        {isSavingSettings ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving Settings...
                          </>
                        ) : (
                          "Update Settings"
                        )
                        }
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      </div >
    </div >
  );
};

export default AdminDashboard;
