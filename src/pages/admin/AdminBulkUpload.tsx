import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb';
import { BulkTranscriptUpload } from '@/components/admin/BulkTranscriptUpload';
import { getAdminPageBreadcrumb } from '@/lib/breadcrumbConfig';
import { withPageErrorBoundary } from '@/components/ui/page-error-boundary';

function AdminBulkUploadPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <PageBreadcrumb items={getAdminPageBreadcrumb('bulkUpload')} />
        
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bulk Upload Transcripts</h1>
          <p className="text-muted-foreground">
            Upload multiple call transcripts at once via ZIP file
          </p>
        </div>

        <BulkTranscriptUpload />
      </div>
    </AppLayout>
  );
}

export default withPageErrorBoundary(AdminBulkUploadPage, 'AdminBulkUpload');
