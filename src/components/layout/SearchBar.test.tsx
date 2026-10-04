/**
 * SearchBar renders the dropdown and drives its keyboard, pointer and empty-state
 * behaviour. useSearch is mocked so each dropdown state can be rendered directly and
 * the assertions land on what the user sees.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

interface BarState {
    query: string;
    isOpen: boolean;
    sections: SearchSection[];
    selectedIndex: number;
    flatResults: SearchResult[];
    liveError: string | null;
    detailError: string | null;
}

const mocks = vi.hoisted(() => ({
    setQuery: vi.fn<(value: string) => void>(),
    setIsOpen: vi.fn<(open: boolean) => void>(),
    setSelectedIndex: vi.fn<(updater: (prev: number) => number) => void>(),
    handleSelect: vi.fn<(result: SearchResult) => void>(),
    isMobile: false,
    state: {
        query: "", isOpen: false, sections: [], selectedIndex: 0,
        flatResults: [], liveError: null, detailError: null,
    } as BarState,
}));

vi.mock("./useSearch", () => ({
    useSearch: () => ({
        ...mocks.state,
        setQuery: mocks.setQuery,
        setIsOpen: mocks.setIsOpen,
        setSelectedIndex: mocks.setSelectedIndex,
        handleSelect: mocks.handleSelect,
        clearHistory: vi.fn(),
    }),
}));

vi.mock("@/core/hooks/useIsMobile", () => ({ useIsMobile: () => mocks.isMobile }));

import { SearchBar } from "./SearchBar";
import type { SearchResult, SearchSection } from "./searchTypes";

const PLACEHOLDER = "Search places, addresses, flights...";
const UNREACHABLE = "Could not reach the Google place search service.";

const PARIS: SearchResult = {
    id: "a", label: "Paris", subLabel: "France", score: 100, lat: 0, lon: 0, type: "place",
};
const BERLIN: SearchResult = {
    id: "b", label: "Berlin", score: 90, lat: 0, lon: 0, type: "place",
};

function placesSection(results: SearchResult[]): SearchSection {
    return { title: "Places", icon: null, results, maxScore: results[0]?.score ?? 0 };
}

const EMPTY_STATE: BarState = {
    query: "", isOpen: false, sections: [], selectedIndex: 0,
    flatResults: [], liveError: null, detailError: null,
};

function renderBar(overrides: Partial<BarState> = {}) {
    mocks.state = { ...EMPTY_STATE, ...overrides };
    return render(<SearchBar />);
}

/** The two-result dropdown every interaction test drives. */
function twoResults() {
    return {
        isOpen: true,
        sections: [placesSection([PARIS, BERLIN])],
        flatResults: [PARIS, BERLIN],
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.isMobile = false;
    // jsdom does not implement scrollIntoView, and the dropdown calls it on the
    // highlighted row; without a stub the render itself throws.
    Element.prototype.scrollIntoView = vi.fn();
});

describe("SearchBar input", () => {
    it("renders the search field", () => {
        renderBar();

        expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeDefined();
    });

    it("sends each keystroke to the query and opens the dropdown", () => {
        renderBar();

        fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: "par" } });

        expect(mocks.setQuery).toHaveBeenCalledWith("par");
        expect(mocks.setIsOpen).toHaveBeenCalledWith(true);
    });

    it("opens the dropdown when the field takes focus", () => {
        renderBar();

        fireEvent.focus(screen.getByPlaceholderText(PLACEHOLDER));

        expect(mocks.setIsOpen).toHaveBeenCalledWith(true);
    });
});

describe("SearchBar dropdown contents", () => {
    it("lists the sections and highlights the matched part of each label", () => {
        const { container } = renderBar({ ...twoResults(), query: "par" });

        expect(screen.getByText("Places")).toBeDefined();
        expect(screen.getByText("France")).toBeDefined();
        const items = container.querySelectorAll(".search-result-item");
        expect(items[0].textContent).toBe("ParisFrance");
        expect(items[1].textContent).toBe("Berlin");
        const marks = Array.from(container.querySelectorAll("strong")).map((el) => el.textContent);
        expect(marks).toEqual(["Par"]);
    });

    it("leaves the labels unmarked when the query is empty or only whitespace", () => {
        const { container } = renderBar({ ...twoResults(), query: "" });
        expect(container.querySelector("strong")).toBeNull();
        expect(screen.getByText("Paris")).toBeDefined();

        const whitespace = renderBar({ ...twoResults(), query: "   " });
        expect(whitespace.container.querySelector("strong")).toBeNull();
    });

    it("marks only the highlighted row", () => {
        const { container } = renderBar({ ...twoResults(), selectedIndex: 1 });

        const selected = container.querySelectorAll('[data-selected="true"]');
        expect(selected).toHaveLength(1);
        expect(selected[0].textContent).toContain("Berlin");
    });

    it("scrolls the highlighted row into view and follows the selection", () => {
        const scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView;

        const view = renderBar({ ...twoResults(), selectedIndex: 1 });
        expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });

        scrollIntoView.mockClear();
        mocks.state = { ...mocks.state, selectedIndex: 0 };
        view.rerender(<SearchBar />);

        expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    });

    it("uses the full available width for every dropdown variant on a narrow viewport", () => {
        mocks.isMobile = true;

        const withResults = renderBar({ ...twoResults() });
        expect((withResults.container.querySelector(".search-bar__dropdown") as HTMLElement).style.width).toBe("100%");

        const errored = renderBar({ isOpen: true, query: "paris", liveError: UNREACHABLE });
        expect((errored.container.querySelector('[data-search-error="empty"]') as HTMLElement).style.width).toBe("100%");

        const empty = renderBar({ isOpen: true, query: "paris" });
        expect((empty.container.querySelector(".search-bar__dropdown") as HTMLElement).style.width).toBe("100%");
    });
});

describe("SearchBar keyboard and pointer", () => {
    it("opens the history dropdown when an arrow is pressed on an empty closed bar", () => {
        renderBar();

        fireEvent.keyDown(screen.getByPlaceholderText(PLACEHOLDER), { key: "ArrowDown" });

        expect(mocks.setIsOpen).toHaveBeenCalledWith(true);
    });

    it("cycles the highlight forward and backward, wrapping at both ends", () => {
        renderBar({ ...twoResults(), selectedIndex: 0 });
        const input = screen.getByPlaceholderText(PLACEHOLDER);

        fireEvent.keyDown(input, { key: "ArrowDown" });
        const forward = mocks.setSelectedIndex.mock.calls[0][0];
        expect(forward(0)).toBe(1);
        expect(forward(1)).toBe(0);

        fireEvent.keyDown(input, { key: "ArrowUp" });
        const backward = mocks.setSelectedIndex.mock.calls[1][0];
        expect(backward(0)).toBe(1);
        expect(backward(1)).toBe(0);
    });

    it("selects the highlighted result on Enter", () => {
        renderBar({ ...twoResults(), selectedIndex: 1 });

        fireEvent.keyDown(screen.getByPlaceholderText(PLACEHOLDER), { key: "Enter" });

        expect(mocks.handleSelect).toHaveBeenCalledWith(BERLIN);
    });

    it("closes the dropdown on Escape", () => {
        renderBar({ ...twoResults() });

        fireEvent.keyDown(screen.getByPlaceholderText(PLACEHOLDER), { key: "Escape" });

        expect(mocks.setIsOpen).toHaveBeenCalledWith(false);
    });

    it("ignores navigation keys while the dropdown has no results", () => {
        renderBar({ isOpen: true, query: "paris" });

        fireEvent.keyDown(screen.getByPlaceholderText(PLACEHOLDER), { key: "ArrowDown" });

        expect(mocks.setSelectedIndex).not.toHaveBeenCalled();
        expect(mocks.handleSelect).not.toHaveBeenCalled();
    });

    it("selects a result when it is clicked", () => {
        renderBar({ ...twoResults() });

        fireEvent.click(screen.getByText("Berlin"));

        expect(mocks.handleSelect).toHaveBeenCalledWith(BERLIN);
    });

    it("moves the highlight to a result on hover", () => {
        const { container } = renderBar({ ...twoResults() });

        fireEvent.mouseEnter(container.querySelectorAll(".search-result-item")[1]);

        expect(mocks.setSelectedIndex).toHaveBeenCalledWith(1);
    });

    it("ignores a key that is not a navigation key", () => {
        renderBar({ ...twoResults() });

        fireEvent.keyDown(screen.getByPlaceholderText(PLACEHOLDER), { key: "Tab" });

        expect(mocks.setSelectedIndex).not.toHaveBeenCalled();
        expect(mocks.handleSelect).not.toHaveBeenCalled();
        expect(mocks.setIsOpen).not.toHaveBeenCalled();
    });

    it("does not scroll when the highlight matches no row", () => {
        const scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView;

        const { container } = renderBar({ ...twoResults(), selectedIndex: 9 });

        expect(container.querySelectorAll('[data-selected="true"]')).toHaveLength(0);
        expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it("closes on an outside click and stays open on an inside one", () => {
        renderBar({ ...twoResults() });

        fireEvent.mouseDown(screen.getByPlaceholderText(PLACEHOLDER));
        expect(mocks.setIsOpen).not.toHaveBeenCalled();

        fireEvent.mouseDown(document.body);
        expect(mocks.setIsOpen).toHaveBeenCalledWith(false);
    });
});

describe("SearchBar empty and error states", () => {
    it("shows the live lookup error alongside the results it could still produce", () => {
        renderBar({ isOpen: true, sections: [placesSection([PARIS])], flatResults: [PARIS], liveError: UNREACHABLE });

        const alert = document.querySelector('[data-search-error="live"]');
        expect(alert?.textContent).toContain(UNREACHABLE);
        expect(screen.getByText("Place results may be incomplete.")).toBeDefined();
    });

    it("says no results were found when the query is non-empty and nothing errored", () => {
        renderBar({ isOpen: true, query: "paris" });

        expect(screen.getByText("No results found.")).toBeDefined();
    });

    it("blames the lookup, not the query, when the search failed", () => {
        renderBar({ isOpen: true, query: "paris", liveError: UNREACHABLE });

        expect(screen.queryByText("No results found.")).toBeNull();
        const alert = document.querySelector('[data-search-error="empty"]');
        expect(alert?.textContent).toContain(UNREACHABLE);
    });

    it("shows the details failure when a picked place could not be resolved", () => {
        renderBar({ isOpen: true, query: "paris", detailError: "That place has no coordinates." });

        const alert = document.querySelector('[data-search-error="empty"]');
        expect(alert?.textContent).toContain("That place has no coordinates.");
    });
});
