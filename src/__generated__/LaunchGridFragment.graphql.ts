/**
 * @generated SignedSource<<a9fb74df045b78f882f4c8c54b1ce13c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type LaunchGridFragment$data = {
  readonly cancelledAt: any | null;
  readonly completedAt: any | null;
  readonly createdAt: any;
  readonly creatorAddress: string;
  readonly hasDualPools: boolean | null;
  readonly id: string;
  readonly imageUri: string;
  readonly kubLiquidity: string | null;
  readonly kubPairAddress: string | null;
  readonly kubRaised: string;
  readonly launchId: number;
  readonly lpWithdrawn: boolean | null;
  readonly lpWithdrawnAt: any | null;
  readonly ponderBurned: string | null;
  readonly ponderLiquidity: string | null;
  readonly ponderPairAddress: string | null;
  readonly ponderPoolSkipped: boolean | null;
  readonly ponderRaised: string;
  readonly status: string;
  readonly tokenAddress: string;
  readonly updatedAt: any;
  readonly " $fragmentType": "LaunchGridFragment";
};
export type LaunchGridFragment$key = {
  readonly " $data"?: LaunchGridFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"LaunchGridFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "LaunchGridFragment",
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
      "name": "launchId",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "tokenAddress",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "creatorAddress",
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
      "name": "kubRaised",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "ponderRaised",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "status",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "kubPairAddress",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "ponderPairAddress",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "hasDualPools",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "ponderPoolSkipped",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "kubLiquidity",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "ponderLiquidity",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "ponderBurned",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "lpWithdrawn",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "lpWithdrawnAt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "completedAt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "cancelledAt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "createdAt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "updatedAt",
      "storageKey": null
    }
  ],
  "type": "Launch",
  "abstractKey": null
};

(node as any).hash = "658eaf6d341251cc75778ea4eb8a6dfb";

export default node;
