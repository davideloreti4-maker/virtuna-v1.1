import { describe, expect, it } from "vitest";
import { fixture } from "../../../lib/edit/__tests__/fixture";
import { FilmPropsSchema, addressOf, filmSize } from "../props";

const urls = { take: "/media/take.mp4", broll: "/media/broll.mp4" };
const props = { edit: fixture(), kit: "/edit", urls };
const refused = (given: unknown): string[] => {
  const result = FilmPropsSchema.safeParse(given);
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
};

describe("what the film is given", () => {
  it("takes an edit, the kit's folder and an address for each file that is not the kit's", () => {
    expect(refused(props)).toEqual([]);
    expect(FilmPropsSchema.parse(props)).toEqual(props);
  });

  it("refuses an edit that is not one", () => {
    expect(refused({ ...props, edit: { ...fixture(), shots: [] } })).toEqual(["edit.shots: Too small: expected array to have >=1 items"]);
  });

  it("refuses a file with no address, naming the file, and an address that is empty", () => {
    expect(refused({ ...props, urls: { take: urls.take } })).toEqual(['urls.broll: the file "broll" has no address']);
    expect(refused({ ...props, urls: { ...urls, take: "" } })).toEqual(["urls.take: Too small: expected string to have >=1 characters"]);
  });

  it("does not mind an address for a file the edit does not use, and takes the kit from the same place as the page", () => {
    expect(refused({ ...props, urls: { ...urls, spare: "/media/spare.mp4" } })).toEqual([]);
    expect(refused({ ...props, kit: "" })).toEqual([]);
    expect(refused({ ...props, kit: "/edit/" })).toEqual(["kit: ends in a slash"]);
  });

  it("finds a file of the kit under the kit's folder and any other at its own address", () => {
    const [take, , whoosh] = fixture().assets;
    expect(addressOf(props, take!)).toBe("/media/take.mp4");
    expect(addressOf(props, whoosh!)).toBe("/edit/sfx/whoosh.wav");
  });

  it("gives the film's length, pace and size", () => {
    expect(filmSize(fixture())).toEqual({ durationInFrames: 270, fps: 30, width: 1080, height: 1920 });
  });
});
