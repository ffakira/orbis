import { describe, expect, it } from "vitest";

import { RestaurantLocation } from "#modules/restaurants/domain/restaurant-location.js";

describe("RestaurantLocation", () => {
  const validLocation = {
    street: "Rua das Flores",
    number: "120",
    complement: null,
    neighbourhood: "Centro",
    city: "Tubarão",
    state: "sc",
    postalCode: "88701-230",
    countryCode: "BR" as const,
    latitude: -28.4713,
    longitude: -49.0144,
  };

  it("creates a location with normalized address fields", () => {
    const location = RestaurantLocation.create(validLocation);

    expect(location).toEqual({
      ...validLocation,
      state: "SC",
      postalCode: "88701230",
    });
  });

  it("allows a location without coordinates", () => {
    const location = RestaurantLocation.create({
      ...validLocation,
      latitude: null,
      longitude: null,
    });

    expect(location.latitude).toBeNull();
    expect(location.longitude).toBeNull();
  });

  it("rejects coordinates when only latitude is provided", () => {
    expect(() =>
      RestaurantLocation.create({
        ...validLocation,
        longitude: null,
      }),
    ).toThrow();
  });

  it("rejects coordinates outside valid latitude bounds", () => {
    expect(() =>
      RestaurantLocation.create({
        ...validLocation,
        latitude: 91,
      }),
    ).toThrow();
  });

  it("rejects coordinates outside valid longitude bounds", () => {
    expect(() =>
      RestaurantLocation.create({
        ...validLocation,
        longitude: 181,
      }),
    ).toThrow();
  });

  it("rejects an invalid Brazilian postal code", () => {
    expect(() =>
      RestaurantLocation.create({
        ...validLocation,
        postalCode: "12345",
      }),
    ).toThrow();
  });

  it("rejects an invalid state code", () => {
    expect(() =>
      RestaurantLocation.create({
        ...validLocation,
        state: "Santa Catarina",
      }),
    ).toThrow();
  });

  it("rejects an empty street", () => {
    expect(() =>
      RestaurantLocation.create({
        ...validLocation,
        street: " ",
      }),
    ).toThrow();
  });
});
