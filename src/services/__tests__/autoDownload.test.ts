import { describe, it, expect } from 'vitest';
import { decideAutoDownload, NetworkFacts } from '../autoDownload';

function facts(overrides: Partial<NetworkFacts> = {}): NetworkFacts {
  return {
    online: true,
    connectionType: 'wifi',
    downloadOverWifiOnly: true,
    ...overrides,
  };
}

describe('Auto-download policy', () => {
  it('does nothing until the listener turns it on', () => {
    expect(decideAutoDownload(false, facts())).toEqual({ allowed: false, reason: 'disabled' });
  });

  it('refuses to start while the device is offline', () => {
    expect(decideAutoDownload(true, facts({ online: false }))).toEqual({
      allowed: false,
      reason: 'offline',
    });
  });

  it('honours "Download over Wi-Fi only" on cellular', () => {
    expect(decideAutoDownload(true, facts({ connectionType: 'cellular4g' }))).toEqual({
      allowed: false,
      reason: 'cellular',
    });
  });

  it('starts on Wi-Fi', () => {
    expect(decideAutoDownload(true, facts({ connectionType: 'wifi' }))).toEqual({
      allowed: true,
      reason: 'ok',
    });
  });

  it('does not block when the browser hides the connection type', () => {
    // Desktop browsers expose no Network Information API. Guessing "cellular" there
    // would silently disable auto-download for most users.
    expect(decideAutoDownload(true, facts({ connectionType: null }))).toEqual({
      allowed: true,
      reason: 'ok',
    });
  });

  it('downloads on cellular when the Wi-Fi-only setting is off', () => {
    expect(
      decideAutoDownload(
        true,
        facts({ connectionType: 'cellular5g', downloadOverWifiOnly: false })
      )
    ).toEqual({ allowed: true, reason: 'ok' });
  });

  it('treats the connection type case-insensitively', () => {
    expect(decideAutoDownload(true, facts({ connectionType: 'Cellular' }))).toEqual({
      allowed: false,
      reason: 'cellular',
    });
  });

  it('stays available over ethernet and other non-cellular links', () => {
    expect(decideAutoDownload(true, facts({ connectionType: 'ethernet' }))).toEqual({
      allowed: true,
      reason: 'ok',
    });
  });
});
