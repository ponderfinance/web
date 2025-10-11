/**
 * @generated SignedSource<<70cecd9a3ecce95b125fa4113cedd2a8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TokenSelectorTokenFragment$data = {
  readonly address: string;
  readonly decimals: number | null;
  readonly id: string;
  readonly imageUri: string | null;
  readonly name: string | null;
  readonly priceUsd: string | null;
  readonly symbol: string | null;
  readonly " $fragmentType": "TokenSelectorTokenFragment";
};
export type TokenSelectorTokenFragment$key = {
  readonly " $data"?: TokenSelectorTokenFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"TokenSelectorTokenFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "TokenSelectorTokenFragment",
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
      "name": "name",
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
      "name": "decimals",
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
      "name": "priceUsd",
      "storageKey": null
    }
  ],
  "type": "Token",
  "abstractKey": null
};

(node as any).hash = "c380ef81fe4f78d4268ba6f1a969b695";

export default node;
