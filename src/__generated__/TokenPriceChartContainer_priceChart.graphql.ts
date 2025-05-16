/**
 * @generated SignedSource<<6ce0af5bc6e7eb0830a88932c532625b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TokenPriceChartContainer_priceChart$data = ReadonlyArray<{
  readonly time: number;
  readonly value: number;
  readonly " $fragmentType": "TokenPriceChartContainer_priceChart";
}>;
export type TokenPriceChartContainer_priceChart$key = ReadonlyArray<{
  readonly " $data"?: TokenPriceChartContainer_priceChart$data;
  readonly " $fragmentSpreads": FragmentRefs<"TokenPriceChartContainer_priceChart">;
}>;

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "plural": true
  },
  "name": "TokenPriceChartContainer_priceChart",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "time",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "value",
      "storageKey": null
    }
  ],
  "type": "ChartDataPoint",
  "abstractKey": null
};

(node as any).hash = "596129155490c4e0705b7f8bcd754498";

export default node;
