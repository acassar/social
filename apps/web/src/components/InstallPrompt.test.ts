import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import InstallPrompt from './InstallPrompt.vue';

function dispatchBeforeInstallPrompt() {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  window.dispatchEvent(event);
  return event;
}

describe('InstallPrompt', () => {
  it('stays hidden until the browser fires beforeinstallprompt', () => {
    const wrapper = mount(InstallPrompt);

    expect(wrapper.find('.install-prompt').exists()).toBe(false);
  });

  it('shows the banner and prompts install on demand', async () => {
    const wrapper = mount(InstallPrompt);

    const event = dispatchBeforeInstallPrompt();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.install-prompt').exists()).toBe(true);

    await wrapper.find('.install-prompt__action').trigger('click');
    await wrapper.vm.$nextTick();

    expect(event.prompt).toHaveBeenCalled();
    expect(wrapper.find('.install-prompt').exists()).toBe(false);
  });

  it('dismisses the banner without prompting install', async () => {
    const wrapper = mount(InstallPrompt);

    dispatchBeforeInstallPrompt();
    await wrapper.vm.$nextTick();

    await wrapper.find('.install-prompt__dismiss').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.install-prompt').exists()).toBe(false);
  });
});
