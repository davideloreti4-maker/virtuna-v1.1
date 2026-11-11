/**
 * kit.test.ts — the lists in kit.ts and the files in public/edit-kit/v1 say the same thing.
 *
 * A wipe named in kit.ts with no page behind it would compile to a film that fails only at
 * render time, on the worker. This fails here instead.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FONTS, KIT, SFX, WIPES } from "../kit";

const kit = fileURLToPath(new URL(`../../../../public/edit-kit/${KIT}/`, import.meta.url));

/**
 * Kit v1 file by file, as sha256, generated from the files (never typed by hand). An edit renders the
 * same later only if its kit does: once rendered, a kit never changes, so a file changed, added or gone
 * is a new kit version (v2), not an edit to this list.
 */
const V1: Record<string, string> = {
  "NOTICE.md": "7286f30d8c3f7cf6d74728ddcc414aaa791196d440164d14515f81361a16a5dc",
  "fonts/inter-latin-wght.woff2": "3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62",
  "sfx/boom.m4a": "15b4ea0d51bd22a853d3f7823be82dfccee0d739fdd919b15336e36e96a2331f",
  "sfx/buzz.m4a": "2e9769d429085747d79db7dc1157b9ebbe20085b4dbbf6a1bc4418eb2bff1fb5",
  "sfx/click.m4a": "35fc4c33592b1d3034faae1292f334d61884e9650af37c99033f717cfd0b467a",
  "sfx/ding.m4a": "ba8e29d71f0927c015cdee9b95adbd42f165953e5a7879a71518e8d07e824078",
  "sfx/drop.m4a": "c23af464b0493927f45333d477cf6b5e8463c494248d08693d0de584835396d9",
  "sfx/heartbeat.m4a": "66a44572ffdaa8bb235f15fea6c895a86e8565ae95e16bf09dba857da704dc1d",
  "sfx/hit.m4a": "12aa00aaaca231d73495bb396a86aa214e0a09c5730faa82be5303c0a375962a",
  "sfx/kick.m4a": "2e5f59d5b4c62e1133503e624c46d023ca15f317b5aa9e4726ad79353e42aa52",
  "sfx/notify.m4a": "d27c1a4f0edc063837f867f02563854f45c89b901c5089a005b1d785db478e00",
  "sfx/pop.m4a": "336a9b1527d151680d4d5d41c4e57fa13a0c5138381eae4bbd9d87cddea8f481",
  "sfx/rain.m4a": "5a3c37e9f2b92c21d6245d00a86ad39a6faff70cb4f97c667af2ddaa2e6eca4b",
  "sfx/riser.m4a": "a422db75b0df100bdcb9d3a214a8501d9229a39421e74a758a30764f2309d69c",
  "sfx/shutter.m4a": "259eb8cfcf837c0f783882f2eac5353023fcc45bc24aa2c8fd2881393750f4c9",
  "sfx/swish.m4a": "d4da7e69bd6fe55a7daf6719bce61c3258e5686fa5830932af5e332e2a80dcb8",
  "sfx/tick.m4a": "717a4f88aee3f42453b6af3cd2c6d66fc7d3c909ace09c88d2bef8b9d1094923",
  "sfx/typing.m4a": "d0afb0cd89d0518b4e57f2c653c177df9cc660a86227a4e66ec413dc92aef963",
  "sfx/whoosh-low.m4a": "872be7f5c6770a9c92a1ec60356bb0c53b5187afe519ececb5803b59ad7bcc6a",
  "sfx/whoosh.m4a": "0d588ebd07aaefb6c5dac408248d159924f1d4bf903d46b6e57962be3ce80320",
  "sfx/wind.m4a": "07ca03d9df19c21a330e6775c7607e9c3688f35a380028d861d21095c60dcb27",
  "sfx/zap.m4a": "d9256d9e25522119210430d5c27de4490522d612a209837210144ea356a2a521",
  "text.html": "4a405ef117d50da3f950fb82e18a8f1fe5e8bc96278691a56dacc42dc71bf8b2",
  "wipes/datamosh.html": "8a6ec04e18561a76ffaf3264a1984d35bbc5ee19b7f43ef078be2ceca45f0d11",
  "wipes/flare-whip.html": "37798ef8385335128356af66be7b259fa657a828aafe882ac5d76e16cd6d71b5",
  "wipes/glitch.html": "41222afdd728661533cf618de1d1ec67ddfee1f43a72168017d02496bf622ce3",
  "wipes/rgb-split.html": "dc24934beb0239d6b23318e55a90f2e1ae54bf526a008746026a97099aecee47",
  "wipes/shutter.html": "b9734d059015a4e2499bab1233e1fdcf789da24fede24f22ff1e6adcd3980dfd",
  "wipes/swipe-blur.html": "fbba6ac23c750cc2b51524ee2972540837a394b7df0c49cd863d74bbfb5f8926",
};

describe(`the kit (${KIT})`, () => {
  it("holds a page for every wipe", () => {
    for (const id of Object.keys(WIPES)) expect(existsSync(`${kit}wipes/${id}.html`), id).toBe(true);
  });

  it("holds a file for every sound effect and every font", () => {
    for (const name of SFX) expect(existsSync(`${kit}sfx/${name}.m4a`), name).toBe(true);
    for (const font of Object.values(FONTS)) expect(existsSync(`${kit}${font.file}`), font.file).toBe(true);
  });

  it("has a text page that is a film page reading the clip's variables", () => {
    const page = readFileSync(`${kit}text.html`, "utf8");
    expect(page).toContain("window.film =");
    expect(page).toContain("frameReadsOverrides: true");
    expect(page).toContain('id="t"');
  });

  it("v1 is pinned: every file is the one it was, and no file came or went", () => {
    const dir = fileURLToPath(new URL("../../../../public/edit-kit/v1/", import.meta.url));
    const now: Record<string, string> = {};
    for (const path of readdirSync(dir, { recursive: true, encoding: "utf8" }).sort()) {
      if (statSync(`${dir}${path}`).isFile()) now[path.split(sep).join("/")] = createHash("sha256").update(readFileSync(`${dir}${path}`)).digest("hex");
    }
    expect(now, "kit v1 changed: a kit that has been rendered never changes; a change to it is a new kit version (v2)").toEqual(V1);
  });

  it("says where its files came from", () => {
    expect(readFileSync(`${kit}NOTICE.md`, "utf8")).toMatch(/CC0/);
  });
});
