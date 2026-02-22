import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PageErrorBoundary } from './page-error-boundary';

const ThrowError = () => {
  throw new Error('Page crashed');
};

describe('PageErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should render children when no error', () => {
    render(
      <PageErrorBoundary>
        <div>Page content</div>
      </PageErrorBoundary>
    );
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('should catch errors and show default error message', () => {
    render(
      <PageErrorBoundary>
        <ThrowError />
      </PageErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });

  it('should show page name in error message when provided', () => {
    render(
      <PageErrorBoundary pageName="Dashboard">
        <ThrowError />
      </PageErrorBoundary>
    );
    expect(screen.getByText('Error loading Dashboard')).toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    render(
      <PageErrorBoundary fallback={<div>Custom page error</div>}>
        <ThrowError />
      </PageErrorBoundary>
    );
    expect(screen.getByText('Custom page error')).toBeInTheDocument();
  });

  it('should show error details in collapsible section', () => {
    render(
      <PageErrorBoundary>
        <ThrowError />
      </PageErrorBoundary>
    );
    expect(screen.getByText('View error details')).toBeInTheDocument();
    expect(screen.getByText('Page crashed')).toBeInTheDocument();
  });
});
