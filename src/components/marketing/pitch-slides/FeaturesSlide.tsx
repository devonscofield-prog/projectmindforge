import { 
  BarChart3, 
  FileText, 
  Flame, 
  Users, 
  Bell, 
  LayoutDashboard 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const features = [
  {
    icon: BarChart3,
    title: 'Multi-Framework Analysis',
    description: 'BANT, Gap Selling, Active Listening scores for every call',
    color: 'bg-blue-500',
  },
  {
    icon: FileText,
    title: 'AI-Generated Notes',
    description: 'Automatic summaries, call notes, and recap emails',
    color: 'bg-green-500',
  },
  {
    icon: Flame,
    title: 'Heat Signature Scoring',
    description: 'Real-time deal health indicators and risk alerts',
    color: 'bg-orange-500',
  },
  {
    icon: Users,
    title: 'Stakeholder Intelligence',
    description: 'Map decision makers and champion relationships',
    color: 'bg-purple-500',
  },
  {
    icon: Bell,
    title: 'Performance Alerts',
    description: 'Proactive notifications when metrics need attention',
    color: 'bg-red-500',
  },
  {
    icon: LayoutDashboard,
    title: 'Role-Based Dashboards',
    description: 'Tailored views for reps, managers, and leadership',
    color: 'bg-cyan-500',
  },
];

export function FeaturesSlide() {
  return (
    <div className="flex flex-col h-full px-8 py-6">
      <div className="text-center mb-6">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">Key Features</h2>
        <p className="text-muted-foreground text-lg">
          Everything you need to drive sales excellence
        </p>
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
        {features.map((feature, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-5 flex items-start gap-4">
              <div className={`p-2.5 rounded-lg ${feature.color}`}>
                <feature.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
