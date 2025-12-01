import { Check, X, Minus } from 'lucide-react';

const comparisons = [
  {
    feature: 'AI Call Analysis',
    us: 'full',
    manualCoaching: 'none',
    genericCRM: 'partial',
    pointSolutions: 'full',
  },
  {
    feature: 'Sales Methodology Integration',
    us: 'full',
    manualCoaching: 'partial',
    genericCRM: 'none',
    pointSolutions: 'partial',
  },
  {
    feature: 'Real-Time AI Coaching',
    us: 'full',
    manualCoaching: 'none',
    genericCRM: 'none',
    pointSolutions: 'partial',
  },
  {
    feature: 'Trend Analysis',
    us: 'full',
    manualCoaching: 'partial',
    genericCRM: 'partial',
    pointSolutions: 'partial',
  },
  {
    feature: 'Automated Follow-ups',
    us: 'full',
    manualCoaching: 'none',
    genericCRM: 'partial',
    pointSolutions: 'none',
  },
  {
    feature: 'Stakeholder Mapping',
    us: 'full',
    manualCoaching: 'partial',
    genericCRM: 'full',
    pointSolutions: 'none',
  },
  {
    feature: 'Scalable Coaching',
    us: 'full',
    manualCoaching: 'none',
    genericCRM: 'none',
    pointSolutions: 'partial',
  },
];

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'full') return <Check className="h-5 w-5 text-green-500" />;
  if (status === 'partial') return <Minus className="h-5 w-5 text-amber-500" />;
  return <X className="h-5 w-5 text-red-500" />;
};

export function ComparisonSlide() {
  return (
    <div className="flex flex-col h-full px-8 py-6">
      <div className="text-center mb-6">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">Competitive Advantage</h2>
        <p className="text-muted-foreground text-lg">
          The only all-in-one AI sales enablement platform
        </p>
      </div>
      
      <div className="flex-1 overflow-auto">
        <div className="min-w-[600px]">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-semibold">Feature</th>
                <th className="text-center py-3 px-4 font-semibold text-primary">Us</th>
                <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Manual Coaching</th>
                <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Generic CRM</th>
                <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Point Solutions</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((row, index) => (
                <tr key={index} className="border-b hover:bg-muted/50">
                  <td className="py-3 px-4 text-sm">{row.feature}</td>
                  <td className="py-3 px-4 text-center bg-primary/5">
                    <div className="flex justify-center">
                      <StatusIcon status={row.us} />
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex justify-center">
                      <StatusIcon status={row.manualCoaching} />
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex justify-center">
                      <StatusIcon status={row.genericCRM} />
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex justify-center">
                      <StatusIcon status={row.pointSolutions} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="mt-4 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-green-500" />
          <span>Full Support</span>
        </div>
        <div className="flex items-center gap-2">
          <Minus className="h-4 w-4 text-amber-500" />
          <span>Partial</span>
        </div>
        <div className="flex items-center gap-2">
          <X className="h-4 w-4 text-red-500" />
          <span>Not Available</span>
        </div>
      </div>
    </div>
  );
}
