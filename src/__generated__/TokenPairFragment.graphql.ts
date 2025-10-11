/**
 * @generated SignedSource<<8a15debb3af16106574e8920ce04c36e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TokenPairFragment$data = {
  readonly address: string;
  readonly decimals: number | null;
  readonly id: string;
  readonly imageUri: string | null;
  readonly name: string | null;
  readonly symbol: string | null;
  readonly " $fragmentType": "TokenPairFragment";
};
export type TokenPairFragment$key = {
  readonly " $data"?: TokenPairFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"TokenPairFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "TokenPairFragment",
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
    }
  ],
  "type": "Token",
  "abstractKey": null
};

(node as any).hash = "f1800e76e3303ed08fd4b9822162d1ad";

export default node;
