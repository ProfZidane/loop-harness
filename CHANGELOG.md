# Changelog

## [0.2.0](https://github.com/ProfZidane/loop-harness/compare/v0.1.0...v0.2.0) (2026-11-27)


### Features

* **agents:** add planner, builder and reviewer agents ([#6](https://github.com/ProfZidane/loop-harness/issues/6) [#7](https://github.com/ProfZidane/loop-harness/issues/7) [#8](https://github.com/ProfZidane/loop-harness/issues/8)) ([666fc8e](https://github.com/ProfZidane/loop-harness/commit/666fc8efb5078c9b2f7cea6a27ccea32b81277a5))
* **core:** add loop rules and project templates ([d3c804c](https://github.com/ProfZidane/loop-harness/commit/d3c804cf8fb25b4f2c83fb838261f14be134056a))
* **eslint-config:** add shareable eslint presets for lint rules ([#1](https://github.com/ProfZidane/loop-harness/issues/1)) ([1e4560e](https://github.com/ProfZidane/loop-harness/commit/1e4560ea2826d123b4aadb11ee3ef332a302cbf4))
* **eslint-config:** reject escaped emoji and state hard rules in claude template ([12f77b6](https://github.com/ProfZidane/loop-harness/commit/12f77b64804aaa803522a5e3b06d0dc70c846e77))
* **gates:** add emoji, commit and branch checks to ci ([#3](https://github.com/ProfZidane/loop-harness/issues/3)) ([446a819](https://github.com/ProfZidane/loop-harness/commit/446a81978da9538002d8827a9aade5fb19680e8e))
* **gates:** add reusable ci gates workflow driven by loop config ([#2](https://github.com/ProfZidane/loop-harness/issues/2)) ([6a57ac2](https://github.com/ProfZidane/loop-harness/commit/6a57ac26acf27b06885f5abb952c38d6e4727fab))
* **hooks:** add guard hook and deterministic config writer ([#10](https://github.com/ProfZidane/loop-harness/issues/10)) ([757607a](https://github.com/ProfZidane/loop-harness/commit/757607a9e9bc74945225f70b31eaaf4ccda94c28))
* **init:** add loop-init skill and deterministic setup script ([#5](https://github.com/ProfZidane/loop-harness/issues/5)) ([c93f158](https://github.com/ProfZidane/loop-harness/commit/c93f1589ac0c187db54ca382c2463915ab3cb3ec))
* **init:** copy eslint presets into projects instead of npm ([#25](https://github.com/ProfZidane/loop-harness/issues/25)) ([8f9ecef](https://github.com/ProfZidane/loop-harness/commit/8f9ecef78b04307a91166e1bdf0812c8845da989))
* **orchestrator:** add loop orchestrator with adapters and loop skill ([#11](https://github.com/ProfZidane/loop-harness/issues/11)) ([be6d0dd](https://github.com/ProfZidane/loop-harness/commit/be6d0dd23280b66745acf2a95c3d3eec202343f3))
* **orchestrator:** pause the loop at 90 percent of claude quota ([0cab5d7](https://github.com/ProfZidane/loop-harness/commit/0cab5d7a03288dcc1d20427e34397455ca40fdc0))
* **release:** add release-please and mobile build templates ([#4](https://github.com/ProfZidane/loop-harness/issues/4)) ([7b42cbe](https://github.com/ProfZidane/loop-harness/commit/7b42cbead4d44207e85a56b44e81a32bf5a58f1c))
* **skills:** add docs-writer skill and c4 diagram renderer ([#9](https://github.com/ProfZidane/loop-harness/issues/9)) ([f4a4727](https://github.com/ProfZidane/loop-harness/commit/f4a47274045913034e8b78cbbf759ea5b944e58c))


### Fixes

* **release:** remove emoji shortcode from release pull requests ([6e42014](https://github.com/ProfZidane/loop-harness/commit/6e420149055968dafe8ed5854a2590c01755df19))


### Refactoring

* **gates:** ship gate scripts inside the plugin ([75e223d](https://github.com/ProfZidane/loop-harness/commit/75e223ddb04bfcbbf49dc3664ab250d66e17330b))


### Documentation

* **readme:** replace ascii pipeline with svg and move roadmap to issues ([c86cfa7](https://github.com/ProfZidane/loop-harness/commit/c86cfa728fcf6b3dc2f8c817861af9e4123d2539))
* **rules:** add github flow, semver tags and release rules ([b422a13](https://github.com/ProfZidane/loop-harness/commit/b422a13ab292b9488c1548edd57906ef422a458a))
* **rules:** drop imposed stack and split typescript into a language pack ([50127ac](https://github.com/ProfZidane/loop-harness/commit/50127acb12a07174ffebad160943afde7b80db17))
* **rules:** forbid emoji and enforce concise docs ([0febae0](https://github.com/ProfZidane/loop-harness/commit/0febae0ead7285bd9d0619f1b2e4cb161f4c7097))
* **rules:** record ticket trigger and claiming rules ([e92199b](https://github.com/ProfZidane/loop-harness/commit/e92199ba99162c8a7b8107447a4889c2a8eaac1f))
* **rules:** refine stack selection defaults ([7ae56bc](https://github.com/ProfZidane/loop-harness/commit/7ae56bc9111bfc257ad3b41255b86341d5d84413))
* **rules:** remove go references from naming rules ([d44db86](https://github.com/ProfZidane/loop-harness/commit/d44db86d04afaa309c63f25b343480d296193115))
