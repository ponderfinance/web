/**
 * @generated SignedSource<<af74a85929f9a2ab1808cccc302b87fe>>
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
  readonly imageURI: string | null;
  readonly name: string | null;
  readonly priceUSD: string | null;
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
      "name": "imageURI",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "priceUSD",
      "storageKey": null
    }
  ],
  "type": "Token",
  "abstractKey": null
};

(node as any).hash = "d4b0d4a170a70717d5bba80e093b1666";

export default node;
