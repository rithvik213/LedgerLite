import '@testing-library/jest-dom';

// Radix UI primitives use several browser APIs that jsdom doesn't implement.
// Stub them so component tests can exercise Radix Select, Dialog, etc.

if (typeof window !== 'undefined') {
  // Pointer capture — used by Radix Select's mouse handling
  window.HTMLElement.prototype.hasPointerCapture = () => false;
  window.HTMLElement.prototype.setPointerCapture = () => {};
  window.HTMLElement.prototype.releasePointerCapture = () => {};

  // scrollIntoView — called by Radix Select to scroll the highlighted item into view
  window.HTMLElement.prototype.scrollIntoView = () => {};

  // ResizeObserver — used by Radix Popper for positioning
  if (!window.ResizeObserver) {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
}
