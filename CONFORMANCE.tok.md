# lipu pi nasin sama — Janus-Facing Architecture (toki pona)

> **toki lili pi lipu ni:** lipu ni li lipu pi kulupu, li tan nasin NTARI "P2-002". lipu suli li lipu Inli "CONFORMANCE.md" (tenpo pi 2026-10-05). ilo sona li pali e lipu ni; kulupu li wile lukin e ona kepeken nasin "P2-002" kipisi "3.1".
>
> **Note:** This is a community rendering under NTARI policy P2-002. The complete document is the English original CONFORMANCE.md (snapshot 2026-10-05). Machine-assisted draft pending community review per P2-002 section 3.1.
>
> sina lukin e pakala lon toki ni la o pona e ona: o pali e "fork" lon
> https://github.com/NTARI-RAND/Agrinet, o pana e "pull request". pana sina
> li pona tawa mi mute.
>
> **lipu Inli li lawa.** lipu ni li tawa lukin, li tawa ala sona pi nasin lawa: lipu ni li ante tan `CONFORMANCE.md` la lipu Inli li lawa. nimi lawa (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY), nimi pi poki sona, nimi sitelen en nimi ilo li awen lon toki Inli, tan ni: ona li lipu lawa pi nasin sama.

---

lipu ni la poki lipu li toki e ona sama kepeken nimi pi nasin JFA. ona li toki e ni **lon open**, li toki ala e ijo pi ilo Agrinet taso lon open, tan nasin pi nanpa toki pi nasin JFA. toki ale pi nasin sama li linja tawa ilo en lukin ni: ilo en lukin li wawa e toki ni. linja li lon ala la sitelen li toki e ni: toki ni li ijo pi tenpo lili (stand-in) anu ijo pi lon lukin (in review). toki pi linja ala li toki esun.

nasin ni li **Janus-Facing Architecture (JFA)** — lipu wan pi nasin ilo pi kulupu NTARI. jan ale li ken kepeken lipu ni; ona li lon poki pi jan ale pi poki ni (nasin "AGPL-3.0").

## toki pi pali

ilo Agrinet li **esun** lon **kipisi esun en sona** (Economy & Education layer) pi nasin JFA — ona li esun pi nasin lukin: ona li wan e pali pi kasi pan, li esun e ijo pi kasi pan. ona li kepeken kipisi tu tu anpa (kipisi ilo, kipisi sona, kipisi pi toki awen, kipisi lawa) lon pali wan pi esun en kulupu. ona li jo e kipisi sona ona sama tawa jan pi ilo suli wan wan, li kepeken nasin nanpa pi kipisi pi toki awen lon esun.

| nimi pi poki ni | pali lon nasin JFA |
|---|---|
| Mycelium | **lipu toki pi jan pi ilo suli wan wan** — toki sin taso li ken kama lon ona; nanpa "hash" li linja e ona; toki li pini la ona li kama awen |
| Operator | **jan pi ilo suli**: ilo suli wan li awen e lipu ona sama |
| LBTAS adoption | **kipisi pi toki awen** lon esun — mute pi pana li awen; nanpa meso li lon ala |
| Escrow settlement | nasin esun pi **tenpo nanpa wan**: tenpo ni la mani awen; tenpo kama la mani pi kulupu — kulupu lawa li toki e ni |

## nasin awen en linja ona — lon `main`

toki lon li nanpa wan: **ilo JFA pi esun kulupu li lon lukin, li lon ala `main`.** ijo ni li lon palisa pali open (refactor): poki lipu pi jan pi ilo suli wan wan, ilo lili open pi jan lukin (witness checkpoint stub), nasin pi jan pi ilo suli, en nanpa esun pi ala (net-zero). tenpo ni la `main` li ilo li jo ala e ijo ni. palisa li kama lon `main` la nasin awen ona li kama jo e linja. jan li ante e lipu leko ni lon "PR" sama (nasin pi tawa sama).

| nasin awen (nasin JFA) | lon seme | ilo pi linja |
|---|---|---|
| lipu suli li **kama suli taso**; pona pi pakala li toki sin; jan li weka e toki la ona li pana e toki lon poka, li weka ala e ona | lon lukin (In review) | Mycelium: lipu pi esun wan wan, nanpa "hash" li linja e ona; ante ala, weka ala |
| kipisi lili nanpa wan li **toki**. toki li pini ale, li kama lape, la ona li kama awen | lon lukin (In review) | toki pi pakala pi pini ala li lon la toki li ken ala kama awen; jan li pana ala e nanpa la ona li jo e nanpa pi nasin open, e sitelen pi ni |
| **sona pi jan ("PII") li lon ala poki pi jan ale** | lon lukin (In review) | linja li awen e selo pi esun; toki suli li lon ala linja: linja li pana e nasin tawa ona; ona li lon poki pi jan kulupu; jan li ken weka e ona |
| jan pi ilo suli ale li awen e **lipu ona sama**; linja wan pi ma ale li lon ala | lon lukin (In review) | poki lipu pi jan pi ilo suli wan wan; nasin pi jan lukin (nasin pi wile sama pi jan ale ala) li nasin ni: lipu li ken ala toki tu ante (non-equivocation) |
| jan lukin li lon, li lawa ala tan jan ante; ilo li jo e jan lukin wan taso la **sitelen li toki e ni: ona li ijo pi tenpo lili** | lon lukin, ijo pi tenpo lili (In review, stand-in) | ilo lili open pi jan lukin; kulupu pi ilo mute (federation) li wile sona nanpa tu pi pini ala |
| nimi pi jan (pona anu ike) li awen kepeken **mute ale pi pana**, li kama ala nanpa meso | lon lukin (In review) | LBTAS v2 (pana pi nanpa meso ala) li nanpa anpa pi kepeken |
| mani pi jan li **kama tan lipu awen taso, kepeken nasin pi ante ala**; esun ale li kama ala (0) lon nanpa | lon lukin (In review) | nanpa esun pi ala (net-zero) |
| esun li pini kepeken **mani awen**; kulupu lawa li ken open e mani pi kulupu; ilo li open ala e ona tan nasin open ona | nasin ni li awen (Standing posture) | mani awen li nanpa wan; tawa ale tawa mani pi jan kulupu li wile e ni: kulupu lawa suli (Board) li toki "pona", jan ale pi kulupu li kama sona, lukin pi nasin lawa pi ma li pini |

## ijo pi tenpo lili en wile sona pi pini ala

- **jan lukin wan taso li ijo pi tenpo lili.** jan lukin ante (jan ante li lawa ala e ona) li sitelen sin ala e nimi ona lon ilo open pi jan pi ilo suli la, toki ni: "lipu awen li toki tu ante ala" li toki pi lipu awen sama taso, li jo e sitelen pi ni.
- **mani pi kulupu li open ala.** mani awen li ante ale tan mani pi kulupu; lipu li toki e ni kepeken toki pi len ala. nasin open pi tenpo tu wan (nanpa wan la esun mute en pona pi lukin) li lawa e tenpo pi ante ni.
- **kulupu pi jan pi ilo suli mute** li lon kepeken nasin pi tenpo lili (jan sama li lon lipu nimi; nasin pi tenpo lili tawa utala li lon, jan li sona e ni). lipu li toki e ni: ilo open pi jan lukin li ijo wile tawa ni: jan pi ilo suli mute li toki ala tu ante.

## toki pi ijo wile

ona li kepeken nasin nanpa pi kipisi pi toki awen (LBTAS, nanpa anpa li v2), li jo e kipisi sona ona sama. ona li wile ala e ilo insa pi kipisi ilo pi nanpa pali — esun li wile e kipisi anpa ona taso; ona li wile ala e esun ante pi kipisi sama, li wile ala e ilo insa wan.

## toki pi ilo Agrinet taso (lon pini, tan nasin pi nanpa toki)

esun pi nasin lukin. nasin ona pi jan pi ilo suli en kulupu ilo li nasin lukin pi nimi tawa wile pali ni pi kipisi ilo: lupa lukin li jan pi ilo suli.
