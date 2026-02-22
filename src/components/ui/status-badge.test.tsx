import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge, getPerformanceStatus } from './status-badge';

describe('StatusBadge', () => {
  it('should render children text', () => {
    render(<StatusBadge status="on-track">On Track</StatusBadge>);
    expect(screen.getByText('On Track')).toBeInTheDocument();
  });

  it('should apply on-track styling', () => {
    render(<StatusBadge status="on-track">On Track</StatusBadge>);
    const badge = screen.getByText('On Track');
    expect(badge.className).toContain('text-success');
  });

  it('should apply at-risk styling', () => {
    render(<StatusBadge status="at-risk">At Risk</StatusBadge>);
    const badge = screen.getByText('At Risk');
    expect(badge.className).toContain('text-warning');
  });

  it('should apply off-track styling', () => {
    render(<StatusBadge status="off-track">Off Track</StatusBadge>);
    const badge = screen.getByText('Off Track');
    expect(badge.className).toContain('text-destructive');
  });
});

describe('getPerformanceStatus', () => {
  it('should return on-track when goal is 0', () => {
    expect(getPerformanceStatus(10, 0)).toBe('on-track');
  });

  it('should return off-track when very far behind expected progress', () => {
    // With value 0 and goal 100, percentage = 0 which is always < 50% of expected
    expect(getPerformanceStatus(0, 100)).toBe('off-track');
  });
});
