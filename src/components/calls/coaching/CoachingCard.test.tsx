import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CoachingCard } from './CoachingCard';
import type { CoachingSynthesis } from '@/utils/analysis-schemas';

const mockCoachingData: CoachingSynthesis = {
  overall_grade: 'A',
  executive_summary: 'Rep demonstrated strong discovery skills and maintained prospect engagement throughout.',
  top_3_strengths: [
    'Excellent rapport building',
    'Strong discovery questions',
    'Good objection handling',
  ],
  top_3_areas_for_improvement: [
    'Could improve closing technique',
    'Missed pricing opportunity',
    'Talk ratio slightly high',
  ],
  primary_focus_area: 'Discovery Depth',
  coaching_prescription: 'You nailed the discovery phase. Focus on tightening your close by asking for next steps earlier.',
  grade_reasoning: 'Strong overall performance with room for improvement in closing.',
  coaching_drill: 'Practice the 3-step close technique.',
  immediate_action: 'Send follow-up email within 24 hours.',
};

describe('CoachingCard', () => {
  it('should render loading skeleton when isLoading is true', () => {
    const { container } = render(<CoachingCard data={null} isLoading={true} />);
    // Skeleton elements use shimmer animation class
    const skeletons = container.querySelectorAll('[class*="shimmer"], [class*="bg-muted"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render empty state when data is null', () => {
    render(<CoachingCard data={null} />);
    expect(screen.getByText('Coaching synthesis will appear when analysis completes')).toBeInTheDocument();
  });

  it('should render overall grade', () => {
    render(<CoachingCard data={mockCoachingData} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('should render primary focus area', () => {
    render(<CoachingCard data={mockCoachingData} />);
    expect(screen.getByText('Discovery Depth')).toBeInTheDocument();
  });

  it('should render coaching prescription', () => {
    render(<CoachingCard data={mockCoachingData} />);
    expect(screen.getByText(mockCoachingData.coaching_prescription)).toBeInTheDocument();
  });

  it('should render strengths and improvements', () => {
    render(<CoachingCard data={mockCoachingData} />);
    expect(screen.getByText('Excellent rapport building')).toBeInTheDocument();
    expect(screen.getByText('Could improve closing technique')).toBeInTheDocument();
  });

  it('should render executive summary', () => {
    render(<CoachingCard data={mockCoachingData} />);
    expect(screen.getByText(mockCoachingData.executive_summary)).toBeInTheDocument();
  });

  it('should render immediate action when provided', () => {
    render(<CoachingCard data={mockCoachingData} />);
    expect(screen.getByText('Immediate Action')).toBeInTheDocument();
    expect(screen.getByText('Send follow-up email within 24 hours.')).toBeInTheDocument();
  });
});
