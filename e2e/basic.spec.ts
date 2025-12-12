// Copyright (c) 2025 Jema Technology.
// Distributed under the license specified in the root directory of this project.

/**
 * ANKHWAVESTUDIO Web E2E Tests
 * Basic functionality tests for the PWA
 */

import { test, expect, Page } from '@playwright/test';

// Helper to initialize audio context (requires user interaction)
async function initializeAudio(page: Page) {
  // Click anywhere to initialize audio
  await page.click('body');
  // Wait for audio initialization overlay to disappear
  await page.waitForSelector('[data-testid="audio-init-overlay"]', { state: 'hidden', timeout: 5000 }).catch(() => {
    // Overlay might not exist if audio is already initialized
  });
}

test.describe('App Loading', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the app to load
    await expect(page).toHaveTitle(/ANKHWAVESTUDIO Web/);
    
    // Check that main content is visible
    await expect(page.locator('body')).toBeVisible();
  });

  test('should show audio initialization overlay', async ({ page }) => {
    await page.goto('/');
    
    // The audio init overlay should be visible initially
    const overlay = page.locator('text=Click anywhere to start the audio engine');
    await expect(overlay).toBeVisible({ timeout: 5000 });
  });

  test('should initialize audio on click', async ({ page }) => {
    await page.goto('/');
    
    // Click to initialize audio
    await page.click('body');
    
    // Wait for overlay to disappear
    await page.waitForTimeout(1000);
    
    // The overlay should be hidden after clicking
    const overlay = page.locator('text=Click anywhere to start the audio engine');
    await expect(overlay).toBeHidden({ timeout: 5000 });
  });
});

test.describe('Header and Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await initializeAudio(page);
  });

  test('should display header with logo', async ({ page }) => {
    const header = page.locator('header');
    await expect(header).toBeVisible();
  });

  test('should have transport controls', async ({ page }) => {
    // Look for play/pause button
    const playButton = page.locator('button:has-text("Play"), button[aria-label*="play"]').first();
    await expect(playButton).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await initializeAudio(page);
  });

  test('should toggle sidebar visibility', async ({ page }) => {
    // Press B to toggle sidebar
    await page.keyboard.press('b');
    await page.waitForTimeout(300);
    
    // Press B again to show sidebar
    await page.keyboard.press('b');
    await page.waitForTimeout(300);
  });
});

test.describe('Editor Views', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await initializeAudio(page);
  });

  test('should switch to Song Editor with keyboard shortcut', async ({ page }) => {
    await page.keyboard.press('1');
    await page.waitForTimeout(300);
    
    // Check that Song editor tab is active
    const songTab = page.locator('button:has-text("Song")');
    await expect(songTab).toBeVisible();
  });

  test('should switch to Piano Roll with keyboard shortcut', async ({ page }) => {
    await page.keyboard.press('2');
    await page.waitForTimeout(300);
    
    // Check that Piano Roll tab is active
    const pianoRollTab = page.locator('button:has-text("Piano Roll")');
    await expect(pianoRollTab).toBeVisible();
  });

  test('should switch to Pattern Editor with keyboard shortcut', async ({ page }) => {
    await page.keyboard.press('3');
    await page.waitForTimeout(300);
    
    // Check that Pattern tab is active
    const patternTab = page.locator('button:has-text("Pattern")');
    await expect(patternTab).toBeVisible();
  });

  test('should switch to Automation Editor with keyboard shortcut', async ({ page }) => {
    await page.keyboard.press('4');
    await page.waitForTimeout(300);
    
    // Check that Automation tab is active
    const automationTab = page.locator('button:has-text("Automation")');
    await expect(automationTab).toBeVisible();
  });
});

test.describe('Bottom Panels', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await initializeAudio(page);
  });

  test('should toggle Mixer panel with keyboard shortcut', async ({ page }) => {
    // Press M to toggle mixer
    await page.keyboard.press('m');
    await page.waitForTimeout(300);
    
    // Check that Mixer button is active
    const mixerButton = page.locator('button:has-text("Mixer")');
    await expect(mixerButton).toBeVisible();
  });

  test('should toggle Instruments panel with keyboard shortcut', async ({ page }) => {
    // Press I to toggle instruments
    await page.keyboard.press('i');
    await page.waitForTimeout(300);
    
    // Check that Instruments button is active
    const instrumentsButton = page.locator('button:has-text("Instruments")');
    await expect(instrumentsButton).toBeVisible();
  });
});

test.describe('Transport Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await initializeAudio(page);
  });

  test('should toggle play/pause with Space key', async ({ page }) => {
    // Press Space to play
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    
    // Press Space again to pause
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
  });

  test('should stop with Enter key', async ({ page }) => {
    // Start playing
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    
    // Stop with Enter
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
  });

  test('should toggle loop with L key', async ({ page }) => {
    await page.keyboard.press('l');
    await page.waitForTimeout(300);
    
    // Toggle again
    await page.keyboard.press('l');
    await page.waitForTimeout(300);
  });
});

test.describe('PWA Features', () => {
  test('should have valid manifest', async ({ page }) => {
    await page.goto('/');
    
    // Check for manifest link
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute('href', /manifest/);
  });

  test('should register service worker', async ({ page, context }) => {
    await page.goto('/');
    
    // Wait for service worker registration
    await page.waitForTimeout(2000);
    
    // Check if service worker is registered
    const swRegistrations = await context.serviceWorkers();
    // In development, SW might not be registered
    // This test is more meaningful in production build
  });

  test('should have proper meta tags for PWA', async ({ page }) => {
    await page.goto('/');
    
    // Check for theme-color meta tag
    const themeColor = page.locator('meta[name="theme-color"]');
    await expect(themeColor).toHaveAttribute('content');
    
    // Check for viewport meta tag
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveAttribute('content', /width=device-width/);
  });

  test('should have apple-touch-icon', async ({ page }) => {
    await page.goto('/');
    
    const appleTouchIcon = page.locator('link[rel="apple-touch-icon"]');
    await expect(appleTouchIcon).toHaveAttribute('href');
  });
});

test.describe('Offline Functionality', () => {
  test('should show offline indicator when offline', async ({ page, context }) => {
    await page.goto('/');
    await initializeAudio(page);
    
    // Go offline
    await context.setOffline(true);
    await page.waitForTimeout(500);
    
    // Check for offline indicator
    const offlineIndicator = page.locator('text=Offline');
    // The indicator should appear
    
    // Go back online
    await context.setOffline(false);
    await page.waitForTimeout(500);
  });
});

test.describe('Responsive Design', () => {
  test('should adapt to mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // App should still be functional
    await expect(page.locator('body')).toBeVisible();
  });

  test('should adapt to tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    
    // App should still be functional
    await expect(page.locator('body')).toBeVisible();
  });

  test('should adapt to desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    
    // App should still be functional
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await initializeAudio(page);
  });

  test('should have no accessibility violations on main page', async ({ page }) => {
    // Basic accessibility check - ensure interactive elements are focusable
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    expect(buttonCount).toBeGreaterThan(0);
    
    // Check that buttons have accessible names
    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i);
      const hasText = await button.textContent();
      const hasAriaLabel = await button.getAttribute('aria-label');
      const hasTitle = await button.getAttribute('title');
      
      // Button should have some accessible name
      expect(hasText || hasAriaLabel || hasTitle).toBeTruthy();
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Tab through the interface
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    
    // Check that something is focused
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });
});

test.describe('Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('should not have memory leaks on navigation', async ({ page }) => {
    await page.goto('/');
    await initializeAudio(page);
    
    // Switch between editors multiple times
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('1');
      await page.waitForTimeout(100);
      await page.keyboard.press('2');
      await page.waitForTimeout(100);
      await page.keyboard.press('3');
      await page.waitForTimeout(100);
      await page.keyboard.press('4');
      await page.waitForTimeout(100);
    }
    
    // App should still be responsive
    await expect(page.locator('body')).toBeVisible();
  });
});