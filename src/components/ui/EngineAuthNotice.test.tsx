// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EngineAuthNotice from "./EngineAuthNotice";

const { mockState } = vi.hoisted(() => ({
    mockState: {
        engineAuthNotice: true,
        dismissEngineAuthNotice: vi.fn(),
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

    it("sends the user into the marketplace connect flow", () => {
        render(<EngineAuthNotice />);
        const link = screen.getByRole("link", { name: /connect/i });

        // A locked-out user must reach the real connect route in one click.
        expect(link.getAttribute("href")).toBe("/api/marketplace/connect");

        fireEvent.click(link);
        expect(mockState.dismissEngineAuthNotice).toHaveBeenCalled();
    });
});
