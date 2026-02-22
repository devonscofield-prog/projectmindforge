import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RateLimitCountdown } from './rate-limit-countdown';

describe('RateLimitCountdown', () => {
  it('should return null when secondsRemaining is 0', () => {
    const { container } = render(<RateLimitCountdown secondsRemaining={0} />);
    expect(container.innerHTML).toBe('');
  });

  it('should return null when secondsRemaining is negative', () => {
    const { container } = render(<RateLimitCountdown secondsRemaining={-5} />);
    expect(container.innerHTML).toBe('');
  });

  it('should display seconds format for values under 60', () => {
    render(<RateLimitCountdown secondsRemaining={45} />);
    expect(screen.getByText('45s')).toBeInTheDocument();
    expect(screen.getByText(/Rate limited/)).toBeInTheDocument();
  });

  it('should display minutes:seconds format for values 60 or more', () => {
    render(<RateLimitCountdown secondsRemaining={125} />);
    expect(screen.getByText('2:05')).toBeInTheDocument();
  });

  it('should display 1:00 for exactly 60 seconds', () => {
    render(<RateLimitCountdown secondsRemaining={60} />);
    expect(screen.getByText('1:00')).toBeInTheDocument();
  });
});
