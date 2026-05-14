import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { createUISlice, UISlice, FloatingStream } from './uiSlice';
import type { GeoEntity } from '@/core/plugins/PluginTypes';

// Mock the analytics module to prevent actual tracking during tests
vi.mock('@/lib/analytics', () => ({
    trackEvent: vi.fn(),
}));

describe('uiSlice', () => {
    let store: StoreApi<UISlice>;

    beforeEach(() => {
        // Reset local storage and document element
        vi.stubGlobal('localStorage', {
            getItem: vi.fn(),
            setItem: vi.fn(),
            clear: vi.fn(),
        });
        document.documentElement.removeAttribute('data-theme');
        store = createStore<UISlice>((set, get, api) => createUISlice(set as any, get as any, api as any));
    });

    it('initializes with correct default state', () => {
        const state = store.getState();
        expect(state.leftSidebarOpen).toBe(true);
        expect(state.rightSidebarOpen).toBe(false);
        expect(state.configPanelOpen).toBe(true);
        expect(state.filterPanelOpen).toBe(false);
        expect(state.selectedEntity).toBeNull();
        expect(state.floatingStreams).toEqual([]);
        expect(state.activeConfigTab).toBe('filters');
        expect(state.activeBottomPanel).toBeNull();
        expect(state.bottomPanelHeight).toBe(220);
    });

    it('toggles simple boolean states', () => {
        store.getState().toggleLeftSidebar();
        expect(store.getState().leftSidebarOpen).toBe(false);

        store.getState().toggleRightSidebar();
        expect(store.getState().rightSidebarOpen).toBe(true);

        store.getState().toggleConfigPanel();
        expect(store.getState().configPanelOpen).toBe(false);

        store.getState().toggleFilterPanel();
        expect(store.getState().filterPanelOpen).toBe(true);

        store.getState().setActiveBottomPanel('timeline');
        expect(store.getState().activeBottomPanel).toBe('timeline');

        store.getState().setBottomPanelHeight(300);
        expect(store.getState().bottomPanelHeight).toBe(300);

        store.getState().setFeedbackDialogOpen(true);
        expect(store.getState().feedbackDialogOpen).toBe(true);
    });

    it('toggles themes cyclically and updates DOM/localStorage', () => {
        // Start with black
        store.getState().setTheme('black');
        
        store.getState().toggleTheme();
        expect(store.getState().theme).toBe('light');
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        expect(localStorage.setItem).toHaveBeenCalledWith('wwv-theme', 'light');

        store.getState().toggleTheme();
        expect(store.getState().theme).toBe('legacy');

        store.getState().toggleTheme();
        expect(store.getState().theme).toBe('dark');

        store.getState().toggleTheme();
        expect(store.getState().theme).toBe('black');
    });

    it('sets specific theme directly', () => {
        store.getState().setTheme('legacy');
        expect(store.getState().theme).toBe('legacy');
        expect(document.documentElement.getAttribute('data-theme')).toBe('legacy');
    });

    it('handles setting selected entity and related UI panels', () => {
        const mockEntity = { id: 'e1', pluginId: 'test' } as GeoEntity;
        
        // When setting entity, right sidebar and config should open
        store.getState().setSelectedEntity(mockEntity);
        let state = store.getState();
        expect(state.selectedEntity).toEqual(mockEntity);
        expect(state.rightSidebarOpen).toBe(true);
        expect(state.configPanelOpen).toBe(true);
        expect(state.mobileRightPanelGlow).toBe(true);
        expect(state.activeConfigTab).toBe('intel');

        // When unsetting entity, panels should stay open, but glow and entity reset
        store.getState().setSelectedEntity(null);
        state = store.getState();
        expect(state.selectedEntity).toBeNull();
        expect(state.rightSidebarOpen).toBe(true); // Should remain true
        expect(state.configPanelOpen).toBe(true); // Should remain true
        expect(state.mobileRightPanelGlow).toBe(false);
    });

    it('sets hovered entity and position', () => {
        const mockEntity = { id: 'e2', pluginId: 'test' } as GeoEntity;
        store.getState().setHoveredEntity(mockEntity, { x: 100, y: 200 });
        
        const state = store.getState();
        expect(state.hoveredEntity).toEqual(mockEntity);
        expect(state.hoveredScreenPosition).toEqual({ x: 100, y: 200 });
    });

    it('manages floating streams', () => {
        const newStream: Omit<FloatingStream, "position" | "size"> = {
            id: 'stream-1',
            streamUrl: 'http://test',
            isIframe: true,
            label: 'Test Stream'
        };

        // Add
        store.getState().addFloatingStream(newStream);
        let state = store.getState();
        expect(state.floatingStreams.length).toBe(1);
        expect(state.floatingStreams[0].id).toBe('stream-1');
        // Check default size and position
        expect(state.floatingStreams[0].size).toEqual({ width: 400, height: 260 });

        // Update
        store.getState().updateFloatingStream('stream-1', { isMinimized: true });
        state = store.getState();
        expect(state.floatingStreams[0].isMinimized).toBe(true);

        // Prevent duplicates
        store.getState().addFloatingStream(newStream);
        expect(store.getState().floatingStreams.length).toBe(1);

        // Remove
        store.getState().removeFloatingStream('stream-1');
        expect(store.getState().floatingStreams.length).toBe(0);
    });

    it('manages error toasts', () => {
        store.getState().showErrorToast('Test error message');
        expect(store.getState().errorToastMessage).toBe('Test error message');

        store.getState().clearErrorToast();
        expect(store.getState().errorToastMessage).toBeNull();
    });

    it('manages mobile panels and glow', () => {
        store.getState().setOpenMobilePanel('right');
        expect(store.getState().openMobilePanel).toBe('right');
        expect(store.getState().mobileRightPanelGlow).toBe(false); // Should clear glow when opening right panel

        // Clicking same panel closes it
        store.getState().setOpenMobilePanel('right');
        expect(store.getState().openMobilePanel).toBeNull();
    });
});
