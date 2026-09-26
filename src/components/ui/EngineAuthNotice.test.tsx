// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EngineAuthNotice from "./EngineAuthNotice";

const { mockState } = vi.hoisted(() => ({
    mockState: {
        engineAuthNotice: true,
        dismissEngineAuthNotice: vi.fn(),
        setActiveConfigTab: vi.fn(),
        setConfigPanelOpen: vi.fn(),
    },
}));

vi.mock("@/core/state/store", () => ({
    useStore: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}));

describe("EngineAuthNotice", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockState.engineAuthNotice = true;
    });

    it("renders nothing until the notice is raised", () => {
        mockState.engineAuthNotice = false;
        const { container } = render(<EngineAuthNotice />);
        expect(container.firstChild).toBeNull();
    });

    it("explains the missing connection and can be dismissed", () => {
        render(<EngineAuthNotice />);
        expect(screen.getByRole("status")).toBeTruthy();
        expect(screen.getByText(/marketplace connection/i)).toBeTruthy();

        fireEvent.click(screen.getByLabelText("Dismiss"));
        expect(mockState.dismissEngineAuthNotice).toHaveBeenCalled();
    });

    it("opens the settings panel where an instance is connected", () => {
        render(<EngineAuthNotice />);
        fireEvent.click(screen.getByText("Open settings"));

        expect(mockState.setActiveConfigTab).toHaveBeenCalledWith("apikeys");
        expect(mockState.setConfigPanelOpen).toHaveBeenCalledWith(true);
    });
});
