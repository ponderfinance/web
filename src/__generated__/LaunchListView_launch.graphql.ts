/**
 * @generated SignedSource<<67f28a645282df440c96452ce4d175e0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type LaunchListView_launch$data = {
  readonly id: string;
  readonly imageUri: string;
  readonly kubRaised: string;
  readonly launchId: number;
  readonly ponderRaised: string;
  readonly status: string;
  readonly " $fragmentType": "LaunchListView_launch";
};
export type LaunchListView_launch$key = {
  readonly " $data"?: LaunchListView_launch$data;
  readonly " $fragmentSpreads": FragmentRefs<"LaunchListView_launch">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "LaunchListView_launch",
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
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "imageUri",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "status",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "kubRaised",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "ponderRaised",
      "storageKey": null
    }
  ],
  "type": "Launch",
  "abstractKey": null
};

(node as any).hash = "aac80e5479595410e445448b407d6f46";

export default node;
