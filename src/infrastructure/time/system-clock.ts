import type { Clock } from "#modules/identity/application/ports/clock.js";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
