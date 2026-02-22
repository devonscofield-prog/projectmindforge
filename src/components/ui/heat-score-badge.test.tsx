import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeatScoreBadge } from './heat-score-badge';

describe('HeatScoreBadge', () => {
  it('should render null dash for null score in default variant', () => {
    render(<HeatScoreBadge score={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('should return null for null score in card variant', () => {
    const { container } = render(<HeatScoreBadge score={null} variant="card" />);
    expect(container.innerHTML).toBe('');
  });

  it('should render Hot label for score >= 70', () => {
    render(<HeatScoreBadge score={85} variant="card" />);
    expect(screen.getByText('(Hot)')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('should render Warm label for score 50-69', () => {
    render(<HeatScoreBadge score={55} variant="card" />);
    expect(screen.getByText('(Warm)')).toBeInTheDocument();
  });

  it('should render Lukewarm label for score 25-49', () => {
    render(<HeatScoreBadge score={30} variant="card" />);
    expect(screen.getByText('(Lukewarm)')).toBeInTheDocument();
  });

  it('should render Cold label for score < 25', () => {
    render(<HeatScoreBadge score={10} variant="card" />);
    expect(screen.getByText('(Cold)')).toBeInTheDocument();
  });

  it('should render score number in default variant', () => {
    render(<HeatScoreBadge score={75} />);
    expect(screen.getByText('75')).toBeInTheDocument();
  });
});
