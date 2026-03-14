import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { 
  Search, MapPin, DollarSign, Star, CheckCircle, Filter,
  Loader2, MessageSquare, X, Send, UserPlus
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

import { TieredAvatar } from "@/components/freelancer/TieredAvatar";
import type { FreelancerTier } from "@/components/freelancer/TierBadge";

interface Freelancer {
  id: string;
  user_id: string;
  full_name: string | null;
  title: string | null;
  bio: string | null;
  hourly_rate: number | null;
  location: string | null;
  skills: string[] | null;
  languages: string[] | null;
  avatar_url: string | null;
  verified: boolean | null;
  tier?: FreelancerTier | null;
}

const SKILL_CATEGORIES = [
  "React", "Node.js", "Python", "TypeScript", "JavaScript",
  "UI/UX Design", "Figma", "Mobile Development", "AWS",
  "Data Science", "Machine Learning", "DevOps", "WordPress",
  "SEO", "Content Writing", "Video Editing", "Marketing"
];

interface Project {
  id: string;
  title: string;
  status: string;
}

export default function TalentPool() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Invite modal state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedFreelancer, setSelectedFreelancer] = useState<Freelancer | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  
  // Filters
  const [rateRange, setRateRange] = useState([0, 200]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [locationFilter, setLocationFilter] = useState("");

  useEffect(() => {
    fetchFreelancers();
    if (user) {
      fetchProjects();
    }
  }, [user]);

  const fetchFreelancers = async () => {
    const { data, error } = await supabase
      .from("freelancer_profiles")
      .select("*")
      .order("verified", { ascending: false });

    if (!error && data) {
      setFreelancers(data.map((f: any) => ({
        ...f,
        tier: (f.tier as FreelancerTier) || "standard",
      })));
    }
    setLoading(false);
  };

  const fetchProjects = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("projects")
      .select("id, title, status")
      .eq("company_user_id", user.id)
      .in("status", ["open", "in_progress"]);
    
    if (data) {
      setProjects(data);
    }
  };

  const filteredFreelancers = freelancers.filter((freelancer) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = freelancer.full_name?.toLowerCase().includes(query);
      const matchesTitle = freelancer.title?.toLowerCase().includes(query);
      const matchesSkills = freelancer.skills?.some(s => s.toLowerCase().includes(query));
      if (!matchesName && !matchesTitle && !matchesSkills) return false;
    }

    // Rate filter
    if (freelancer.hourly_rate) {
      if (freelancer.hourly_rate < rateRange[0] || freelancer.hourly_rate > rateRange[1]) {
        return false;
      }
    }

    // Skills filter
    if (selectedSkills.length > 0) {
      const hasMatchingSkill = selectedSkills.some(skill => 
        freelancer.skills?.some(s => s.toLowerCase().includes(skill.toLowerCase()))
      );
      if (!hasMatchingSkill) return false;
    }

    // Verified filter
    if (verifiedOnly && !freelancer.verified) return false;

    // Location filter
    if (locationFilter && !freelancer.location?.toLowerCase().includes(locationFilter.toLowerCase())) {
      return false;
    }

    return true;
  });

  const handleStartConversation = async (freelancerUserId: string) => {
    if (!user) return;

    // Check for existing conversation
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("company_user_id", user.id)
      .eq("freelancer_user_id", freelancerUserId)
      .maybeSingle();

    if (existing) {
      navigate(`/messages?conversation=${existing.id}`);
    } else {
      // Create new conversation
      const { data: newConv, error } = await supabase
        .from("conversations")
        .insert({
          company_user_id: user.id,
          freelancer_user_id: freelancerUserId,
        })
        .select()
        .single();

      if (!error && newConv) {
        navigate(`/messages?conversation=${newConv.id}`);
      }
    }
  };

  const openInviteModal = (freelancer: Freelancer) => {
    if (projects.length === 0) {
      toast.error(t("talentPool.noProjectsToInvite"));
      return;
    }
    setSelectedFreelancer(freelancer);
    setSelectedProjectId("");
    setInviteMessage("");
    setInviteModalOpen(true);
  };

  const handleSendInvite = async () => {
    if (!user || !selectedFreelancer || !selectedProjectId) return;
    
    setSendingInvite(true);
    
    // Check for existing pending invite
    const { data: existing } = await supabase
      .from("project_invites")
      .select("id")
      .eq("project_id", selectedProjectId)
      .eq("freelancer_user_id", selectedFreelancer.user_id)
      .eq("status", "pending")
      .maybeSingle();
    
    if (existing) {
      toast.error(t("talentPool.inviteAlreadySent"));
      setSendingInvite(false);
      return;
    }
    
    // Create invite
    const { error } = await supabase
      .from("project_invites")
      .insert({
        project_id: selectedProjectId,
        company_user_id: user.id,
        freelancer_user_id: selectedFreelancer.user_id,
        message: inviteMessage || null,
      });
    
    if (error) {
      console.error("Invite error:", error);
      toast.error(t("common.error"));
    } else {
      // Send notification to freelancer
      const project = projects.find(p => p.id === selectedProjectId);
      await supabase.from("notifications").insert({
        user_id: selectedFreelancer.user_id,
        type: "project_invite",
        message: t("talentPool.inviteNotification", { project: project?.title }),
        link: "/invites",
      });
      
      toast.success(t("talentPool.inviteSent"));
      setInviteModalOpen(false);
    }
    
    setSendingInvite(false);
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev => 
      prev.includes(skill) 
        ? prev.filter(s => s !== skill)
        : [...prev, skill]
    );
  };

  const clearFilters = () => {
    setRateRange([0, 200]);
    setSelectedSkills([]);
    setVerifiedOnly(false);
    setLocationFilter("");
    setSearchQuery("");
  };

  const activeFiltersCount = 
    (rateRange[0] > 0 || rateRange[1] < 200 ? 1 : 0) +
    selectedSkills.length +
    (verifiedOnly ? 1 : 0) +
    (locationFilter ? 1 : 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("talentPool.title")}</h1>
        <p className="text-muted-foreground">{t("talentPool.subtitle")}</p>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("talentPool.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              {t("common.filter")}
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{t("talentPool.filters")}</SheetTitle>
              <SheetDescription>{t("talentPool.filtersDesc")}</SheetDescription>
            </SheetHeader>
            
            <div className="space-y-6 mt-6">
              {/* Hourly Rate */}
              <div className="space-y-3">
                <Label>{t("talentPool.hourlyRate")}: ${rateRange[0]} - ${rateRange[1]}</Label>
                <Slider
                  value={rateRange}
                  onValueChange={setRateRange}
                  min={0}
                  max={200}
                  step={10}
                  className="py-4"
                />
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label>{t("talentPool.location")}</Label>
                <Input
                  placeholder={t("talentPool.locationPlaceholder")}
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                />
              </div>

              {/* Verified Only */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="verified"
                  checked={verifiedOnly}
                  onCheckedChange={(checked) => setVerifiedOnly(checked as boolean)}
                />
                <Label htmlFor="verified" className="flex items-center gap-2 cursor-pointer">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  {t("talentPool.verifiedOnly")}
                </Label>
              </div>

              {/* Skills */}
              <div className="space-y-3">
                <Label>{t("talentPool.skills")}</Label>
                <div className="flex flex-wrap gap-2">
                  {SKILL_CATEGORIES.map((skill) => (
                    <Badge
                      key={skill}
                      variant={selectedSkills.includes(skill) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleSkill(skill)}
                    >
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>

              {activeFiltersCount > 0 && (
                <Button variant="ghost" onClick={clearFilters} className="w-full gap-2">
                  <X className="h-4 w-4" />
                  {t("talentPool.clearFilters")}
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Selected Skills Pills */}
      {selectedSkills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedSkills.map((skill) => (
            <Badge key={skill} variant="secondary" className="gap-1">
              {skill}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => toggleSkill(skill)}
              />
            </Badge>
          ))}
        </div>
      )}

      {/* Results Count */}
      <p className="text-sm text-muted-foreground">
        {filteredFreelancers.length} {t("talentPool.freelancersFound")}
      </p>

      {/* Freelancers Grid */}
      {filteredFreelancers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-semibold mb-2">{t("talentPool.noResults")}</h3>
            <p className="text-muted-foreground">{t("talentPool.noResultsDesc")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredFreelancers.map((freelancer) => (
            <Card key={freelancer.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <TieredAvatar
                    avatarUrl={freelancer.avatar_url}
                    name={freelancer.full_name}
                    tier={freelancer.tier}
                    size="lg"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">
                        {freelancer.full_name || t("talentPool.unnamed")}
                      </h3>
                      {freelancer.verified && (
                        <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {freelancer.title}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                  {freelancer.hourly_rate && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      ${freelancer.hourly_rate}/hr
                    </span>
                  )}
                  {freelancer.location && (
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {freelancer.location}
                    </span>
                  )}
                </div>

                {freelancer.skills && freelancer.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {freelancer.skills.slice(0, 4).map((skill, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {freelancer.skills.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{freelancer.skills.length - 4}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => navigate(`/freelancers/${freelancer.user_id}`)}
                  >
                    {t("talentPool.viewProfile")}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="gap-1"
                    onClick={() => openInviteModal(freelancer)}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    className="gap-1"
                    onClick={() => handleStartConversation(freelancer.user_id)}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Invite Modal */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("talentPool.inviteTitle")}</DialogTitle>
            <DialogDescription>
              {t("talentPool.inviteDescription", { name: selectedFreelancer?.full_name || t("talentPool.unnamed") })}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("talentPool.selectProject")}</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("talentPool.selectProjectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>{t("talentPool.inviteMessageLabel")}</Label>
              <Textarea
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                placeholder={t("talentPool.inviteMessagePlaceholder")}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button 
              onClick={handleSendInvite} 
              disabled={!selectedProjectId || sendingInvite}
              className="gap-2"
            >
              {sendingInvite ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {t("talentPool.sendInvite")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
