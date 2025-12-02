import { Phone, Mail, Users, MessageSquare, Linkedin, Presentation, FileText } from 'lucide-react';
import type { ProspectStatus, ProspectActivityType } from '@/api/prospects';

export const statusLabels: Record<ProspectStatus, string> = {
  active: 'Active',
  won: 'Won',
  lost: 'Lost',
  dormant: 'Dormant',
};

export const statusVariants: Record<ProspectStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  won: 'secondary',
  lost: 'destructive',
  dormant: 'outline',
};

export const industryOptions = [
  { value: 'education', label: 'Education' },
  { value: 'local_government', label: 'Local Government' },
  { value: 'state_government', label: 'State Government' },
  { value: 'federal_government', label: 'Federal Government' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'msp', label: 'MSP' },
  { value: 'technology', label: 'Technology' },
  { value: 'finance', label: 'Finance' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'retail', label: 'Retail' },
  { value: 'nonprofit', label: 'Nonprofit' },
  { value: 'other', label: 'Other' },
];

export const activityTypeLabels: Record<ProspectActivityType, string> = {
  call: 'Phone Call',
  email: 'Email',
  meeting: 'Meeting',
  text_message: 'Text Message',
  linkedin: 'LinkedIn',
  demo: 'Demo',
  note: 'Note', // Legacy - kept for backward compatibility
};

export const activityIcons: Record<ProspectActivityType, React.ElementType> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  text_message: MessageSquare,
  linkedin: Linkedin,
  demo: Presentation,
  note: FileText, // Legacy - kept for backward compatibility
};
