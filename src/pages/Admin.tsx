import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Users, Calendar, CheckCircle2, Baby } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivityRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  city: string | null;
  state: string | null;
  onboarding_completed: boolean;
  signed_up_at: string;
  last_sign_in_at: string | null;
  child_count: number;
  event_count: number;
  completed_event_count: number;
  last_event_created_at: string | null;
  is_admin: boolean;
}

export default function Admin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin");
      const admin = !!(roleRows && roleRows.length > 0);
      setIsAdmin(admin);
      if (!admin) { setLoading(false); return; }

      const { data, error } = await supabase.rpc("admin_get_user_activity");
      if (!error && data) setRows(data as ActivityRow[]);
      setLoading(false);
    })();
  }, [user]);

  if (isAdmin === null || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/" replace />;

  const totalUsers = rows.length;
  const onboarded = rows.filter((r) => r.onboarding_completed).length;
  const totalEvents = rows.reduce((s, r) => s + Number(r.event_count), 0);
  const totalCompleted = rows.reduce((s, r) => s + Number(r.completed_event_count), 0);
  const activeWeek = rows.filter((r) => {
    const d = r.last_event_created_at ? new Date(r.last_event_created_at) : null;
    return d && Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link to="/" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to dashboard
            </Link>
            <h1 className="text-3xl font-bold mt-2">Admin · Users & activity</h1>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Users className="h-4 w-4" />} label="Total users" value={totalUsers} />
          <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Onboarded" value={`${onboarded}/${totalUsers}`} />
          <StatCard icon={<Calendar className="h-4 w-4" />} label="Active (7d)" value={activeWeek} />
          <StatCard icon={<Baby className="h-4 w-4" />} label="Events / done" value={`${totalEvents} / ${totalCompleted}`} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Users ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Signed up</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  <TableHead className="text-right">Kids</TableHead>
                  <TableHead className="text-right">Events</TableHead>
                  <TableHead className="text-right">Done</TableHead>
                  <TableHead>Last activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.user_id}>
                    <TableCell>
                      <div className="font-medium flex items-center gap-2">
                        {r.display_name || "—"}
                        {r.is_admin && <Badge variant="secondary" className="text-xs">admin</Badge>}
                        {!r.onboarding_completed && <Badge variant="outline" className="text-xs">pending</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {[r.city, r.state].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDistanceToNow(new Date(r.signed_up_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {r.last_sign_in_at ? formatDistanceToNow(new Date(r.last_sign_in_at), { addSuffix: true }) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{r.child_count}</TableCell>
                    <TableCell className="text-right">{r.event_count}</TableCell>
                    <TableCell className="text-right">{r.completed_event_count}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {r.last_event_created_at ? formatDistanceToNow(new Date(r.last_event_created_at), { addSuffix: true }) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No users yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">{icon}{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
