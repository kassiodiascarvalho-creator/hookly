import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2, Trash2, Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileDataCard, MobileDataRow } from "@/components/admin/MobileDataCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Lead {
  id: string;
  email: string;
  source: string | null;
  user_type: string | null;
  created_at: string;
}

export default function AdminLeads() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteLead = async (id: string) => {
    try {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
      setLeads((prev) => prev.filter((l) => l.id !== id));
      toast.success(t("admin.leadDeleted"));
    } catch (error) {
      console.error("Error deleting lead:", error);
      toast.error(t("admin.errorDeleting"));
    }
  };

  const exportLeads = (exportAll: boolean) => {
    const dataToExport = exportAll ? leads : filteredLeads;
    
    const csvContent = [
      ["Email", "Source", "Type", "Created At"],
      ...dataToExport.map((lead) => [
        lead.email,
        lead.source || "",
        lead.user_type || "",
        format(new Date(lead.created_at), "yyyy-MM-dd HH:mm:ss"),
      ]),
    ]
      .map((row) => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${exportAll ? 'all' : 'filtered'}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success(t("admin.leadsExported"));
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch = 
      lead.email.toLowerCase().includes(search.toLowerCase()) ||
      lead.source?.toLowerCase().includes(search.toLowerCase());
    
    const matchesType = typeFilter === "all" || lead.user_type === typeFilter || 
      (typeFilter === "unknown" && !lead.user_type);
    
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">{t("admin.leads")}</h1>
        <p className="text-sm md:text-base text-muted-foreground">{t("admin.leadsDescription")}</p>
      </div>

      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg md:text-xl">{t("admin.allLeads")} ({leads.length})</CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size={isMobile ? "sm" : "default"}>
                    <Download className="h-4 w-4 mr-2" />
                    {!isMobile && t("admin.exportCsv")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => exportLeads(true)}>
                    {t("admin.exportAll")} ({leads.length})
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportLeads(false)}>
                    {t("admin.exportFiltered")} ({filteredLeads.length})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder={t("admin.filterByType")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.allTypes")}</SelectItem>
                  <SelectItem value="company">{t("admin.companies")}</SelectItem>
                  <SelectItem value="freelancer">{t("admin.freelancers")}</SelectItem>
                  <SelectItem value="unknown">{t("admin.unknown")}</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("admin.searchLeads")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : isMobile ? (
            // Mobile view - card layout
            <div className="space-y-3">
              {filteredLeads.map((lead) => (
                <MobileDataCard key={lead.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-sm break-all flex-1">{lead.email}</div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("admin.confirmDelete")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("admin.confirmDeleteLead")}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteLead(lead.id)}>
                            {t("common.delete")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {lead.source && (
                      <Badge variant="outline">{lead.source}</Badge>
                    )}
                    {lead.user_type && (
                      <Badge variant={lead.user_type === 'company' ? 'default' : 'secondary'}>
                        {lead.user_type === 'company' ? t("admin.company") : t("admin.freelancer")}
                      </Badge>
                    )}
                  </div>
                  <MobileDataRow label={t("admin.createdAt")}>
                    {format(new Date(lead.created_at), "PP")}
                  </MobileDataRow>
                </MobileDataCard>
              ))}
              {filteredLeads.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  {t("admin.noLeadsFound")}
                </div>
              )}
            </div>
          ) : (
            // Desktop view - table
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.email")}</TableHead>
                  <TableHead>{t("admin.source")}</TableHead>
                  <TableHead>{t("admin.type")}</TableHead>
                  <TableHead>{t("admin.createdAt")}</TableHead>
                  <TableHead>{t("admin.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.email}</TableCell>
                    <TableCell>
                      {lead.source ? (
                        <Badge variant="outline">{lead.source}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {lead.user_type ? (
                        <Badge variant={lead.user_type === 'company' ? 'default' : 'secondary'}>
                          {lead.user_type === 'company' ? t("admin.company") : t("admin.freelancer")}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(lead.created_at), "PPp")}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("admin.confirmDelete")}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("admin.confirmDeleteLead")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteLead(lead.id)}>
                              {t("common.delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredLeads.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {t("admin.noLeadsFound")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
