/**
 * @generated SignedSource<<3f0b0dd6ab5f09eb603e9c3f734d7b34>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TokenChartContainer_token$data = {
  readonly address: string;
  readonly id: string;
  readonly name: string | null;
  readonly symbol: string | null;
  readonly " $fragmentType": "TokenChartContainer_token";
};
export type TokenChartContainer_token$key = {
  readonly " $data"?: TokenChartContainer_token$data;
  readonly " $fragmentSpreads": FragmentRefs<"TokenChartContainer_token">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "TokenChartContainer_token",
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
      "name": "name",
      "storageKey": null
    }
  ],
  "type": "Token",
  "abstractKey": null
};

(node as any).hash = "b88d601f9cb9ee19ef994c56e548b9e5";

export default node;
