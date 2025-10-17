/**
 * @generated SignedSource<<324bdd5858d1564dbebc3f3f356f6097>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type InlineTokenSwapFragment$data = {
  readonly address: string;
  readonly id: string;
  readonly imageUri: string | null;
  readonly symbol: string | null;
  readonly " $fragmentType": "InlineTokenSwapFragment";
};
export type InlineTokenSwapFragment$key = {
  readonly " $data"?: InlineTokenSwapFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"InlineTokenSwapFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "InlineTokenSwapFragment",
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
      "name": "address",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "symbol",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "imageUri",
      "storageKey": null
    }
  ],
  "type": "Token",
  "abstractKey": null
};

(node as any).hash = "6be718457be0f73c85f66c990e49c742";

export default node;
