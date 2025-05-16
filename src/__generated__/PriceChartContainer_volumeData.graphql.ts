/**
 * @generated SignedSource<<d38d342ea98258870ba234081d4e59c1>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PriceChartContainer_volumeData$data = ReadonlyArray<{
  readonly count: number | null;
  readonly time: number;
  readonly value: number;
  readonly volume0: number | null;
  readonly volume1: number | null;
  readonly " $fragmentType": "PriceChartContainer_volumeData";
}>;
export type PriceChartContainer_volumeData$key = ReadonlyArray<{
  readonly " $data"?: PriceChartContainer_volumeData$data;
  readonly " $fragmentSpreads": FragmentRefs<"PriceChartContainer_volumeData">;
}>;

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "plural": true
  },
  "name": "PriceChartContainer_volumeData",
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
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "volume0",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "volume1",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "count",
      "storageKey": null
    }
  ],
  "type": "VolumeChartData",
  "abstractKey": null
};

(node as any).hash = "31f1fa3283303142b009d3e1d865df6f";

export default node;
