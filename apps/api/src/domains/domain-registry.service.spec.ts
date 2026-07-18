import { DomainRegistryService } from "./domain-registry.service";

describe("DomainRegistryService", () => {
  it("loads a domain without putting Python concepts in core code", () => {
    const registry = new DomainRegistryService();
    expect(registry.get("python-foundations").concepts).toHaveLength(8);
    expect(registry.hasMisconception("python-foundations", "RANGE_STOP_INCLUDED")).toBe(true);
  });
});
