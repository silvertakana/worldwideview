/* eslint-disable @typescript-eslint/no-explicit-any */
import {
 describe, it, expect, beforeEach, vi, afterEach
} from 'vitest';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { GeoEntity } from '@/core/plugins/PluginTypes';
import { createFavoritesSlice, FavoritesSlice } from './favoritesSlice';

// isDemo=false so addFavorite/removeFavorite exercise the fetch (cloud/local
// edition) branch instead of the cookie branch.
vi.mock('@/core/edition', () => ({
    isDemo: false,
}));

interface MockAppStore extends FavoritesSlice {
    showErrorToast?: (message: string) => void;
}

describe('favoritesSlice (cloud mode) — optimistic update rollback', () => {
    let store: StoreApi<MockAppStore>;
    let showErrorToast: ReturnType<typeof vi.fn<(message: string) => void>>;

    beforeEach(() => {
        showErrorToast = vi.fn<(message: string) => void>();
        store = createStore<MockAppStore>((set, get, api) => ({
            ...createFavoritesSlice(set as any, get as any, api as any),
            showErrorToast,
        }));
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    const mockEntity = { id: 'entity-1', pluginId: 'plugin-a', label: 'Test Entity' } as GeoEntity;

    it('reverts the optimistic add and surfaces an error when the POST fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

        store.getState().addFavorite(mockEntity, 'Plugin A');
        expect(store.getState().favorites).toHaveLength(1);

        // Let the fetch promise's .then/.catch chain settle.
        await vi.waitFor(() => {
            expect(store.getState().favorites).toHaveLength(0);
        });
        expect(showErrorToast).toHaveBeenCalled();
    });

    it('keeps the optimistic add when the POST succeeds', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

        store.getState().addFavorite(mockEntity, 'Plugin A');
        await Promise.resolve();
        await Promise.resolve();

        expect(store.getState().favorites).toHaveLength(1);
        expect(showErrorToast).not.toHaveBeenCalled();
    });

    it('reverts the optimistic remove and surfaces an error when the DELETE fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
        store.getState().initFavorites([{
            id: 'entity-1', pluginId: 'plugin-a', label: 'Test Entity', pluginName: 'Plugin A', lastSeen: 1,
        }]);

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
        store.getState().removeFavorite('entity-1');
        expect(store.getState().favorites).toHaveLength(0);

        await vi.waitFor(() => {
            expect(store.getState().favorites).toHaveLength(1);
        });
        expect(showErrorToast).toHaveBeenCalled();
    });
});
