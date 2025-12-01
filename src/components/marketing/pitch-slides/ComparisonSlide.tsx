import { Check, X, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const comparisons = [
  {
    capability: 'Automated Call Analysis',
    manual: false,
    genericCRM: false,
    ourPlatform: true,
  },
  {
    capability: 'AI-Generated Notes & Emails',
    manual: false,
    genericCRM: false,
    ourPlatform: true,
  },
  {
    capability: 'Multi-Framework Scoring',
    manual: 'partial',
    genericCRM: false,
    ourPlatform: true,
  },
  {
    capability: 'Real-Time Sales Coaching',
    manual: 'partial',
    genericCRM: false,
    ourPlatform: true,
  },
  {
    capability: 'Trend Analysis Over Time',
    manual: false,
    genericCRM: 'partial',
    ourPlatform: true,
  },
  {
    capability: 'Stakeholder Intelligence',
    manual: 'partial',
    genericCRM: 'partial',
    ourPlatform: true,
  },
  {
    capability: 'Automated Follow-up Generation',
    manual: false,
    genericCRM: false,
    ourPlatform: true,
  },
  {
    capability: 'Performance Alerts',
    manual: false,
    genericCRM: 'partial',
    ourPlatform: true,
  },
];

function StatusIcon({ status }: { status: boolean | string }) {
  if (status === true) {
    return <Check className="h-5 w-5 text-green-500" />;
  }
  if (status === 'partial') {
    return <Minus className="h-5 w-5 text-amber-500" />;
  }
  return <X className="h-5 w-5 text-red-500" />;
}

export function ComparisonSlide() {
  return (
    <div className="flex flex-col h-full px-8 py-6">
      <div className="text-center mb-6">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">Why This Approach</h2>
        <p className="text-muted-foreground text-lg">
          Comparing capabilities vs. alternatives
        </p>
      </div>
      
      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-semibold">Capability</th>
                  <th className="text-center p-4 font-semibold">Manual Process</th>
                  <th className="text-center p-4 font-semibold">Generic CRM</th>
                  <th className="text-center p-4 font-semibold bg-primary/10">Our Platform</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((row, index) => (
                  <tr key={index} className="border-b last:border-0">
                    <td className="p-4 text-sm">{row.capability}</td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center">
                        <StatusIcon status={row.manual} />
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center">
                        <StatusIcon status={row.genericCRM} />
                      </div>
                    </td>
                    <td className="p-4 text-center bg-primary/5">
                      <div className="flex justify-center">
                        <StatusIcon status={row.ourPlatform} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      <div className="mt-4 flex justify-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-green-500" />
          <span>Full Support</span>
        </div>
        <div className="flex items-center gap-2">
          <Minus className="h-4 w-4 text-amber-500" />
          <span>Partial/Manual</span>
        </div>
        <div className="flex items-center gap-2">
          <X className="h-4 w-4 text-red-500" />
          <span>Not Available</span>
        </div>
      </div>
    </div>
  );
}
