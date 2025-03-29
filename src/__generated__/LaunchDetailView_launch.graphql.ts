/**
 * @generated SignedSource<<17d747c8aa2340a9cbec5fd7b28bd754>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type LaunchDetailView_launch$data = {
  readonly id: string;
  readonly launchId: number;
  readonly " $fragmentSpreads": FragmentRefs<"LaunchToken_launch">;
  readonly " $fragmentType": "LaunchDetailView_launch";
};
export type LaunchDetailView_launch$key = {
  readonly " $data"?: LaunchDetailView_launch$data;
  readonly " $fragmentSpreads": FragmentRefs<"LaunchDetailView_launch">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "LaunchDetailView_launch",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "launchId",
      "storageKey": null
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "LaunchToken_launch"
    }
  ],
  "type": "Launch",
  "abstractKey": null
};

(node as any).hash = "bfddc440ea7fa2f4de7cc31ecd006db7";

export default node;
