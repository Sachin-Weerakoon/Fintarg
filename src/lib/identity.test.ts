import { describe, expect, it } from "vitest";
import { parseIdentifier, normaliseMobile, displayNameFor, describeIdentifier } from "@/lib/identity";

describe("normaliseMobile", () => {
  it("keeps a well-formed local number", () => {
    expect(normaliseMobile("0771234567")).toBe("0771234567");
  });

  it("strips spacing, dashes and a leading +94", () => {
    expect(normaliseMobile("+94 77 123 4567")).toBe("0771234567");
    expect(normaliseMobile("94-771234567")).toBe("0771234567");
    expect(normaliseMobile("077 123 4567")).toBe("0771234567");
  });

  it("rejects anything that is not ten digits", () => {
    // Guards against "+9412345678" collapsing into a valid-looking local number.
    expect(normaliseMobile("12345678")).toBeNull();
    expect(normaliseMobile("07712345678999")).toBeNull();
    expect(normaliseMobile("abcdefghij")).toBeNull();
    expect(normaliseMobile("")).toBeNull();
  });
});

describe("parseIdentifier", () => {
  it("treats an address as an email", () => {
    expect(parseIdentifier("someone@example.com")).toEqual({
      kind: "email",
      value: "someone@example.com",
    });
  });

  it("lowercases and trims the email", () => {
    expect(parseIdentifier("  SomeOne@Example.COM ")).toEqual({
      kind: "email",
      value: "someone@example.com",
    });
  });

  it("reads a local mobile number", () => {
    expect(parseIdentifier("0771234567")).toEqual({ kind: "mobile", value: "0771234567" });
    expect(parseIdentifier("+94771234567")).toEqual({ kind: "mobile", value: "0771234567" });
  });

  it("returns null for a value that is neither", () => {
    expect(parseIdentifier("not-an-account")).toBeNull();
    expect(parseIdentifier("")).toBeNull();
  });
});

describe("displayNameFor", () => {
  it("prefers the stored full name", () => {
    expect(
      displayNameFor({ fullName: "Sachin Weerakoon", email: "s@example.com", mobile: "0771234567" }),
    ).toBe("Sachin Weerakoon");
  });

  it("ignores a blank name and falls back to the email local part", () => {
    expect(displayNameFor({ fullName: "   ", email: "someone@example.com", mobile: null })).toBe("someone");
  });

  it("falls back to the mobile number, so a mobile-only account still has a label", () => {
    expect(displayNameFor({ fullName: null, email: null, mobile: "0771234567" })).toBe("0771234567");
  });

  it("never throws on a null email, and never returns an empty string", () => {
    // A header rendered with a blank name reads as a broken page.
    expect(displayNameFor({ fullName: null, email: null, mobile: null })).toBe("there");
  });
});

describe("describeIdentifier", () => {
  it("shows an email in full", () => {
    expect(describeIdentifier({ kind: "email", value: "someone@example.com" })).toBe("someone@example.com");
  });

  it("masks a mobile number in logs", () => {
    // Audit rows must not become a list of phone numbers.
    expect(describeIdentifier({ kind: "mobile", value: "0771234567" })).toBe("0771***567");
  });

  it("uses the fallback for a null identifier", () => {
    expect(describeIdentifier(null)).toBe("unknown");
    expect(describeIdentifier(null, "none")).toBe("none");
  });
});