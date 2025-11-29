import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import html2pdf from "html2pdf.js";

const OutlookIntegrationPlan = () => {
  const [isExporting, setIsExporting] = useState(false);
  const navigate = useNavigate();

  const handleExportPdf = async () => {
    setIsExporting(true);
    const element = document.getElementById("plan-content");
    if (!element) return;

    const opt = {
      margin: [0.5, 0.5, 0.5, 0.5],
      filename: "Outlook-Integration-IT-Plan.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
    };

    try {
      await html2pdf().set(opt).from(element).save();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button onClick={handleExportPdf} disabled={isExporting}>
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? "Generating PDF..." : "Download PDF"}
          </Button>
        </div>
      </div>

      {/* Document Content */}
      <div id="plan-content" className="max-w-4xl mx-auto p-8 bg-background text-foreground">
        {/* Title Page */}
        <div className="text-center mb-12 pb-8 border-b border-border">
          <div className="flex items-center justify-center gap-2 mb-4">
            <FileText className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Manual Outlook Email Sync
          </h1>
          <h2 className="text-xl text-muted-foreground mb-4">
            IT Security & Implementation Plan
          </h2>
          <p className="text-sm text-muted-foreground">
            StormWind Sales Hub • {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Executive Summary */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
            1. Executive Summary
          </h2>
          
          <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Purpose</h3>
          <p className="text-muted-foreground mb-4">
            Enable sales representatives to manually sync email correspondence from Microsoft Outlook 
            into StormWind Sales Hub for improved prospect tracking and communication history visibility.
          </p>

          <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Integration Type</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 mb-4">
            <li><strong>Manual, on-demand sync</strong> - Users explicitly trigger email import</li>
            <li><strong>Read-only access</strong> - Application cannot send, modify, or delete emails</li>
            <li><strong>User-initiated authentication</strong> - Each user authenticates with their own Microsoft account</li>
            <li><strong>Scoped data retrieval</strong> - Only emails matching specific prospect criteria are imported</li>
          </ul>

          <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Business Benefits</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Reduced manual data entry for sales team</li>
            <li>Complete communication history in one location</li>
            <li>Better visibility into prospect engagement</li>
            <li>Improved coaching and pipeline analysis</li>
          </ul>
        </section>

        {/* Technical Architecture */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
            2. Technical Architecture
          </h2>

          <h3 className="text-lg font-medium text-foreground mt-4 mb-2">System Overview</h3>
          <p className="text-muted-foreground mb-4">
            The integration follows a user-initiated, server-mediated architecture where all Microsoft 
            Graph API calls are made from secure backend functions, never directly from the browser.
          </p>

          <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Data Flow</h3>
          <div className="bg-muted/50 rounded-lg p-4 mb-4 font-mono text-sm">
            <p className="text-muted-foreground">1. User clicks "Sync Outlook Emails" button</p>
            <p className="text-muted-foreground">2. If not connected: OAuth flow initiates → User grants permission</p>
            <p className="text-muted-foreground">3. Frontend calls backend Edge Function with prospect context</p>
            <p className="text-muted-foreground">4. Edge Function uses stored tokens to query Microsoft Graph API</p>
            <p className="text-muted-foreground">5. Emails matching prospect criteria are filtered and processed</p>
            <p className="text-muted-foreground">6. Metadata extracted and stored in database</p>
            <p className="text-muted-foreground">7. Results returned to user</p>
          </div>

          <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Key Security Design Decisions</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li><strong>Server-side API calls:</strong> Microsoft Graph API is never called from browser</li>
            <li><strong>Per-user authentication:</strong> Each user authenticates independently</li>
            <li><strong>Scoped queries:</strong> Only emails matching prospect email addresses are retrieved</li>
            <li><strong>Minimal data storage:</strong> Only necessary metadata is persisted</li>
          </ul>
        </section>

        {/* Azure Permissions */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
            3. Microsoft Azure Permissions Required
          </h2>

          <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Delegated Permissions (Per-User Consent)</h3>
          <div className="overflow-x-auto mb-4">
            <table className="w-full border border-border rounded-lg overflow-hidden">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Permission</th>
                  <th className="text-left p-3 font-medium text-foreground">Type</th>
                  <th className="text-left p-3 font-medium text-foreground">Purpose</th>
                  <th className="text-left p-3 font-medium text-foreground">Admin Consent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="p-3 text-muted-foreground font-mono">Mail.Read</td>
                  <td className="p-3 text-muted-foreground">Delegated</td>
                  <td className="p-3 text-muted-foreground">Read user's mailbox (emails only)</td>
                  <td className="p-3 text-muted-foreground">No*</td>
                </tr>
                <tr>
                  <td className="p-3 text-muted-foreground font-mono">offline_access</td>
                  <td className="p-3 text-muted-foreground">Delegated</td>
                  <td className="p-3 text-muted-foreground">Maintain access via refresh tokens</td>
                  <td className="p-3 text-muted-foreground">No</td>
                </tr>
                <tr>
                  <td className="p-3 text-muted-foreground font-mono">User.Read</td>
                  <td className="p-3 text-muted-foreground">Delegated</td>
                  <td className="p-3 text-muted-foreground">Read basic profile (email, name)</td>
                  <td className="p-3 text-muted-foreground">No</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            *Standard configuration; organizational policies may require admin consent for Mail.Read
          </p>

          <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Permissions NOT Requested</h3>
          <div className="overflow-x-auto mb-4">
            <table className="w-full border border-border rounded-lg overflow-hidden">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Permission</th>
                  <th className="text-left p-3 font-medium text-foreground">Why Not Needed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="p-3 text-muted-foreground font-mono">Mail.ReadWrite</td>
                  <td className="p-3 text-muted-foreground">We never modify emails</td>
                </tr>
                <tr>
                  <td className="p-3 text-muted-foreground font-mono">Mail.Send</td>
                  <td className="p-3 text-muted-foreground">We never send emails on behalf of users</td>
                </tr>
                <tr>
                  <td className="p-3 text-muted-foreground font-mono">Calendars.*</td>
                  <td className="p-3 text-muted-foreground">No calendar integration</td>
                </tr>
                <tr>
                  <td className="p-3 text-muted-foreground font-mono">Contacts.*</td>
                  <td className="p-3 text-muted-foreground">No contacts sync</td>
                </tr>
                <tr>
                  <td className="p-3 text-muted-foreground font-mono">Files.*</td>
                  <td className="p-3 text-muted-foreground">No OneDrive access</td>
                </tr>
                <tr>
                  <td className="p-3 text-muted-foreground font-mono">Mail.Read (Application)</td>
                  <td className="p-3 text-muted-foreground">No organization-wide access</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Azure App Registration Configuration</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li><strong>Application type:</strong> Web application</li>
            <li><strong>Supported account types:</strong> Single tenant (your organization only) OR Multi-tenant</li>
            <li><strong>Redirect URI:</strong> Backend Edge Function URL</li>
            <li><strong>Token configuration:</strong> Access tokens + Refresh tokens enabled</li>
            <li><strong>Client credentials:</strong> Client secret (stored securely in Lovable Cloud secrets)</li>
          </ul>
        </section>

        {/* Data Handling */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
            4. Data Handling Practices
          </h2>

          <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Data Collected</h3>
          <div className="overflow-x-auto mb-4">
            <table className="w-full border border-border rounded-lg overflow-hidden">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Field</th>
                  <th className="text-left p-3 font-medium text-foreground">Purpose</th>
                  <th className="text-left p-3 font-medium text-foreground">Sensitivity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="p-3 text-muted-foreground">Email Subject</td>
                  <td className="p-3 text-muted-foreground">Display in activity timeline</td>
                  <td className="p-3 text-muted-foreground">Low-Medium</td>
                </tr>
                <tr>
                  <td className="p-3 text-muted-foreground">Date/Time</td>
                  <td className="p-3 text-muted-foreground">Chronological ordering</td>
                  <td className="p-3 text-muted-foreground">Low</td>
                </tr>
                <tr>
                  <td className="p-3 text-muted-foreground">Direction (sent/received)</td>
                  <td className="p-3 text-muted-foreground">Communication flow analysis</td>
                  <td className="p-3 text-muted-foreground">Low</td>
                </tr>
                <tr>
                  <td className="p-3 text-muted-foreground">Sender/Recipient Email</td>
                  <td className="p-3 text-muted-foreground">Link to stakeholder records</td>
                  <td className="p-3 text-muted-foreground">Medium</td>
                </tr>
                <tr>
                  <td className="p-3 text-muted-foreground">Outlook Message ID</td>
                  <td className="p-3 text-muted-foreground">Deduplication</td>
                  <td className="p-3 text-muted-foreground">Low</td>
                </tr>
                <tr>
                  <td className="p-3 text-muted-foreground">Email Body (Optional)</td>
                  <td className="p-3 text-muted-foreground">Full context reference</td>
                  <td className="p-3 text-muted-foreground">High</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Data NOT Collected</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 mb-4">
            <li>Emails not matching prospect/stakeholder email addresses</li>
            <li>Email attachments</li>
            <li>Calendar events</li>
            <li>Contact information beyond what's in emails</li>
            <li>Draft emails</li>
          </ul>

          <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Data Retention</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 mb-4">
            <li>Email logs retained as long as the associated prospect record exists</li>
            <li>OAuth tokens refreshed automatically; revoked on user disconnect</li>
            <li>No email content cached beyond immediate processing</li>
          </ul>

          <h3 className="text-lg font-medium text-foreground mt-4 mb-2">User Control</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Users can disconnect Outlook at any time</li>
            <li>Users can delete individual email logs</li>
            <li>Users can request full data export/deletion</li>
          </ul>
        </section>

        {/* Security Measures */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
            5. Security Measures
          </h2>

          <h3 className="text-lg font-medium text-foreground mt-4 mb-2">5.1 Authentication & Authorization</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 mb-4">
            <li><strong>OAuth 2.0 with PKCE:</strong> Industry-standard secure authorization flow</li>
            <li><strong>Token encryption:</strong> Access/refresh tokens encrypted at rest in database</li>
            <li><strong>Row-Level Security (RLS):</strong> Users can only access their own tokens and email logs</li>
            <li><strong>Token rotation:</strong> Refresh tokens used to obtain new access tokens; old tokens invalidated</li>
          </ul>

          <h3 className="text-lg font-medium text-foreground mt-4 mb-2">5.2 Data Protection</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 mb-4">
            <li><strong>Transport security:</strong> All API calls over HTTPS/TLS 1.2+</li>
            <li><strong>Database encryption:</strong> Data encrypted at rest (AES-256)</li>
            <li><strong>Minimal data principle:</strong> Only necessary fields stored</li>
            <li><strong>No client-side token storage:</strong> Tokens never exposed to browser</li>
          </ul>

          <h3 className="text-lg font-medium text-foreground mt-4 mb-2">5.3 Access Controls</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 mb-4">
            <li><strong>Per-user authentication:</strong> No shared credentials or service accounts</li>
            <li><strong>Audit logging:</strong> All sync operations logged with timestamps</li>
            <li><strong>Rate limiting:</strong> Prevent abuse via request throttling</li>
            <li><strong>Session management:</strong> Automatic token refresh; manual disconnect available</li>
          </ul>

          <h3 className="text-lg font-medium text-foreground mt-4 mb-2">5.4 Incident Response</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Immediate token revocation capability</li>
            <li>Audit trail for forensic analysis</li>
            <li>User notification process for security events</li>
          </ul>
        </section>

        {/* Implementation Phases */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
            6. Implementation Phases
          </h2>

          <div className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-4">
              <h3 className="font-medium text-foreground mb-2">Phase 1: Azure App Registration</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
                <li>Register application in Azure AD</li>
                <li>Configure delegated permissions</li>
                <li>Set up redirect URIs</li>
                <li>Generate and secure client secret</li>
              </ul>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <h3 className="font-medium text-foreground mb-2">Phase 2: Backend Development</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
                <li>Create database tables for token storage</li>
                <li>Implement OAuth callback Edge Function</li>
                <li>Build email sync Edge Function</li>
                <li>Add token refresh logic</li>
              </ul>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <h3 className="font-medium text-foreground mb-2">Phase 3: Frontend Integration</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
                <li>Add "Connect Outlook" button</li>
                <li>Build sync trigger UI</li>
                <li>Display imported emails in timeline</li>
                <li>Add disconnect functionality</li>
              </ul>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <h3 className="font-medium text-foreground mb-2">Phase 4: Testing & Validation</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
                <li>Security testing (penetration testing if required)</li>
                <li>User acceptance testing</li>
                <li>Performance testing under load</li>
                <li>Error handling validation</li>
              </ul>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <h3 className="font-medium text-foreground mb-2">Phase 5: Rollout</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
                <li>Limited pilot with select users</li>
                <li>Documentation and training</li>
                <li>Gradual rollout to full team</li>
                <li>Monitoring and support</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Risk Assessment */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
            7. Risk Assessment
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full border border-border rounded-lg overflow-hidden">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Risk</th>
                  <th className="text-left p-3 font-medium text-foreground">Likelihood</th>
                  <th className="text-left p-3 font-medium text-foreground">Impact</th>
                  <th className="text-left p-3 font-medium text-foreground">Mitigation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="p-3 text-muted-foreground">OAuth token theft</td>
                  <td className="p-3 text-muted-foreground">Low</td>
                  <td className="p-3 text-muted-foreground">High</td>
                  <td className="p-3 text-muted-foreground">Encryption at rest, server-side only, RLS</td>
                </tr>
                <tr>
                  <td className="p-3 text-muted-foreground">Over-collection of data</td>
                  <td className="p-3 text-muted-foreground">Low</td>
                  <td className="p-3 text-muted-foreground">Medium</td>
                  <td className="p-3 text-muted-foreground">Strict filtering by prospect emails only</td>
                </tr>
                <tr>
                  <td className="p-3 text-muted-foreground">Compliance violation</td>
                  <td className="p-3 text-muted-foreground">Low</td>
                  <td className="p-3 text-muted-foreground">High</td>
                  <td className="p-3 text-muted-foreground">Legal review, data minimization, user consent</td>
                </tr>
                <tr>
                  <td className="p-3 text-muted-foreground">Service disruption</td>
                  <td className="p-3 text-muted-foreground">Medium</td>
                  <td className="p-3 text-muted-foreground">Low</td>
                  <td className="p-3 text-muted-foreground">Graceful degradation, manual fallback</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Compliance */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
            8. Compliance Considerations
          </h2>

          <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Questions for Legal/Compliance Teams</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 mb-4">
            <li>Does storing email metadata require updates to privacy policy?</li>
            <li>Are there data residency requirements for email content?</li>
            <li>What retention periods apply to communication logs?</li>
            <li>Do external contacts need notification of data processing?</li>
            <li>What is the process for right-to-deletion requests?</li>
          </ul>

          <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Relevant Frameworks</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li><strong>GDPR:</strong> If processing EU resident data</li>
            <li><strong>CCPA:</strong> If processing California resident data</li>
            <li><strong>HIPAA:</strong> If any healthcare-related communications</li>
            <li><strong>SOC 2:</strong> General security controls alignment</li>
          </ul>
        </section>

        {/* Summary */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
            9. Summary for IT Director
          </h2>

          <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
            <h3 className="text-lg font-medium text-foreground mb-4">Request</h3>
            <p className="text-muted-foreground mb-4">
              Register an Azure AD application with <strong>Mail.Read</strong> (delegated), <strong>offline_access</strong>, 
              and <strong>User.Read</strong> permissions for the StormWind Sales Hub application.
            </p>

            <h3 className="text-lg font-medium text-foreground mb-4">What the Application Will Do</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 mb-4">
              <li>Allow individual users to connect their Outlook account</li>
              <li>On user request, read emails matching specific prospect email addresses</li>
              <li>Store email metadata (subject, date, direction) in the sales application</li>
              <li>Display communication history in prospect records</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mb-4">What the Application Will NOT Do</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 mb-4">
              <li>Send emails on behalf of users</li>
              <li>Modify or delete any emails</li>
              <li>Access calendars, contacts, or files</li>
              <li>Access emails continuously (manual trigger only)</li>
              <li>Store email attachments</li>
              <li>Access other users' mailboxes</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mb-4">Security Controls</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>OAuth 2.0 with PKCE</li>
              <li>Tokens encrypted at rest</li>
              <li>Row-level security (per-user data isolation)</li>
              <li>Server-side API calls only</li>
              <li>Audit logging</li>
              <li>User disconnect capability</li>
            </ul>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground pt-8 border-t border-border">
          <p>StormWind Sales Hub • IT Security & Implementation Plan</p>
          <p>Document generated: {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
};

export default OutlookIntegrationPlan;
