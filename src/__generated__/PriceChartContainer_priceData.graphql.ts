/**
 * @generated SignedSource<<8e22eda02c53d4f0cbaa2319536a8818>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PriceChartContainer_priceData$data = ReadonlyArray<{
  readonly time: number;
  readonly value: number;
  readonly " $fragmentType": "PriceChartContainer_priceData";
}>;
export type PriceChartContainer_priceData$key = ReadonlyArray<{
  readonly " $data"?: PriceChartContainer_priceData$data;
  readonly " $fragmentSpreads": FragmentRefs<"PriceChartContainer_priceData">;
}>;

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "plural": true
  },
  "name": "PriceChartContainer_priceData",
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

(node as any).hash = "7e16a44264bcacc78c17fb88e2b3a6d2";

export default node;
