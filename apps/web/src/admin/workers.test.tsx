import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { Worker } from "@virtual-ai-office/shared";
import { WorkersPage } from "./pages/WorkersPage";

vi.mock("./api", () => ({
  listWorkers: vi.fn(),
  listServices: vi.fn(),
  listAssets: vi.fn(),
  createWorker: vi.fn(),
  updateWorker: vi.fn(),
  deleteWorker: vi.fn(),
  restoreWorker: vi.fn(),
}));

import {
  deleteWorker,
  listAssets,
  listServices,
  listWorkers,
  restoreWorker,
} from "./api";

const listWorkersMock = vi.mocked(listWorkers);
const listServicesMock = vi.mocked(listServices);
const listAssetsMock = vi.mocked(listAssets);
const deleteWorkerMock = vi.mocked(deleteWorker);
const restoreWorkerMock = vi.mocked(restoreWorker);

function makeWorker(overrides: Partial<Worker> = {}): Worker {
  return {
    id: "nika",
    displayName: "Nika",
    role: "assistant",
    description: "",
    agentSource: "connector:demo:nika",
    status: "idle",
    lastSeen: null,
    currentTask: "",
    workstationId: "ws-01",
    publicVisible: true,
    characterModel: "procedural-chibi",
    characterConfig: {},
    accentColor: "#38bdf8",
    animationProfile: "default",
    services: [],
    sortOrder: 0,
    displaySettings: {},
    archived: false,
    createdAt: "2026-10-22T00:00:00Z",
    updatedAt: "2026-10-22T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  listWorkersMock.mockResolvedValue({
    workers: [
      makeWorker(),
      makeWorker({
        id: "old",
        displayName: "Old",
        archived: true,
        publicVisible: false,
      }),
    ],
  });
  listServicesMock.mockResolvedValue({ services: [] });
  listAssetsMock.mockResolvedValue({ assets: [] });
  deleteWorkerMock.mockResolvedValue({ worker: makeWorker() });
  restoreWorkerMock.mockResolvedValue({ worker: makeWorker() });
});

afterEach(() => {
  cleanup();
});

async function renderPage() {
  render(<WorkersPage />);
  await waitFor(() => expect(listWorkersMock).toHaveBeenCalled());
  await screen.findByText("Nika");
}

describe("WorkersPage", () => {
  it("lists workers with an archived badge", async () => {
    await renderPage();
    expect(screen.getByText("Nika")).toBeInTheDocument();
    expect(screen.getByText("archived")).toBeInTheDocument();
  });

  it("edit form shows id and agentSource read-only with the rename note", async () => {
    await renderPage();
    fireEvent.click(screen.getAllByText("Edit")[0]);
    const idInput = screen.getByDisplayValue("nika") as HTMLInputElement;
    expect(idInput.readOnly || idInput.disabled).toBe(true);
    const sourceInput = screen.getByDisplayValue(
      "connector:demo:nika",
    ) as HTMLInputElement;
    expect(sourceInput.readOnly || sourceInput.disabled).toBe(true);
    // Both the id field and the display-name field carry the rename note.
    expect(
      screen.getAllByText(/renaming never changes the worker's id/i).length,
    ).toBe(2);
    // The agentSource field explains the integration identity.
    expect(
      screen.getAllByText(/integration identity/i).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("archive opens a confirm dialog that never terminates the agent", async () => {
    await renderPage();
    fireEvent.click(screen.getAllByText("Archive")[0]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Archive worker?")).toBeInTheDocument();
    expect(within(dialog).getByText(/never terminates/)).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByText("Archive worker", { selector: "button" }),
    );
    await waitFor(() =>
      expect(deleteWorkerMock).toHaveBeenCalledWith("nika"),
    );
  });

  it("archived workers get a Restore button instead of Archive", async () => {
    await renderPage();
    expect(screen.getByText("Restore")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Restore"));
    await waitFor(() => expect(restoreWorkerMock).toHaveBeenCalledWith("old"));
  });

  it("create form has an editable id field", async () => {
    await renderPage();
    fireEvent.click(screen.getByText("+ New worker"));
    const idInput = screen.getByPlaceholderText(
      "e.g. nika",
    ) as HTMLInputElement;
    expect(idInput.readOnly).toBe(false);
    expect(idInput.disabled).toBe(false);
  });
});
