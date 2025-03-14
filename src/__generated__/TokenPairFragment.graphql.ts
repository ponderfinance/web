/**
 * @generated SignedSource<<98285d2038e8ff91abc2a95ccbb301f6>>
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
  readonly imageURI: string | null;
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
      "name": "imageURI",
      "storageKey": null
    }
  ],
  "type": "Token",
  "abstractKey": null
};

(node as any).hash = "62d011581e0fa15587e040c48ff5584b";

export default node;
