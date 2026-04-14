import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LayerPanel } from "@/components/panels/LayerPanel";
import { useStore } from "@/core/state/store";
import { EarthquakesPlugin } from "@worldwideview/wwv-plugin-earthquakes";

const plugin = new EarthquakesPlugin();
const pluginManagerMock = vi.hoisted(() => ({
    getAllPlugins: vi.fn(),
    getPlugin: vi.fn(),
    getManifest: vi.fn(),
    enablePlugin: vi.fn(),
    disablePlugin: vi.fn(),
}));

vi.mock("@/core/hooks/useIsMobile", () => ({
    useIsMobile: () => false,
}));

vi.mock("@/lib/analytics", () => ({
    trackEvent: vi.fn(),
}));

vi.mock("@/components/panels/ImageryPicker", () => ({
    ImageryPicker: () => <div>Imagery</div>,
}));

vi.mock("@/components/panels/FavoritesTab", () => ({
    FavoritesTab: () => <div>Favorites</div>,
}));

vi.mock("@/plugins/geojson/ImportPanel", () => ({
    ImportPanel: () => <div>Import</div>,
}));

vi.mock("@/components/panels/PluginsTab", () => ({
    PluginsTab: () => <div>Plugins</div>,
}));

vi.mock("@/core/plugins/PluginManager", () => ({
    pluginManager: pluginManagerMock,
}));

describe("Earthquakes layer in LayerPanel", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        pluginManagerMock.getAllPlugins.mockReturnValue([{
            plugin,
            enabled: false,
            entities: [],
            context: {} as never,
        }]);
        pluginManagerMock.getPlugin.mockReturnValue({ plugin });
        pluginManagerMock.getManifest.mockReturnValue(undefined);
        useStore.setState({
            leftSidebarOpen: true,
            openMobilePanel: null,
            highlightLayerId: null,
            configPanelOpen: false,
            activeConfigTab: "filters",
            selectedEntity: null,
            entitiesByPlugin: {},
            layers: {
                earthquakes: {
                    enabled: false,
                    entityCount: 0,
                    loading: false,
                },
            },
        });
    });

    it("shows Earthquakes in the layer list and toggles it on and off", () => {
        const { container } = render(<LayerPanel />);

        expect(screen.getByText("Data Sources")).toBeTruthy();
        expect(screen.getByText("Earthquakes")).toBeTruthy();

        const toggle = container.querySelector(".layer-item__toggle");
        expect(toggle).not.toBeNull();

        fireEvent.click(toggle!);

        expect(pluginManagerMock.enablePlugin).toHaveBeenCalledWith("earthquakes");
        expect(useStore.getState().layers.earthquakes.enabled).toBe(true);

        fireEvent.click(toggle!);

        expect(pluginManagerMock.disablePlugin).toHaveBeenCalledWith("earthquakes");
        expect(useStore.getState().layers.earthquakes.enabled).toBe(false);
    });
});
