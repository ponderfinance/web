/**
 * @generated SignedSource<<a2608946983de77b1fdfd06b16bd1e75>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TokenChartContainer_priceData$data = ReadonlyArray<{
  readonly time: number;
  readonly value: number;
  readonly " $fragmentType": "TokenChartContainer_priceData";
}>;
export type TokenChartContainer_priceData$key = ReadonlyArray<{
  readonly " $data"?: TokenChartContainer_priceData$data;
  readonly " $fragmentSpreads": FragmentRefs<"TokenChartContainer_priceData">;
}>;

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "plural": true
  },
  "name": "TokenChartContainer_priceData",
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

(node as any).hash = "14bfd95593144eab677c4d70f92851a7";

export default node;
