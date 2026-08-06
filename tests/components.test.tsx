import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Providers from "@/components/Providers";
import StatusBadge from "@/components/StatusBadge";

describe("StatusBadge", () => {
  it("renders the status as text, not colour alone", () => {
    render(
      <Providers>
        <StatusBadge status="out_of_control" />
      </Providers>
    );
    expect(screen.getByText("Out of control")).toBeInTheDocument();
  });

  it("shows an evacuation chip when flagged", () => {
    render(
      <Providers>
        <StatusBadge status="active" evacuation />
      </Providers>
    );
    expect(screen.getByText(/Evacuation alert/i)).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });
});
