import { describe, it, expect, beforeEach } from 'vitest';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { createFilterSlice, FilterSlice } from './filterSlice';
import type { FilterValue } from '@/core/plugins/PluginTypes';

describe('filterSlice', () => {
    let store: StoreApi<FilterSlice>;

    beforeEach(() => {
        store = createStore<FilterSlice>((set, get, api) => createFilterSlice(set as any, get as any, api as any));
    });

    it('initializes with empty filters', () => {
        const state = store.getState();
        expect(state.filters).toEqual({});
    });

    it('sets a specific filter for a plugin', () => {
        const filterVal: FilterValue = { type: 'boolean', value: true };
        store.getState().setFilter('plugin-a', 'show-active', filterVal);
        
        const state = store.getState();
        expect(state.filters['plugin-a']).toBeDefined();
        expect(state.filters['plugin-a']['show-active']).toEqual(filterVal);
    });

    it('updates an existing filter without overwriting other filters for the same plugin', () => {
        const filterVal1: FilterValue = { type: 'boolean', value: true };
        const filterVal2: FilterValue = { type: 'select', values: ['option1'] };
        
        store.getState().setFilter('plugin-a', 'filter-1', filterVal1);
        store.getState().setFilter('plugin-a', 'filter-2', filterVal2);
        
        let state = store.getState();
        expect(state.filters['plugin-a']['filter-1']).toEqual(filterVal1);
        expect(state.filters['plugin-a']['filter-2']).toEqual(filterVal2);
        
        // Update filter-1
        const updatedFilterVal1: FilterValue = { type: 'boolean', value: false };
        store.getState().setFilter('plugin-a', 'filter-1', updatedFilterVal1);
        
        state = store.getState();
        expect(state.filters['plugin-a']['filter-1']).toEqual(updatedFilterVal1);
        expect(state.filters['plugin-a']['filter-2']).toEqual(filterVal2); // Still preserved
    });

    it('clears all filters for a specific plugin', () => {
        store.getState().setFilter('plugin-a', 'f1', { type: 'boolean', value: true });
        store.getState().setFilter('plugin-b', 'f2', { type: 'boolean', value: false });
        
        store.getState().clearFilters('plugin-a');
        
        const state = store.getState();
        expect(state.filters['plugin-a']).toBeUndefined();
        expect(state.filters['plugin-b']).toBeDefined(); // plugin-b untouched
    });

    it('clears all filters globally', () => {
        store.getState().setFilter('plugin-a', 'f1', { type: 'boolean', value: true });
        store.getState().setFilter('plugin-b', 'f2', { type: 'boolean', value: false });
        
        store.getState().clearAllFilters();
        
        const state = store.getState();
        expect(state.filters).toEqual({});
    });
});
