import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from './empty-state';
import { Search } from 'lucide-react';

describe('EmptyState', () => {
  it('should render title', () => {
    render(<EmptyState title="No results found" />);
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('should render description when provided', () => {
    render(<EmptyState title="No results" description="Try adjusting your filters" />);
    expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument();
  });

  it('should render action button and handle click', () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="No items"
        action={{ label: 'Add Item', onClick }}
      />
    );
    const button = screen.getByText('Add Item');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should have role=status with aria-label', () => {
    render(<EmptyState title="Empty" />);
    const element = screen.getByRole('status');
    expect(element).toHaveAttribute('aria-label', 'Empty');
  });

  it('should render icon when provided', () => {
    const { container } = render(<EmptyState title="No results" icon={Search} />);
    // Icon is rendered with aria-hidden
    const icon = container.querySelector('[aria-hidden="true"]');
    expect(icon).toBeInTheDocument();
  });
});
