import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AssetGuard } from "./AssetGuard";

// A lazily-loaded component whose dynamic import always fails.
const Broken = React.lazy(() => Promise.reject(new Error("asset exploded")));

describe("AssetGuard", () => {
  it("renders the fallback with the label when a lazy import fails", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(
        <AssetGuard label="office-asset">
          <Broken />
        </AssetGuard>,
      );
      await waitFor(() =>
        expect(screen.getByText(/office-asset/)).toBeInTheDocument(),
      );
      expect(screen.getByRole("alert")).toBeInTheDocument();
    } finally {
      errSpy.mockRestore();
    }
  });

  it("renders children normally when nothing fails", () => {
    render(
      <AssetGuard label="office-asset">
        <div>healthy content</div>
      </AssetGuard>,
    );
    expect(screen.getByText("healthy content")).toBeInTheDocument();
  });
});
