// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.
/**
 * Button Component Unit Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../../components/common/Button';

describe('Button', () => {
  describe('Rendering', () => {
    it('should render with children', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('should render as a button element', () => {
      render(<Button>Test</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      render(<Button className="custom-class">Test</Button>);
      expect(screen.getByRole('button')).toHaveClass('custom-class');
    });
  });

  describe('Variants', () => {
    it('should render primary variant by default', () => {
      render(<Button>Primary</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-daw-accent-primary');
    });

    it('should render secondary variant', () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-daw-bg-elevated');
    });

    it('should render ghost variant', () => {
      render(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-transparent');
    });

    it('should render danger variant', () => {
      render(<Button variant="danger">Danger</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-daw-accent-secondary');
    });

    it('should render success variant', () => {
      render(<Button variant="success">Success</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-daw-accent-success');
    });
  });

  describe('Sizes', () => {
    it('should render medium size by default', () => {
      render(<Button>Medium</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('text-sm');
    });

    it('should render extra small size', () => {
      render(<Button size="xs">XS</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('text-xs');
      expect(button).toHaveClass('min-h-[22px]');
    });

    it('should render small size', () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('min-h-[26px]');
    });

    it('should render large size', () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('text-base');
      expect(button).toHaveClass('min-h-[40px]');
    });
  });

  describe('Icons', () => {
    const TestIcon = () => <span data-testid="test-icon">🎵</span>;

    it('should render icon on the left by default', () => {
      render(<Button icon={<TestIcon />}>With Icon</Button>);
      const button = screen.getByRole('button');
      const icon = screen.getByTestId('test-icon');
      
      expect(icon).toBeInTheDocument();
      // Icon should come before text
      expect(button.firstChild).toContainElement(icon);
    });

    it('should render icon on the right when specified', () => {
      render(<Button icon={<TestIcon />} iconPosition="right">With Icon</Button>);
      const button = screen.getByRole('button');
      const icon = screen.getByTestId('test-icon');
      
      expect(icon).toBeInTheDocument();
      // Icon should come after text
      expect(button.lastChild?.previousSibling).toContainElement(icon);
    });

    it('should not render icon when loading', () => {
      render(<Button icon={<TestIcon />} loading>Loading</Button>);
      expect(screen.queryByTestId('test-icon')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner when loading', () => {
      render(<Button loading>Loading</Button>);
      const button = screen.getByRole('button');
      
      // Should have spinner (svg with animate-spin class)
      const spinner = button.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should be disabled when loading', () => {
      render(<Button loading>Loading</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should have aria-busy when loading', () => {
      render(<Button loading>Loading</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('Disabled State', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should have disabled styles', () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByRole('button')).toHaveClass('disabled:opacity-50');
    });

    it('should not trigger onClick when disabled', () => {
      const handleClick = vi.fn();
      render(<Button disabled onClick={handleClick}>Disabled</Button>);
      
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Active State', () => {
    it('should have aria-pressed when active', () => {
      render(<Button active>Active</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    });

    it('should have active styles for primary variant', () => {
      render(<Button active variant="primary">Active</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-blue-700');
    });
  });

  describe('Full Width', () => {
    it('should be full width when fullWidth is true', () => {
      render(<Button fullWidth>Full Width</Button>);
      expect(screen.getByRole('button')).toHaveClass('w-full');
    });
  });

  describe('Shortcut', () => {
    it('should display keyboard shortcut', () => {
      render(<Button shortcut="Ctrl+S">Save</Button>);
      expect(screen.getByText('Ctrl+S')).toBeInTheDocument();
    });

    it('should render shortcut in kbd element', () => {
      render(<Button shortcut="Ctrl+S">Save</Button>);
      const kbd = screen.getByText('Ctrl+S');
      expect(kbd.tagName).toBe('KBD');
    });
  });

  describe('Tooltip', () => {
    it('should have title attribute when tooltip is provided', () => {
      render(<Button tooltip="This is a tooltip">Hover me</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('title', 'This is a tooltip');
    });
  });

  describe('Click Handler', () => {
    it('should call onClick when clicked', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);
      
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when loading', () => {
      const handleClick = vi.fn();
      render(<Button loading onClick={handleClick}>Loading</Button>);
      
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Interaction', () => {
    it('should trigger click on Enter key', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Press Enter</Button>);
      
      fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should trigger click on Space key', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Press Space</Button>);
      
      fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not trigger click on other keys', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Press Key</Button>);
      
      fireEvent.keyDown(screen.getByRole('button'), { key: 'a' });
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should call custom onKeyDown handler', () => {
      const handleKeyDown = vi.fn();
      render(<Button onKeyDown={handleKeyDown}>Key Down</Button>);
      
      fireEvent.keyDown(screen.getByRole('button'), { key: 'Tab' });
      expect(handleKeyDown).toHaveBeenCalled();
    });
  });

  describe('Ref Forwarding', () => {
    it('should forward ref to button element', () => {
      const ref = { current: null as HTMLButtonElement | null };
      render(<Button ref={ref}>Ref Test</Button>);
      
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });
  });

  describe('Additional Props', () => {
    it('should pass through additional HTML attributes', () => {
      render(<Button data-testid="custom-button" aria-label="Custom label">Test</Button>);
      
      const button = screen.getByTestId('custom-button');
      expect(button).toHaveAttribute('aria-label', 'Custom label');
    });

    it('should support type attribute', () => {
      render(<Button type="submit">Submit</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
    });
  });
});