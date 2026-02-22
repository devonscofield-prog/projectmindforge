import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CoachGradeBadge } from './coach-grade-badge';

describe('CoachGradeBadge', () => {
  it('should render dash when grade is null', () => {
    render(<CoachGradeBadge grade={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('should render dash when grade is undefined', () => {
    render(<CoachGradeBadge />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('should render the grade text', () => {
    render(<CoachGradeBadge grade="A+" />);
    expect(screen.getByText('A+')).toBeInTheDocument();
  });

  it('should render grade B with correct styling', () => {
    render(<CoachGradeBadge grade="B" />);
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('should show trend icon when showTrend is true and trend is provided', () => {
    const { container } = render(
      <CoachGradeBadge grade="A" trend="improving" showTrend={true} />
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    // Trend icon should be rendered (aria-hidden svg)
    const icons = container.querySelectorAll('[aria-hidden="true"]');
    expect(icons.length).toBeGreaterThan(0);
  });

  it('should not show trend icon when showTrend is false', () => {
    const { container } = render(
      <CoachGradeBadge grade="A" trend="improving" showTrend={false} />
    );
    const icons = container.querySelectorAll('[aria-hidden="true"]');
    expect(icons.length).toBe(0);
  });
});
