import { installFakeRuntime } from './install';

// Einstieg für tests/.runtime/fake-claude.js: Playwright setzt vorher
// window.__LINGO_FAKE_OPTIONS__ und spielt dieses Skript per addInitScript ein.
installFakeRuntime(window.__LINGO_FAKE_OPTIONS__ ?? {});
