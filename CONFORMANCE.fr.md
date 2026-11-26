> Traduction communautaire (brouillon) — politique NTARI P2-002, Diffusion multilingue mondiale. Source : CONFORMANCE.md (original anglais, instantané du 2026-10-05). Brouillon communautaire assisté par machine, en attente de relecture par le mainteneur régional conformément à P2-002 §3.1. Les spécifications techniques essentielles restent en anglais conformément au §2.2.
>
> Vous avez remarqué une erreur de traduction ? N'hésitez pas à la corriger
> vous-même : forkez le dépôt https://github.com/NTARI-RAND/Agrinet et
> ouvrez une pull request. Les corrections de traduction sont des
> contributions précieuses, tout autant que le code.

> L'original anglais est normatif. Cette traduction est proposée pour la lecture, non pour l'interprétation : là où elle diverge de `CONFORMANCE.md`, l'anglais prévaut. Les mots-clés normatifs (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY), les noms de champs, les libellés et les identifiants sont conservés en anglais, car ils constituent le contrat de conformité.

# Conformité — Janus-Facing Architecture

L'autodescription du dépôt dans les termes propres à l'architecture, énoncée **avant** tout élément propre au produit, conformément à la règle d'ordonnancement de l'architecture. Chaque affirmation de conformité est rattachée au mécanisme et à la vérification qui la font respecter ; à défaut, elle est étiquetée comme substitution ou comme en cours de revue. Une prose non rattachée relève du marketing.

L'architecture est **Janus-Facing Architecture (JFA)** — le document d'architecture unifié de NTARI, documentation libre placée sous les communs AGPL-3.0 du projet.

## Déclaration de rôle

Agrinet est une **économie** de la **couche Économie et Éducation** de JFA — l'instance économique de référence : coordination et échange agricoles, appliquant les quatre couches sous-jacentes (substrat, registre, pacte, gouvernance) à une activité socio-économique précise. Elle porte sa propre instance de registre par opérateur et adopte l'échelle d'évaluation du pacte au niveau économique.

| Terme de ce dépôt | Rôle dans l'architecture |
|---|---|
| Mycelium | le **registre de dialogues par opérateur** — en ajout seul, chaîné par hachage, scellé par dialogue |
| Opérateur | un **opérateur** : une instance de plateforme tenant son propre journal |
| Adoption de LBTAS | le **pacte** au niveau économique — des distributions, jamais des moyennes |
| Règlement sous séquestre | la posture de **phase un** de l'économie : séquestre maintenant, crédit plus tard, par décision de gouvernance |

## Invariants et leurs rattachements — état de `main`

L'honnêteté d'abord : **la machinerie d'économie de membres de JFA est en cours de revue, et non sur `main`.** La délimitation du journal par opérateur, l'ébauche de point de contrôle des témoins, le modèle d'opérateur et la comptabilité d'échange à somme nulle se trouvent sur des branches de refactorisation ouvertes ; `main` est aujourd'hui l'application sans ces éléments. Chaque invariant ci-dessous est rattaché lorsque sa branche est fusionnée, et ce tableau est mis à jour dans la même PR (la règle d'accompagnement).

| Invariant (architecture) | Statut | Mécanisme engagé |
|---|---|---|
| Le registre est **en ajout seul** ; les corrections sont de nouvelles entrées ; un rejet annote, n'efface jamais | En revue | Mycelium : journaux par échange chaînés par hachage ; aucune mise à jour, aucune suppression |
| L'unité atomique est le **dialogue**, scellé lorsqu'il est complet et au repos | En revue | Scellement du dialogue maintenu ouvert par des plaintes pour préjudice non résolues ; les non-évaluateurs reçoivent une valeur par défaut marquée |
| **Aucune donnée personnelle (PII) dans les communs** | En revue | La chaîne engage la forme d'un échange ; le récit est référencé, local au membre, effaçable |
| Chaque opérateur tient son **propre journal** ; pas de chaîne globale | En revue | Délimitation du journal par opérateur ; l'attestation par témoins (et non le consensus) comme modèle de non-équivocation |
| Attestation par témoins indépendants ; les déploiements à témoin unique sont des **substitutions étiquetées** | En revue (substitution) | Ébauche de point de contrôle des témoins ; la fédération est le problème ouvert 2 |
| La réputation est portée sous forme de **distribution complète**, jamais moyennée | En revue | LBTAS v2 (la version sans moyenne) est le plancher d'adoption |
| Les soldes sont une **fonction déterministe du registre scellé** ; les échanges s'équilibrent à zéro | En revue | Comptabilité d'échange à somme nulle |
| Le règlement se fait **sous séquestre** ; le passage au crédit relève de la gouvernance, jamais d'une valeur par défaut du code | Posture permanente | Séquestre d'abord ; tout passage au crédit émis par les membres exige l'approbation du Conseil d'administration, une notification aux membres et un examen réglementaire achevé |

## Substitutions et résidus ouverts

- **Substitution à témoin unique.** Tant que des témoins indépendants ne contresignent pas les points de contrôle de l'opérateur, la non-équivocation du registre est auto-attestée et étiquetée comme telle.
- **Le crédit n'est pas activé.** Le séquestre est le contraire du crédit et est décrit sans détour comme tel ; l'amorçage en trois phases (volume et intégrité affichée d'abord) détermine quand cela change.
- **La fédération inter-opérateurs** existe sous une forme provisoire (pairs inscrits à l'annuaire, gestion provisoire des conflits reconnue comme telle) ; les points de contrôle attestés par témoins sont la cible désignée pour la non-équivocation inter-opérateurs.

## Déclaration de dépendances

Adopte l'échelle du pacte (LBTAS, plancher v2) et porte sa propre instance de registre. Indépendante du coordinateur du substrat de calcul — une économie dépend des couches qui se trouvent sous elle, jamais d'une économie sœur ni d'un coordinateur particulier.

## Notes propres au produit (en dernier, conformément à la règle d'ordonnancement)

L'économie de référence. Son modèle opérateur/fédération est la référence désignée pour la cible de conception « frontend en tant qu'opérateur » du substrat.
