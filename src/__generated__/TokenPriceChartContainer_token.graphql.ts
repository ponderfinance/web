/**
 * @generated SignedSource<<33440e5fcdf3f04565cef1eb75d84355>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TokenPriceChartContainer_token$data = {
  readonly address: string;
  readonly decimals: number | null;
  readonly id: string;
  readonly name: string | null;
  readonly symbol: string | null;
  readonly " $fragmentType": "TokenPriceChartContainer_token";
};
export type TokenPriceChartContainer_token$key = {
  readonly " $data"?: TokenPriceChartContainer_token$data;
  readonly " $fragmentSpreads": FragmentRefs<"TokenPriceChartContainer_token">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "TokenPriceChartContainer_token",
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
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "decimals",
      "storageKey": null
    }
  ],
  "type": "Token",
  "abstractKey": null
};

(node as any).hash = "84c9bb7dfab922294014dd0931804f68";

export default node;
