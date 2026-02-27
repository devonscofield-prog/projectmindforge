import { AppLayout } from '@/components/layout/AppLayout';
import { OpportunityEnrichment } from '@/components/admin/OpportunityEnrichment';

export default function AdminOpportunityEnrichment() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Opportunity Enrichment</h1>
          <p className="text-muted-foreground mt-1">
            Upload a Salesforce Opportunities CSV to enrich it with your platform intelligence
          </p>
        </div>
        <OpportunityEnrichment />
      </div>
    </AppLayout>
  );
}
