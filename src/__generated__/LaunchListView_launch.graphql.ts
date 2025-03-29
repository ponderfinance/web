/**
 * @generated SignedSource<<d8ff60aa33f57cfdaa754d831fcc580c>>
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
  readonly imageURI: string;
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
      "name": "imageURI",
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

(node as any).hash = "5f0371d82bc5546a02414dc4bc05b44d";

export default node;
