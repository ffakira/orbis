import { describe, expect, it, vi } from "vitest";

import { createAsyncSingleton } from "#bootstrap/async-singleton.js";

describe("createAsyncSingleton", () => {
  it("initialises the instance only once", async () => {
    const factory = vi.fn().mockResolvedValue({ value: "instance" });
    const getInstance = createAsyncSingleton(factory);

    const first = await getInstance();
    const second = await getInstance();

    expect(first).toBe(second);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("shares the same initialisation across concurrent calls", async () => {
    const factory = vi.fn().mockResolvedValue({ value: "instance" });
    const getInstance = createAsyncSingleton(factory);

    const [first, second] = await Promise.all([getInstance(), getInstance()]);

    expect(first).toBe(second);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("retries initialisation after a failure", async () => {
    const factory = vi
      .fn()
      .mockRejectedValueOnce(new Error("Initialisation failed"))
      .mockResolvedValueOnce({ value: "instance" });

    const getInstance = createAsyncSingleton(factory);

    await expect(getInstance()).rejects.toThrow("Initialisation failed");

    const instance = await getInstance();

    expect(instance).toEqual({ value: "instance" });
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("returns the same rejected promise to concurrent callers", async () => {
    const factory = vi
      .fn()
      .mockRejectedValue(new Error("Initialisation failed"));

    const getInstance = createAsyncSingleton(factory);

    const first = getInstance();
    const second = getInstance();

    expect(first).toBe(second);

    await expect(first).rejects.toThrow("Initialisation failed");
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
