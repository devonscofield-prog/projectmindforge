import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Mail } from 'lucide-react';
import { OnDemandReportGenerator } from '@/components/reporting/OnDemandReportGenerator';
import { DailyReportSettings } from '@/components/settings/DailyReportSettings';

export default function AdminReporting() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Reporting</h1>
          <p className="text-muted-foreground mt-1">Generate on-demand reports and manage daily email settings</p>
        </div>

        <Tabs defaultValue="on-demand" className="space-y-6">
          <TabsList>
            <TabsTrigger value="on-demand" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              On-Demand Reports
            </TabsTrigger>
            <TabsTrigger value="daily-email" className="gap-2">
              <Mail className="h-4 w-4" />
              Daily Email
            </TabsTrigger>
          </TabsList>

          <TabsContent value="on-demand">
            <OnDemandReportGenerator />
          </TabsContent>

          <TabsContent value="daily-email">
            <DailyReportSettings />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
