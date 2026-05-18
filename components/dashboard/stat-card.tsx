import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardStatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: ReactNode;
}

export function DashboardStatCard({ title, value, description, icon }: DashboardStatCardProps) {
  return (
    <Card className="bg-white border border-slate-200 shadow-sm shadow-slate-200/50">
      <CardHeader className="flex items-center justify-between gap-2">
        <CardTitle className="text-sm font-semibold text-slate-700">{title}</CardTitle>
        <div className="text-slate-500">{icon}</div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-3xl font-semibold text-slate-950">{value}</p>
        <p className="text-sm text-slate-500">{description}</p>
      </CardContent>
    </Card>
  );
}
