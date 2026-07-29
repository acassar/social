import { describe, expect, it } from 'vitest';
import { SHARED_PACKAGE_NAME } from '@social/shared';

describe('web scaffold', () => {
  it('links to the shared package', () => {
    expect(SHARED_PACKAGE_NAME).toBe('@social/shared');
  });
});
